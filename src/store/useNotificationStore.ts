/**
 * Notifications Store
 * Persistent Zustand store for FarmKart buyer alerts:
 * Order status progress, fresh farm harvest drops, Mandi price updates, and farmer advisories.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type NotificationType = 'order' | 'harvest' | 'offer' | 'farmer';

export interface FarmNotification {
  id: string;
  type: NotificationType;
  title: string;
  titleTamil: string;
  message: string;
  messageTamil: string;
  timestamp: string;
  timeAgo: string;
  read: boolean;
  orderId?: string;
  productId?: string;
}

const INITIAL_NOTIFICATIONS: FarmNotification[] = [
  {
    id: 'notif-1',
    type: 'order',
    title: 'Order FK-8821 Out for Delivery!',
    titleTamil: 'ஆர்டர் FK-8821 விநியோகத்திற்கு புறப்பட்டது!',
    message: 'Driver Murugan with Mini Truck (TN-58-BZ-4412) is on the way with your Mattu Eruvu.',
    messageTamil: 'ஓட்டுநர் முருகன் மினி லாரியில் (TN-58-BZ-4412) உங்கள் மாட்டு எருவுடன் புறப்பட்டுள்ளார்.',
    timestamp: '2026-10-26T14:45:00Z',
    timeAgo: '25 mins ago',
    read: false,
    orderId: 'FK-8821',
  },
  {
    id: 'notif-2',
    type: 'harvest',
    title: 'Fresh Harvest: Country Red Banana (Sevvalai)',
    titleTamil: 'புதிய அறுவடை: நாட்டு செவ்வாழை தார்',
    message: 'Vadipatti Iyarkai Pannai harvested 25 fresh bunches this morning. Order now before stock runs out!',
    messageTamil: 'வாடிப்பட்டி இயற்கை பண்ணையில் இன்று காலை புதிய செவ்வாழை தார்கள் அறுவடை செய்யப்பட்டன!',
    timestamp: '2026-10-26T11:20:00Z',
    timeAgo: '3 hours ago',
    read: false,
    productId: 'prod-10',
  },
  {
    id: 'notif-3',
    type: 'offer',
    title: 'Mandi Deal: Country Tomato Price Drop',
    titleTamil: 'மண்டி தள்ளுபடி: நாட்டு தக்காளி விலை குறைவு',
    message: 'Nattu Thakkali prices dropped by ₹12/kg in Madurai market today. Get direct farm produce at ₹28/kg!',
    messageTamil: 'மதுரை சந்தையில் நாட்டு தக்காளி விலை கிலோவிற்கு ₹12 குறைந்துள்ளது. பண்ணை விலை ₹28/கிலோ!',
    timestamp: '2026-10-26T08:00:00Z',
    timeAgo: '6 hours ago',
    read: true,
    productId: 'prod-2',
  },
  {
    id: 'notif-4',
    type: 'farmer',
    title: 'Organic Certification Verified',
    titleTamil: 'இயற்கை சான்றிதழ் உறுதிப்படுத்தப்பட்டது',
    message: 'Farmer Ramasamy Gounder uploaded renewed Tamil Nadu Organic Certification Department (TNOCD) certificate.',
    messageTamil: 'விவசாயி ராமசாமி கவுண்டர் தமிழ்நாடு இயற்கை சான்றிதழ் துறை சான்றிதழை புதுப்பித்துள்ளார்.',
    timestamp: '2026-10-25T16:30:00Z',
    timeAgo: 'Yesterday',
    read: true,
  },
];

export interface NotificationState {
  notifications: FarmNotification[];
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
  getUnreadCount: () => number;
  addNotification: (notification: FarmNotification) => void;
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      notifications: INITIAL_NOTIFICATIONS,

      markAsRead: (id: string) => {
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          ),
        }));
      },

      markAllAsRead: () => {
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, read: true })),
        }));
      },

      clearAll: () => {
        set({ notifications: [] });
      },

      getUnreadCount: () => {
        return get().notifications.filter((n) => !n.read).length;
      },

      addNotification: (notification: FarmNotification) => {
        set((state) => ({
          notifications: [notification, ...state.notifications],
        }));
      },
    }),
    {
      name: 'farmkart_notifications_storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

export default useNotificationStore;
