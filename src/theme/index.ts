/**
 * FarmKart Theme Configuration
 * Centralized design tokens for colors, spacing, typography, shadows, and card styling.
 */

import { StyleSheet } from 'react-native';

export const colors = {
  // Brand Colors
  primary: '#2E7D32',      // Primary Green - fresh leaf / agriculture
  primaryDark: '#1B5E20',  // Dark Green - deep forest / header accents
  primaryLight: '#E8F5E9', // Light green tint for chips & active states
  accent: '#F57C00',       // Accent Orange - harvest / call-to-action buttons
  accentLight: '#FFF3E0',  // Light orange tint for tags & highlights

  // Surface & Layout Colors
  background: '#F9FAF5',   // Organic off-white / light green-tinted background
  surface: '#FFFFFF',      // Pure white for card surfaces
  surfaceSecondary: '#F3F4F6',

  // Typography Colors
  text: '#1F2937',          // Dark charcoal for high contrast body & titles
  textSecondary: '#4B5563', // Medium gray for labels, descriptions, and subtitles
  textMuted: '#9CA3AF',     // Light gray for placeholders and disabled items
  textInverse: '#FFFFFF',   // White text on dark/green backgrounds

  // Status & Utility Colors
  border: '#E5E7EB',
  divider: '#EEEEEE',
  success: '#2E7D32',
  warning: '#F57C00',
  error: '#D32F2F',
  white: '#FFFFFF',
  black: '#000000',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const fontSizes = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  title: 28,
  hero: 34,
} as const;

export const borderRadius = {
  sm: 6,
  md: 12, // Standard card border radius (12px)
  lg: 16,
  full: 9999,
} as const;

export const shadows = StyleSheet.create({
  // Soft subtle shadow for white cards
  soft: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2, // Android shadow support
  },
  // Medium shadow for floating action buttons or elevated cards
  medium: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4, // Android shadow support
  },
});

// Pre-assembled card style helper with 12px radius and soft shadow
export const cardStyle = {
  backgroundColor: colors.surface,
  borderRadius: borderRadius.md,
  padding: spacing.md,
  ...shadows.soft,
};

export const theme = {
  colors,
  spacing,
  fontSizes,
  borderRadius,
  shadows,
  card: cardStyle,
};

export default theme;
