/**
 * Root Layout
 * Configures global providers and hydrates persisted auth & language preferences on app launch.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Initialize i18n
import '@/i18n';
import { useAuthStore, useLanguageStore } from '@/store';

export default function RootLayout() {
  // TanStack Query client instance
  const [queryClient] = useState(() => new QueryClient());

  // Restore user's saved preferences
  const loadSavedLanguage = useLanguageStore((state) => state.loadSavedLanguage);
  const loadSavedAuth = useAuthStore((state) => state.loadSavedAuth);

  useEffect(() => {
    loadSavedLanguage();
    loadSavedAuth();
  }, [loadSavedLanguage, loadSavedAuth]);

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
