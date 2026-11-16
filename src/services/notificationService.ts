/**
 * Push Notification Service
 * Manages Expo Push Notification permissions, device token registration with FastAPI backend,
 * foreground push notifications, and API notification management.
 */

import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';

import { apiClient } from './api';
import { FarmNotification, NotificationType } from '@/store/useNotificationStore';

// Configure foreground presentation behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export interface BackendNotification {
  id: number;
  type: string;
  title: string;
  title_tamil?: string | null;
  message: string;
  message_tamil?: string | null;
  order_id?: number | null;
  product_id?: number | null;
  read: boolean;
  created_at: string;
}

export interface BackendNotificationsResponse {
  items: BackendNotification[];
  total: number;
  unread_count: number;
}

/**
 * Format relative time string from ISO date string
 */
export function formatTimeAgo(dateStr: string): string {
  try {
    // Server timestamps are UTC without an offset
    const date = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(dateStr) ? dateStr : `${dateStr}Z`);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.max(0, Math.floor(diffMs / 1000));

    if (diffSecs < 60) return 'Just now';
    const diffMins = Math.floor(diffSecs / 60);
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  } catch {
    return 'Recently';
  }
}

/**
 * Convert backend notification record to FarmNotification for store and UI
 */
export function mapBackendNotification(item: BackendNotification): FarmNotification {
  return {
    id: String(item.id),
    type: (item.type as NotificationType) || 'order',
    title: item.title,
    titleTamil: item.title_tamil || item.title,
    message: item.message,
    messageTamil: item.message_tamil || item.message,
    timestamp: item.created_at,
    timeAgo: formatTimeAgo(item.created_at),
    read: item.read,
    orderId: item.order_id != null ? String(item.order_id) : undefined,
    productId: item.product_id != null ? String(item.product_id) : undefined,
  };
}

export const notificationService = {
  /**
   * Request permissions and retrieve the Expo Push Token.
   */
  async registerForPushNotificationsAsync(): Promise<string | null> {
    if (!Device.isDevice) {
      // Push notifications and channels require a physical device; skip gracefully on simulators / web / Expo Go dev
      return null;
    }

    let token: string | null = null;

    if (Platform.OS === 'android') {
      try {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'FarmKart Orders & Updates',
          importance: AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#2E7D32',
        });
      } catch {
        // Channel setup may not be available on all Android runtimes; silently fallback
      }
    }

    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.warn('[NotificationService] Permission not granted for push notifications.');
        return null;
      }

      const projectId =
        Constants?.expoConfig?.extra?.eas?.projectId ??
        Constants?.easConfig?.projectId;

      const pushTokenData = await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId } : undefined
      );
      token = pushTokenData.data;
    } catch (err) {
      console.warn('[NotificationService] Error getting Expo push token:', err);
    }

    return token;
  },

  /**
   * Register the device push token with the FarmKart backend.
   */
  async registerTokenWithBackend(token: string): Promise<boolean> {
    try {
      await apiClient.post('/notifications/register-token', {
        token,
        platform: Platform.OS,
      });
      return true;
    } catch (err) {
      console.warn('[NotificationService] Failed to register token with backend:', err);
      return false;
    }
  },

  /**
   * Request push token and register with backend in one call.
   */
  async registerAndSyncToken(): Promise<string | null> {
    const token = await this.registerForPushNotificationsAsync();
    if (token) {
      await this.registerTokenWithBackend(token);
    }
    return token;
  },

  /**
   * Unregister token on logout.
   */
  async unregisterToken(token: string, authToken?: string): Promise<void> {
    try {
      await apiClient.delete('/notifications/unregister-token', {
        params: { token },
        // Logout clears the session before this runs, so the caller passes the old token
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
        skipAuthRedirect: true,
      } as any);
    } catch (err) {
      console.warn('[NotificationService] Failed to unregister token:', err);
    }
  },

  /**
   * Fetch in-app notifications from backend.
   */
  async fetchNotifications(limit = 50, offset = 0): Promise<{
    notifications: FarmNotification[];
    total: number;
    unreadCount: number;
  }> {
    try {
      const res = (await apiClient.get(
        `/notifications?limit=${limit}&offset=${offset}`
      )) as BackendNotificationsResponse;

      const notifications = (res.items || []).map(mapBackendNotification);
      return {
        notifications,
        total: res.total || 0,
        unreadCount: res.unread_count || 0,
      };
    } catch (err) {
      console.warn('[NotificationService] Failed to fetch notifications:', err);
      return {
        notifications: [],
        total: 0,
        unreadCount: 0,
      };
    }
  },

  /**
   * Mark a notification as read.
   */
  async markAsRead(id: string | number): Promise<void> {
    try {
      await apiClient.patch(`/notifications/${id}/read`);
    } catch (err) {
      console.warn(`[NotificationService] Failed to mark notification ${id} as read:`, err);
    }
  },

  /**
   * Mark all notifications as read.
   */
  async markAllAsRead(): Promise<void> {
    try {
      await apiClient.patch('/notifications/mark-all-read');
    } catch (err) {
      console.warn('[NotificationService] Failed to mark all notifications as read:', err);
    }
  },

  /**
   * Clear all notifications.
   */
  async clearAll(): Promise<void> {
    try {
      await apiClient.delete('/notifications');
    } catch (err) {
      console.warn('[NotificationService] Failed to clear all notifications:', err);
    }
  },
};

export default notificationService;
