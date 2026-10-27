/**
 * StatusChip Component
 * Badges for order states, crop stock, and delivery statuses.
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

import { colors, fontSizes } from '@/theme';

export type StatusVariant = 'success' | 'warning' | 'error' | 'info';

export interface StatusChipProps {
  /** Text label inside chip */
  label: string;
  /** Color theme variant */
  variant?: StatusVariant;
  /** Optional icon name from MaterialCommunityIcons */
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  /** Optional container style */
  style?: StyleProp<ViewStyle>;
}

export function StatusChip({
  label,
  variant = 'success',
  icon,
  style,
}: StatusChipProps) {
  const getThemeStyles = () => {
    switch (variant) {
      case 'warning':
        return {
          bg: colors.accentLight,
          text: colors.accent,
          border: 'rgba(245, 124, 0, 0.3)',
          defaultIcon: 'clock-outline',
        };
      case 'error':
        return {
          bg: '#FFEBEE',
          text: colors.error,
          border: 'rgba(211, 47, 47, 0.3)',
          defaultIcon: 'alert-circle-outline',
        };
      case 'info':
        return {
          bg: '#E3F2FD',
          text: '#1976D2',
          border: 'rgba(25, 118, 210, 0.3)',
          defaultIcon: 'information-outline',
        };
      case 'success':
      default:
        return {
          bg: colors.primaryLight,
          text: colors.primaryDark,
          border: 'rgba(46, 125, 50, 0.3)',
          defaultIcon: 'check-circle-outline',
        };
    }
  };

  const themeStyle = getThemeStyles();
  const iconName = icon || (themeStyle.defaultIcon as any);

  return (
    <View
      style={[
        styles.chip,
        {
          backgroundColor: themeStyle.bg,
          borderColor: themeStyle.border,
        },
        style,
      ]}>
      {iconName && (
        <MaterialCommunityIcons
          name={iconName}
          size={13}
          color={themeStyle.text}
          style={styles.icon}
        />
      )}
      <Text style={[styles.label, { color: themeStyle.text }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  icon: {
    marginRight: 4,
  },
  label: {
    fontSize: fontSizes.xs,
    fontWeight: '600',
  },
});

export default StatusChip;
