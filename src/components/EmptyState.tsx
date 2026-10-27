/**
 * EmptyState Component
 * Visual placeholder for empty carts, search results, or harvest listings.
 */

import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import {
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';

import { colors, fontSizes, spacing } from '@/theme';
import { PrimaryButton } from './PrimaryButton';

export interface EmptyStateProps {
  /** Title message */
  title: string;
  /** Explanatory description */
  description?: string;
  /** MaterialCommunityIcons icon name */
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  /** Optional button action text */
  actionLabel?: string;
  /** Optional button action callback */
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function EmptyState({
  title,
  description,
  icon = 'basket-outline',
  actionLabel,
  onAction,
  style,
}: EmptyStateProps) {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.iconCircle}>
        <MaterialCommunityIcons
          name={icon}
          size={48}
          color={colors.primary}
        />
      </View>
      <Text style={styles.title}>{title}</Text>
      {description && <Text style={styles.description}>{description}</Text>}
      {actionLabel && onAction && (
        <PrimaryButton
          title={actionLabel}
          onPress={onAction}
          style={styles.actionBtn}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: fontSizes.lg,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  description: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  actionBtn: {
    marginTop: spacing.lg,
    minWidth: 160,
  },
});

export default EmptyState;
