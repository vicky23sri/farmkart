/**
 * Splash & Gateway Screen
 * Root route that decides initial navigation based on authentication status and user role.
 * - Logged in with Buyer role -> /(buyer)
 * - Logged in with Seller role -> /(seller)
 * - Logged in without role -> /(auth)/role-select
 * - Not logged in -> /(auth)/onboarding
 */

import { Redirect } from 'expo-router';
import React from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAuthStore } from '@/store';
import { colors, fontSizes, spacing } from '@/theme';

export default function IndexScreen() {
  const { isLoggedIn, role, isLoading } = useAuthStore();

  // 1. While reading credentials from secure storage, display brand splash screen
  if (isLoading) {
    return (
      <View style={styles.splashContainer}>
        <Image
          source={require('@/assets/logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.appName}>FarmKart</Text>
        <Text style={styles.tagline}>உழவன் சந்தை</Text>
        <ActivityIndicator
          size="large"
          color={colors.primary}
          style={styles.loader}
        />
      </View>
    );
  }

  // 2. If logged in with a role, navigate directly to that role's tabs
  if (isLoggedIn && role === 'buyer') {
    return <Redirect href="/(buyer)/(tabs)" />;
  }

  if (isLoggedIn && role === 'seller') {
    return <Redirect href="/(seller)/(tabs)" />;
  }

  // 3. If logged in without a chosen role, prompt for role selection
  if (isLoggedIn && !role) {
    return <Redirect href="/(auth)/role-select" />;
  }

  // 4. Guest / unauthenticated users start at onboarding
  return <Redirect href="/(auth)/onboarding" />;
}

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  logo: {
    width: 96,
    height: 96,
    borderRadius: 20,
    marginBottom: spacing.md,
  },
  appName: {
    fontSize: fontSizes.title,
    fontWeight: '800',
    color: colors.primaryDark,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: fontSizes.sm,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  loader: {
    marginTop: spacing.xl,
  },
});
