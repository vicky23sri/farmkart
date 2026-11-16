/**
 * Root Layout
 * Configures global providers, Sentry error monitoring, Expo push notifications,
 * and hydrates persisted auth & language preferences on app launch.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClientProvider } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Initialize i18n
import '@/i18n';
import { notificationService } from '@/services/notificationService';
import { queryClient } from '@/services/queryClient';
import { initSentry, wrapWithSentry } from '@/services/sentry';
import { useAuthStore, useLanguageStore, useNotificationStore } from '@/store';

// Initialize Sentry with PII scrubbing
initSentry();

// Remove demo data persisted by earlier app versions (fake orders / listings)
AsyncStorage.multiRemove([
  'farmkart_order_storage',
  'farmkart_seller_products_storage',
  'farmkart_wishlist_storage',
]).catch(() => {});

function openNotificationTarget(data: Record<string, any>) {
  const role = useAuthStore.getState().role;
  const orderId = data.order_id ?? data.orderId;
  if (orderId !== undefined && orderId !== null) {
    if (role === 'seller') {
      router.push('/(seller)/(tabs)/orders');
    } else {
      router.push({ pathname: '/(buyer)/tracking', params: { orderId: String(orderId) } });
    }
    return;
  }
  if (data.product_id && role !== 'seller') {
    router.push({ pathname: '/(buyer)/product-detail', params: { id: String(data.product_id) } });
    return;
  }
  if (role !== 'seller') {
    router.push('/(buyer)/notifications');
  }
}

function RootLayout() {
  // Restore user's saved preferences
  const loadSavedLanguage = useLanguageStore((state) => state.loadSavedLanguage);
  const loadSavedAuth = useAuthStore((state) => state.loadSavedAuth);
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);

  useEffect(() => {
    loadSavedLanguage();
    loadSavedAuth();
  }, [loadSavedLanguage, loadSavedAuth]);

  // Register push notifications and token with backend when logged in
  useEffect(() => {
    if (isLoggedIn) {
      notificationService.registerAndSyncToken().then((token) => {
        if (token) {
          useNotificationStore.getState().setPushToken(token);
        }
      });
      useNotificationStore.getState().fetchNotifications();
    }
  }, [isLoggedIn]);

  // Setup Push Notification listeners (foreground reception + banner taps)
  useEffect(() => {
    const notificationListener = Notifications.addNotificationReceivedListener(
      (notification) => {
        const content = notification.request.content;
        const data = (content.data as Record<string, any>) || {};

        useNotificationStore.getState().addNotification({
          id: String(data.notification_id || notification.request.identifier),
          type: (data.type as any) || 'order',
          title: content.title || 'FarmKart Alert',
          titleTamil: data.titleTamil,
          message: content.body || '',
          messageTamil: data.messageTamil,
          timestamp: new Date().toISOString(),
          timeAgo: 'Just now',
          read: false,
          orderId: data.order_id !== undefined ? String(data.order_id) : undefined,
          productId: data.product_id !== undefined ? String(data.product_id) : undefined,
        });
        // Order status changed: refresh any order screens that are open
        if (data.order_id !== undefined) {
          queryClient.invalidateQueries({ queryKey: ['order', String(data.order_id)] });
          queryClient.invalidateQueries({ queryKey: ['order-track', String(data.order_id)] });
          queryClient.invalidateQueries({ queryKey: ['seller-my-orders-infinite'] });
          queryClient.invalidateQueries({ queryKey: ['buyer-my-orders-infinite'] });
        }
      }
    );

    const responseListener = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data =
          (response.notification.request.content.data as Record<string, any>) || {};
        if (useAuthStore.getState().isLoggedIn) {
          openNotificationTarget(data);
        }
      }
    );

    return () => {
      notificationListener.remove();
      responseListener.remove();
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
          }}
        />
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}

export default wrapWithSentry(RootLayout);
