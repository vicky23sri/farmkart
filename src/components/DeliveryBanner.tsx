/**
 * DeliveryBanner Component
 * Shows delivery feasibility status based on distance from the farm:
 * - Green (< 50 km): Deliverable with distance and delivery info
 * - Red (> 50 km): Beyond 50 km limit with farm pickup advisory
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

export interface DeliveryBannerProps {
  /** Distance in kilometers from farmer location to buyer */
  distanceKm: number;
  /** Maximum deliverable range in km (default 50) */
  maxDeliverableKm?: number;
  /** Optional location name (e.g. "Kotturpuram, Chennai") */
  locationName?: string;
  /** Optional estimated delivery window (e.g. "Same-day by 6 PM") */
  deliveryTime?: string;
  style?: StyleProp<ViewStyle>;
}

export function DeliveryBanner({
  distanceKm,
  maxDeliverableKm = 50,
  locationName,
  deliveryTime,
  style,
}: DeliveryBannerProps) {
  const isWithinFreeRadius = distanceKm <= maxDeliverableKm;

  return (
    <View
      style={[
        styles.banner,
        isWithinFreeRadius ? styles.deliverableBanner : styles.amberBanner,
        style,
      ]}>
      {/* Status Icon */}
      <View
        style={[
          styles.iconContainer,
          isWithinFreeRadius ? styles.deliverableIconBg : styles.amberIconBg,
        ]}>
        <MaterialCommunityIcons
          name={isWithinFreeRadius ? 'truck-fast-outline' : 'clock-alert-outline'}
          size={20}
          color={isWithinFreeRadius ? colors.primaryDark : '#B45309'}
        />
      </View>

      {/* Message Content */}
      <View style={styles.textContainer}>
        <View style={styles.headerRow}>
          <Text
            style={[
              styles.statusTitle,
              { color: isWithinFreeRadius ? colors.primaryDark : '#92400E' },
            ]}>
            {isWithinFreeRadius
              ? `Deliverable, ${distanceKm.toFixed(0)} km away`
              : `${distanceKm.toFixed(0)} km away. Beyond our usual 50 km range.`}
          </Text>
        </View>

        <Text
          style={[
            styles.subtitle,
            { color: isWithinFreeRadius ? colors.textSecondary : '#78350F' },
          ]}>
          {isWithinFreeRadius
            ? deliveryTime
              ? `Estimated: ${deliveryTime}${locationName ? ` • ${locationName}` : ''}`
              : `Fresh farm-to-door delivery available${locationName ? ` to ${locationName}` : ''}`
            : 'The seller will confirm if delivery is possible.'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm + 2,
    borderRadius: 10,
    borderWidth: 1,
    gap: spacing.sm,
  },
  deliverableBanner: {
    backgroundColor: colors.primaryLight,
    borderColor: 'rgba(46, 125, 50, 0.3)',
  },
  amberBanner: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deliverableIconBg: {
    backgroundColor: 'rgba(46, 125, 50, 0.15)',
  },
  amberIconBg: {
    backgroundColor: '#FDE68A',
  },
  textContainer: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  statusTitle: {
    fontSize: fontSizes.sm,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: fontSizes.xs,
    marginTop: 2,
    lineHeight: 16,
  },
});

export default DeliveryBanner;
