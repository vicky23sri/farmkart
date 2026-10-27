/**
 * Seller Group Layout
 * Implements strict role-based redirect guard:
 * - If not logged in -> redirect to login
 * - If buyer role -> redirect to /(buyer)
 * - If seller role -> renders AppHeader with isSeller=true and seller Stack navigator
 */

import { Redirect, Stack } from 'expo-router';
import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useAuthStore } from '@/store';
import { colors } from '@/theme';

export default function SellerLayout() {
  const { isLoggedIn, role, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Redirect Guard: unauthenticated users cannot access seller dashboard
  if (!isLoggedIn) {
    return <Redirect href="/(auth)/login" />;
  }

  // Redirect Guard: buyers are strictly barred from seller screens
  if (role !== 'seller') {
    return role === 'buyer' ? (
      <Redirect href="/(buyer)/(tabs)" />
    ) : (
      <Redirect href="/(auth)/role-select" />
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="add-product"
        options={{
          headerShown: false,
          animation: 'slide_from_bottom',
        }}
      />
    </Stack>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
