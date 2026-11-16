/**
 * Notifications Store
 * Zustand store for FarmKart notifications, integrated with the FastAPI backend and Expo Push API.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { notificationService } from '@/services/notificationService';

export type NotificationType = 'order' | 'harvest' | 'offer' | 'farmer';

export interface FarmNotification {
  id: string;
  type: NotificationType;
  title: string;
  titleTamil?: string;
  message: string;
  messageTamil?: string;
  timestamp: string;
  timeAgo: string;
  read: boolean;
  orderId?: string;
  productId?: string;
}

export interface NotificationState {
  notifications: FarmNotification[];
  isLoading: boolean;
  pushToken: string | null;
  setPushToken: (token: string | null) => void;
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  clearAll: () => Promise<void>;
  getUnreadCount: () => number;
  addNotification: (notification: FarmNotification) => void;
  /** Clears local state only (used on logout so the next user never sees old alerts). */
  resetLocal: () => void;
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      notifications: [],
      isLoading: false,
      pushToken: null,

      setPushToken: (token: string | null) => {
        set({ pushToken: token });
      },

      resetLocal: () => {
        set({ notifications: [], isLoading: false });
      },

      fetchNotifications: async () => {
        set({ isLoading: true });
        try {
          const result = await notificationService.fetchNotifications();
          set({
            notifications: result.notifications,
            isLoading: false,
          });
        } catch (err) {
          console.warn('[useNotificationStore] fetchNotifications error:', err);
          set({ isLoading: false });
        }
      },

      markAsRead: async (id: string) => {
        // Optimistic update
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          ),
        }));
        await notificationService.markAsRead(id);
      },

      markAllAsRead: async () => {
        // Optimistic update
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, read: true })),
        }));
        await notificationService.markAllAsRead();
      },

      clearAll: async () => {
        set({ notifications: [] });
        await notificationService.clearAll();
      },

      getUnreadCount: () => {
        return get().notifications.filter((n) => !n.read).length;
      },

      addNotification: (notification: FarmNotification) => {
        set((state) => ({
          notifications: [
            notification,
            ...state.notifications.filter((n) => n.id !== notification.id),
          ],
        }));
      },
    }),
    {
      name: 'farmkart_notifications_storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        notifications: state.notifications,
        pushToken: state.pushToken,
      }),
    }
  )
);

export default useNotificationStore;
