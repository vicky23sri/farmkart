/**
 * ProductCard Component
 * Marketplace card displaying agricultural produce details:
 * image, title, farmer name, distance, unit price, rating, and Add/Quantity control.
 */

import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import {
  Image,
  ImageSourcePropType,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';

import { colors, fontSizes, spacing, theme } from '@/theme';
import { QuantitySelector } from './QuantitySelector';
import { RatingStars } from './RatingStars';

export interface ProductCardProps {
  /** Product title */
  name: string;
  /** Secondary or Tamil name */
  subtitle?: string;
  /** Name of the farmer or farm */
  farmerName: string;
  /** Distance in km from farmer to buyer */
  distanceKm: number;
  /** Price in Rupees */
  price: number;
  /** Unit of measurement (e.g. "kg", "dozen", "bundle") */
  unit?: string;
  /** Rating score (0 - 5) */
  rating: number;
  /** Image source (URL or require asset) */
  imageUri?: string;
  imageSource?: ImageSourcePropType;
  /** Whether crop is organic */
  isOrganic?: boolean;
  /** Number of items currently in cart */
  quantity?: number;
  /** Callbacks */
  onAdd?: () => void;
  onQuantityChange?: (newQuantity: number) => void;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function ProductCard({
  name,
  subtitle,
  farmerName,
  distanceKm,
  price,
  unit = 'kg',
  rating,
  imageUri,
  imageSource,
  isOrganic = false,
  quantity = 0,
  onAdd,
  onQuantityChange,
  onPress,
  style,
}: ProductCardProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        pressed && styles.cardPressed,
        style,
      ]}>
      {/* Product Image with Distance Badge */}
      <View style={styles.imageContainer}>
        {imageSource ? (
          <Image source={imageSource} style={styles.image} resizeMode="cover" />
        ) : imageUri ? (
          <Image
            source={{ uri: imageUri }}
            style={styles.image}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.imagePlaceholder}>
            <MaterialCommunityIcons
              name="sprout-outline"
              size={36}
              color={colors.primary}
            />
          </View>
        )}

        {/* Organic Badge on Top Right */}
        {isOrganic && (
          <View style={styles.organicBadge}>
            <MaterialCommunityIcons name="leaf" size={10} color={colors.white} />
            <Text style={styles.organicBadgeText}>இயற்கை</Text>
          </View>
        )}

        {/* Distance Badge on Image */}
        <View style={styles.distanceBadge}>
          <MaterialCommunityIcons
            name="map-marker-distance"
            size={12}
            color={colors.white}
          />
          <Text style={styles.distanceText}>{distanceKm.toFixed(1)} km</Text>
        </View>
      </View>

      {/* Details Section */}
      <View style={styles.infoSection}>
        {/* Name and Subtitle */}
        <View>
          <Text style={styles.productName} numberOfLines={1}>
            {name}
          </Text>
          {subtitle && (
            <Text style={styles.productSubtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>

        {/* Farmer Name with Tractor/Leaf icon */}
        <View style={styles.farmerRow}>
          <MaterialCommunityIcons
            name="account-tie-outline"
            size={14}
            color={colors.textSecondary}
          />
          <Text style={styles.farmerName} numberOfLines={1}>
            {farmerName}
          </Text>
        </View>

        {/* Rating */}
        <RatingStars rating={rating} size={13} showScore />

        {/* Price and Add / Quantity Section */}
        <View style={styles.bottomRow}>
          <View style={styles.priceColumn}>
            <View style={styles.priceRow}>
              <Text style={styles.currencySymbol}>₹</Text>
              <Text style={styles.priceAmount}>{price}</Text>
              <Text style={styles.unitText}>/{unit}</Text>
            </View>
          </View>

          {/* Add Button or Stepper if already added */}
          {quantity > 0 ? (
            <QuantitySelector
              value={quantity}
              onChange={(val) => onQuantityChange?.(val)}
              unit={unit}
              compact
            />
          ) : (
            <Pressable
              onPress={onAdd}
              hitSlop={4}
              style={styles.addButton}>
              <MaterialCommunityIcons
                name="plus"
                size={16}
                color={colors.white}
              />
              <Text style={styles.addButtonText}>ADD</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    ...theme.card,
    padding: 0, // Zero padding so image touches borders with 12px radius
    overflow: 'hidden',
  },
  cardPressed: {
    opacity: 0.95,
  },
  imageContainer: {
    width: '100%',
    height: 130,
    backgroundColor: '#EDF5EC',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  distanceBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(27, 94, 32, 0.85)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 8,
    gap: 3,
  },
  distanceText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '700',
  },
  organicBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 8,
    gap: 2,
  },
  organicBadgeText: {
    color: colors.white,
    fontSize: 9,
    fontWeight: '700',
  },
  infoSection: {
    padding: spacing.sm + 2,
    gap: 5,
  },
  productName: {
    fontSize: fontSizes.sm + 1,
    fontWeight: '700',
    color: colors.text,
  },
  productSubtitle: {
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
  },
  farmerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  farmerName: {
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  priceColumn: {
    justifyContent: 'center',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  currencySymbol: {
    fontSize: fontSizes.xs,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  priceAmount: {
    fontSize: fontSizes.md + 1,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  unitText: {
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
    marginLeft: 2,
  },
  addButton: {
    backgroundColor: colors.accent, // FarmKart orange Add button
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 2,
  },
  addButtonText: {
    color: colors.white,
    fontSize: fontSizes.xs,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});

export default ProductCard;
