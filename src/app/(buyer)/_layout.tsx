/**
 * Buyer Group Layout
 * Implements strict role-based redirect guard:
 * - If not logged in -> redirect to login
 * - If seller role -> redirect to /(seller)
 * - If buyer role -> renders Stack with tabs & nested checkout/product detail screens
 */

import { Redirect, Stack } from 'expo-router';
import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useAuthStore } from '@/store';
import { colors } from '@/theme';

export default function BuyerLayout() {
  const { isLoggedIn, role, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Redirect Guard: unauthenticated users cannot access buyer screens
  if (!isLoggedIn) {
    return <Redirect href="/(auth)/login" />;
  }

  // Redirect Guard: sellers are strictly barred from buyer routes
  if (role !== 'buyer') {
    return role === 'seller' ? (
      <Redirect href="/(seller)/(tabs)" />
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
        name="products"
        options={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="product-detail"
        options={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="checkout"
        options={{
          headerShown: false,
          animation: 'slide_from_bottom',
        }}
      />
      <Stack.Screen
        name="payment"
        options={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="order-confirmation"
        options={{
          headerShown: false,
          animation: 'fade',
        }}
      />
      <Stack.Screen
        name="order-detail"
        options={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="tracking"
        options={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="rate-review"
        options={{
          headerShown: false,
          animation: 'slide_from_bottom',
        }}
      />
      <Stack.Screen
        name="wishlist"
        options={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="notifications"
        options={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      />
    </Stack>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
