/**
 * Auth Layout
 * Stack navigator for onboarding, login, and role selection screens.
 * Redirects logged in users with an assigned role directly to their home dashboard.
 */

import { Redirect, Stack } from 'expo-router';
import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useAuthStore } from '@/store';
import { colors } from '@/theme';

export default function AuthLayout() {
  const { isLoggedIn, role, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // If already authenticated with a role, redirect to their respective tabs
  if (isLoggedIn && role === 'buyer') {
    return <Redirect href="/(buyer)/(tabs)" />;
  }

  if (isLoggedIn && role === 'seller') {
    return <Redirect href="/(seller)/(tabs)" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    />
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
