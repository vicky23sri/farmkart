/**
 * CategoryChip Component
 * Horizontal selectable filter chip for agricultural produce categories.
 */

import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  ViewStyle,
} from 'react-native';

import { colors, fontSizes, spacing } from '@/theme';

export interface CategoryChipProps {
  /** Category label (e.g. "Vegetables", "காய்கறிகள்") */
  label: string;
  /** MaterialCommunityIcons icon name */
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  /** Active selection state */
  selected?: boolean;
  /** Press handler */
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

export function CategoryChip({
  label,
  icon,
  selected = false,
  onPress,
  style,
}: CategoryChipProps) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        selected ? styles.chipSelected : styles.chipUnselected,
        style,
      ]}>
      {icon && (
        <MaterialCommunityIcons
          name={icon}
          size={16}
          color={selected ? colors.white : colors.primaryDark}
          style={styles.icon}
        />
      )}
      <Text
        style={[
          styles.label,
          selected ? styles.labelSelected : styles.labelUnselected,
        ]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: spacing.md - 2,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipUnselected: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  icon: {
    marginRight: 6,
  },
  label: {
    fontSize: fontSizes.xs + 1,
    fontWeight: '600',
  },
  labelSelected: {
    color: colors.white,
  },
  labelUnselected: {
    color: colors.text,
  },
});

export default CategoryChip;
