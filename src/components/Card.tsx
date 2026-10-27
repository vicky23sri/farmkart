/**
 * Reusable Card Component
 * Uses FarmKart's standard white surface, 12px border radius, and soft shadow.
 */

import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { theme } from '@/theme';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function Card({ children, style }: CardProps) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    ...theme.card,
  },
});

export default Card;
