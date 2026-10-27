/**
 * RatingStars Component
 * Displays visual star ratings with half-star accuracy and optional numeric score.
 */

import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fontSizes, spacing } from '@/theme';

export interface RatingStarsProps {
  /** Score from 0 to 5 */
  rating: number;
  /** Maximum stars (default 5) */
  maxRating?: number;
  /** Size of each star icon in pixels */
  size?: number;
  /** Custom star color (defaults to accent orange) */
  color?: string;
  /** Display the numerical score next to stars (e.g. "4.8") */
  showScore?: boolean;
  /** Total review count to display in brackets (e.g. "(124)") */
  reviewsCount?: number;
}

export function RatingStars({
  rating,
  maxRating = 5,
  size = 14,
  color = colors.accent,
  showScore = true,
  reviewsCount,
}: RatingStarsProps) {
  const stars = [];

  for (let i = 1; i <= maxRating; i++) {
    if (rating >= i) {
      stars.push('star');
    } else if (rating >= i - 0.5) {
      stars.push('star-half-full');
    } else {
      stars.push('star-outline');
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.starsRow}>
        {stars.map((iconName, index) => (
          <MaterialCommunityIcons
            key={index}
            name={iconName as any}
            size={size}
            color={color}
          />
        ))}
      </View>

      {showScore && (
        <Text style={[styles.scoreText, { fontSize: size }]}>
          {rating.toFixed(1)}
        </Text>
      )}

      {reviewsCount !== undefined && (
        <Text style={styles.reviewsText}>({reviewsCount})</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
  },
  scoreText: {
    fontWeight: '700',
    color: colors.text,
  },
  reviewsText: {
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
  },
});

export default RatingStars;
