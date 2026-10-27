/**
 * QuantitySelector Component
 * Stepper control for incrementing and decrementing produce quantity (e.g. kg, bundles).
 */

import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';

import { colors, fontSizes, spacing } from '@/theme';

export interface QuantitySelectorProps {
  /** Current quantity count */
  value: number;
  /** Callback when quantity changes */
  onChange: (newValue: number) => void;
  /** Minimum selectable quantity (default 0 or 1) */
  min?: number;
  /** Maximum allowable quantity */
  max?: number;
  /** Step increment (default 1) */
  step?: number;
  /** Optional unit label (e.g. "kg", "units", "bunch") */
  unit?: string;
  /** Compact sizing variant for cards */
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function QuantitySelector({
  value,
  onChange,
  min = 0,
  max = 999,
  step = 1,
  unit,
  compact = false,
  style,
}: QuantitySelectorProps) {
  const canDecrement = value > min;
  const canIncrement = value < max;

  const handleDecrement = () => {
    if (canDecrement) {
      const next = Math.max(min, value - step);
      onChange(next);
    }
  };

  const handleIncrement = () => {
    if (canIncrement) {
      const next = Math.min(max, value + step);
      onChange(next);
    }
  };

  return (
    <View
      style={[
        styles.container,
        compact ? styles.containerCompact : styles.containerRegular,
        style,
      ]}>
      {/* Minus Button */}
      <Pressable
        onPress={handleDecrement}
        disabled={!canDecrement}
        hitSlop={4}
        style={[
          styles.stepButton,
          !canDecrement && styles.stepButtonDisabled,
        ]}>
        <MaterialCommunityIcons
          name="minus"
          size={compact ? 16 : 18}
          color={canDecrement ? colors.primaryDark : colors.textMuted}
        />
      </Pressable>

      {/* Value Display */}
      <View style={styles.valueContainer}>
        <Text
          style={[
            styles.valueText,
            compact ? styles.valueTextCompact : styles.valueTextRegular,
          ]}>
          {value}
          {unit ? ` ${unit}` : ''}
        </Text>
      </View>

      {/* Plus Button */}
      <Pressable
        onPress={handleIncrement}
        disabled={!canIncrement}
        hitSlop={4}
        style={[
          styles.stepButton,
          !canIncrement && styles.stepButtonDisabled,
        ]}>
        <MaterialCommunityIcons
          name="plus"
          size={compact ? 16 : 18}
          color={canIncrement ? colors.primaryDark : colors.textMuted}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(46, 125, 50, 0.2)',
  },
  containerRegular: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  containerCompact: {
    paddingHorizontal: 2,
    paddingVertical: 1,
  },
  stepButton: {
    padding: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepButtonDisabled: {
    opacity: 0.4,
  },
  valueContainer: {
    minWidth: 32,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  valueText: {
    fontWeight: '700',
    color: colors.primaryDark,
  },
  valueTextRegular: {
    fontSize: fontSizes.sm,
  },
  valueTextCompact: {
    fontSize: fontSizes.xs,
  },
});

export default QuantitySelector;
