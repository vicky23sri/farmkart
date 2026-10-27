/**
 * PrimaryButton Component
 * Distinctive FarmKart orange (#F57C00) call-to-action button.
 * Supports loading state, disabled styling, and icon support.
 */

import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  ViewStyle,
} from 'react-native';

import { colors, fontSizes, shadows, spacing } from '@/theme';

export interface PrimaryButtonProps {
  /** Text displayed inside the button */
  title: string;
  /** Function triggered on click/touch */
  onPress: () => void;
  /** Shows spinner and disables interaction */
  loading?: boolean;
  /** Disables press and dims button */
  disabled?: boolean;
  /** Optional icon before title */
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  /** Optional outline or dark secondary variant */
  variant?: 'primary' | 'outline' | 'secondary';
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export function PrimaryButton({
  title,
  onPress,
  loading = false,
  disabled = false,
  icon,
  variant = 'primary',
  style,
  textStyle,
}: PrimaryButtonProps) {
  const isOutline = variant === 'outline';
  const isSecondary = variant === 'secondary';

  const getContainerStyle = () => {
    if (isOutline) {
      return styles.outlineContainer;
    }
    if (isSecondary) {
      return styles.secondaryContainer;
    }
    return styles.primaryContainer;
  };

  const getTextColor = () => {
    if (disabled) return colors.textMuted;
    if (isOutline) return colors.accent;
    return colors.white;
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.baseButton,
        getContainerStyle(),
        disabled && styles.disabledButton,
        pressed && !disabled && styles.pressedButton,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator
          size="small"
          color={isOutline ? colors.accent : colors.white}
        />
      ) : (
        <>
          {icon && (
            <MaterialCommunityIcons
              name={icon}
              size={20}
              color={getTextColor()}
              style={styles.icon}
            />
          )}
          <Text
            style={[
              styles.buttonText,
              { color: getTextColor() },
              textStyle,
            ]}>
            {title}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  baseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    borderRadius: 10,
    ...shadows.soft,
  },
  primaryContainer: {
    backgroundColor: colors.accent, // Distinctive FarmKart orange
  },
  secondaryContainer: {
    backgroundColor: colors.primary, // FarmKart green
  },
  outlineContainer: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.accent,
    elevation: 0,
    shadowOpacity: 0,
  },
  disabledButton: {
    backgroundColor: colors.border,
    borderColor: colors.border,
    elevation: 0,
    shadowOpacity: 0,
  },
  pressedButton: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
  icon: {
    marginRight: spacing.xs,
  },
  buttonText: {
    fontSize: fontSizes.md,
    fontWeight: '700',
    textAlign: 'center',
  },
});

export default PrimaryButton;
