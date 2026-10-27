/**
 * Buyer Cart Screen
 * Features:
 * - AppHeader with cart counter and back/home actions
 * - Real-time distance calculation to each item's farmer using buyer's location
 * - DeliveryBanner indicating feasibility (Green <= 50 km, Red > 50 km)
 * - Quantity modification & item removal
 * - Load-based delivery fee (Bike under 10 km, Mini Truck, Tractor for bulk)
 * - Coupon field with instant application & discount display
 * - Strict 50 km checkout blocker with informative alert banner
 */

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { Card } from '@/components/Card';
import { DeliveryBanner } from '@/components/DeliveryBanner';
import { EmptyState } from '@/components/EmptyState';
import { PrimaryButton } from '@/components/PrimaryButton';
import { QuantitySelector } from '@/components/QuantitySelector';
import { useCartStore, useLanguageStore, useLocationStore } from '@/store';
import { colors, fontSizes, shadows, spacing } from '@/theme';
import { formatDistance } from '@/utils/distance';

export default function BuyerCartScreen() {
  const { language } = useLanguageStore();
  const {
    currentLocation,
    maxDeliveryRadiusKm,
    requestAndFetchCurrentLocation,
    isLocating,
  } = useLocationStore();

  const {
    items,
    updateQuantity,
    removeItem,
    clearCart,
    getSubtotal,
    couponCode,
    couponDiscount,
    couponError,
    applyCoupon,
    removeCoupon,
    getDeliveryBreakdown,
    getItemsWithDistance,
    hasOutOfRangeItems,
    getOutOfRangeItems,
  } = useCartStore();

  const [inputCoupon, setInputCoupon] = useState('');

  const itemsWithDistance = getItemsWithDistance(
    currentLocation.lat,
    currentLocation.lng
  );
  const deliveryBreakdown = getDeliveryBreakdown(
    currentLocation.lat,
    currentLocation.lng
  );
  const isBlocked = hasOutOfRangeItems(
    currentLocation.lat,
    currentLocation.lng,
    maxDeliveryRadiusKm
  );
  const outOfRangeList = getOutOfRangeItems(
    currentLocation.lat,
    currentLocation.lng,
    maxDeliveryRadiusKm
  );

  const subtotal = getSubtotal();
  const deliveryFee = deliveryBreakdown.fee;
  const grandTotal = Math.max(0, subtotal - couponDiscount + deliveryFee);

  const handleApplyCoupon = () => {
    if (!inputCoupon.trim()) return;
    const res = applyCoupon(inputCoupon);
    if (res.success) {
      setInputCoupon('');
    }
  };

  const handleProceedToCheckout = () => {
    // Both standard (<=50km) and extended (>50km) delivery can proceed to checkout
    router.push('/(buyer)/checkout');
  };

  return (
    <View style={styles.screen}>
      <AppHeader
        isSeller={false}
        title={language === 'ta' ? 'உழவர் கூடை' : 'Harvest Basket'}
        cartCount={items.reduce((s, i) => s + i.quantity, 0)}
        showSearch={false}
        showCart={false}
      />

      {items.length === 0 ? (
        <EmptyState
          title={
            language === 'ta'
              ? 'உங்கள் கூடை காலியாக உள்ளது'
              : 'Your Basket is Empty'
          }
          description={
            language === 'ta'
              ? 'விவசாயிகளிடமிருந்து புதிய விளைபொருட்களைச் சேர்க்கவும்.'
              : 'Add fresh farm harvest directly from local sellers.'
          }
          icon="basket-outline"
          actionLabel={
            language === 'ta' ? 'பொருட்களை உலாவுக' : 'Explore Fresh Harvest'
          }
          onAction={() => router.push('/(buyer)/(tabs)')}
        />
      ) : (
        <View style={styles.container}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}>
            {/* Location & GPS Banner */}
            <View style={styles.locationBar}>
              <View style={styles.locationInfoCol}>
                <View style={styles.locationHeaderRow}>
                  <MaterialCommunityIcons
                    name="map-marker"
                    size={16}
                    color={colors.primary}
                  />
                  <Text style={styles.locationTitle}>
                    {language === 'ta' ? 'விநியோக இடம்:' : 'Delivering to:'}
                  </Text>
                  <Text style={styles.locationName} numberOfLines={1}>
                    {currentLocation.name}
                  </Text>
                </View>
                <Text style={styles.locationAddress} numberOfLines={1}>
                  {currentLocation.address}
                </Text>
              </View>

              <Pressable
                onPress={() => requestAndFetchCurrentLocation()}
                disabled={isLocating}
                style={styles.gpsDetectBtn}>
                {isLocating ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <>
                    <MaterialCommunityIcons
                      name="crosshairs-gps"
                      size={15}
                      color={colors.primaryDark}
                    />
                    <Text style={styles.gpsDetectText}>GPS</Text>
                  </>
                )}
              </Pressable>
            </View>

            {/* Delivery Feasibility Banner */}
            <DeliveryBanner
              distanceKm={deliveryBreakdown.maxDistanceKm}
              maxDeliverableKm={maxDeliveryRadiusKm}
              locationName={currentLocation.name}
              deliveryTime="Same-day dispatch directly from farm"
            />

            {/* Out of range blocker notice */}
            {isBlocked && (
              <View style={styles.blockedAlertCard}>
                <View style={styles.blockedAlertHeader}>
                  <MaterialCommunityIcons
                    name="alert-octagon"
                    size={22}
                    color={colors.error}
                  />
                  <Text style={styles.blockedAlertTitle}>
                    {language === 'ta'
                      ? '50 கி.மீ தூர வரம்பு மீறப்பட்டது!'
                      : 'Delivery Blocked (> 50 km Limit)'}
                  </Text>
                </View>
                <Text style={styles.blockedAlertDesc}>
                  {language === 'ta'
                    ? 'கீழே சிவப்பு நிறத்தில் குறிக்கப்பட்டுள்ள பொருட்கள் 50 கி.மீ விநியோக தூரத்தை தாண்டி உள்ளன. ஆர்டர் செய்ய அவற்றை அகற்றவும்.'
                    : 'The following item(s) exceed the 50 km direct doorstep limit. Please remove them to proceed with checkout:'}
                </Text>
                <View style={styles.blockedItemsList}>
                  {outOfRangeList.map((item) => (
                    <View key={item.id} style={styles.blockedItemRow}>
                      <Text style={styles.blockedItemName} numberOfLines={1}>
                        • {item.product.name} ({formatDistance(item.distanceKm)})
                      </Text>
                      <Pressable
                        onPress={() => removeItem(item.id)}
                        hitSlop={6}
                        style={styles.blockedRemoveBtn}>
                        <Text style={styles.blockedRemoveBtnText}>Remove</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Cart Items List */}
            <View style={styles.itemsSection}>
              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionTitle}>
                  {language === 'ta' ? 'கூடை பொருட்கள்' : 'Basket Items'} (
                  {items.length})
                </Text>
                <Pressable onPress={() => clearCart()} hitSlop={6}>
                  <Text style={styles.clearAllText}>
                    {language === 'ta' ? 'அனைத்தும் நீக்கு' : 'Clear All'}
                  </Text>
                </Pressable>
              </View>

              <View style={styles.itemsList}>
                {itemsWithDistance.map((item) => {
                  const itemSubtotal = item.product.price * item.quantity;
                  const itemIsDeliverable = item.isDeliverable;

                  return (
                    <Card
                      key={item.id}
                      style={[
                        styles.cartCard,
                        !itemIsDeliverable && styles.cartCardOutOfRange,
                      ]}>
                      <View style={styles.cardMainRow}>
                        {/* Image */}
                        <Image
                          source={{ uri: item.product.images[0] }}
                          style={styles.itemImage}
                          resizeMode="cover"
                        />

                        {/* Details */}
                        <View style={styles.itemDetailsCol}>
                          <View style={styles.itemTitleRow}>
                            <Text style={styles.itemName} numberOfLines={1}>
                              {item.product.name}
                            </Text>
                            <Pressable
                              onPress={() => removeItem(item.id)}
                              hitSlop={6}>
                              <MaterialCommunityIcons
                                name="trash-can-outline"
                                size={18}
                                color={colors.textMuted}
                              />
                            </Pressable>
                          </View>

                          <Text style={styles.itemFarmerText} numberOfLines={1}>
                            {item.product.sellerName} • {item.product.village}
                          </Text>

                          {/* Distance & Deliverability Tag */}
                          <View style={styles.distanceBadgeRow}>
                            <View
                              style={[
                                styles.distancePill,
                                !itemIsDeliverable
                                  ? styles.distancePillRed
                                  : styles.distancePillGreen,
                              ]}>
                              <MaterialCommunityIcons
                                name={
                                  itemIsDeliverable
                                    ? 'check-circle'
                                    : 'alert-circle'
                                }
                                size={12}
                                color={
                                  itemIsDeliverable
                                    ? colors.primaryDark
                                    : '#B45309'
                                }
                              />
                              <Text
                                style={[
                                  styles.distancePillText,
                                  {
                                    color: itemIsDeliverable
                                      ? colors.primaryDark
                                      : '#B45309',
                                  },
                                ]}>
                                {formatDistance(item.distanceKm)}{' '}
                                {itemIsDeliverable ? 'Deliverable' : 'Extended (>50 km)'}
                              </Text>
                            </View>

                            {item.product.isOrganic && (
                              <View style={styles.organicTag}>
                                <Text style={styles.organicTagText}>இயற்கை</Text>
                              </View>
                            )}
                          </View>

                          {/* Bottom Row: Price and Stepper */}
                          <View style={styles.cardBottomRow}>
                            <View>
                              <Text style={styles.unitPriceText}>
                                ₹{item.product.price} / {item.selectedUnit}
                              </Text>
                              <Text style={styles.itemTotalText}>
                                ₹{itemSubtotal}
                              </Text>
                            </View>

                            <QuantitySelector
                              value={item.quantity}
                              onChange={(qty) => updateQuantity(item.id, qty)}
                              unit={item.selectedUnit}
                              min={0}
                              compact
                            />
                          </View>
                        </View>
                      </View>
                    </Card>
                  );
                })}
              </View>
            </View>

            {/* Load & Vehicle Breakdown Banner */}
            <Card style={styles.vehicleCard}>
              <View style={styles.vehicleHeaderRow}>
                <View style={styles.vehicleIconCircle}>
                  <MaterialCommunityIcons
                    name={
                      deliveryBreakdown.vehicleTier === 'tractor'
                        ? 'tractor'
                        : deliveryBreakdown.vehicleTier === 'mini_truck'
                        ? 'truck-cargo-container'
                        : 'motorbike'
                    }
                    size={24}
                    color={colors.primary}
                  />
                </View>
                <View style={styles.vehicleTextGroup}>
                  <Text style={styles.vehicleTitle}>
                    {deliveryBreakdown.vehicleName}
                  </Text>
                  <Text style={styles.vehicleSubtitle}>
                    {deliveryBreakdown.description}
                  </Text>
                </View>
                <Text style={styles.vehicleFeeAmount}>
                  ₹{deliveryBreakdown.fee}
                </Text>
              </View>
            </Card>

            {/* Coupon Code Section */}
            <Card style={styles.couponCard}>
              <Text style={styles.couponHeading}>
                {language === 'ta' ? 'தள்ளுபடி கூப்பன்' : 'Apply Coupon'}
              </Text>

              {couponCode ? (
                <View style={styles.appliedCouponRow}>
                  <View style={styles.appliedCouponLeft}>
                    <MaterialCommunityIcons
                      name="ticket-percent"
                      size={20}
                      color={colors.primary}
                    />
                    <View>
                      <Text style={styles.appliedCouponCode}>
                        {couponCode} APPLIED
                      </Text>
                      <Text style={styles.appliedCouponSavings}>
                        Saved ₹{couponDiscount} on this harvest order!
                      </Text>
                    </View>
                  </View>
                  <Pressable onPress={removeCoupon} hitSlop={8}>
                    <Text style={styles.removeCouponText}>Remove</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.couponInputRow}>
                  <TextInput
                    style={styles.couponInput}
                    placeholder="Enter FARM50 or UZHAVAN10"
                    placeholderTextColor={colors.textMuted}
                    value={inputCoupon}
                    onChangeText={setInputCoupon}
                    autoCapitalize="characters"
                  />
                  <Pressable
                    onPress={handleApplyCoupon}
                    style={styles.applyCouponBtn}>
                    <Text style={styles.applyCouponBtnText}>Apply</Text>
                  </Pressable>
                </View>
              )}

              {couponError && (
                <Text style={styles.couponErrorText}>{couponError}</Text>
              )}
            </Card>

            {/* Bill Details */}
            <Card style={styles.billCard}>
              <Text style={styles.billTitle}>
                {language === 'ta' ? 'விலை விபரம்' : 'Order Bill Summary'}
              </Text>

              <View style={styles.billRow}>
                <Text style={styles.billLabel}>
                  {language === 'ta' ? 'பொருட்கள் மொத்தம்' : 'Items Subtotal'}
                </Text>
                <Text style={styles.billValue}>₹{subtotal}</Text>
              </View>

              {couponDiscount > 0 && (
                <View style={styles.billRow}>
                  <Text style={[styles.billLabel, { color: colors.primary }]}>
                    Coupon Discount ({couponCode})
                  </Text>
                  <Text style={[styles.billValue, { color: colors.primary }]}>
                    - ₹{couponDiscount}
                  </Text>
                </View>
              )}

              <View style={styles.billRow}>
                <View>
                  <Text style={styles.billLabel}>
                    {language === 'ta' ? 'விநியோக கட்டணம்' : 'Farm Direct Delivery'}
                  </Text>
                  <Text style={styles.billSubNote}>
                    {deliveryBreakdown.vehicleName}
                  </Text>
                </View>
                <Text style={styles.billValue}>₹{deliveryFee}</Text>
              </View>

              <View style={[styles.billRow, styles.grandTotalRow]}>
                <Text style={styles.grandTotalLabel}>
                  {language === 'ta' ? 'மொத்த தொகை' : 'Grand Total'}
                </Text>
                <Text style={styles.grandTotalValue}>₹{grandTotal}</Text>
              </View>
            </Card>
          </ScrollView>

          {/* Sticky Checkout Bar */}
          <View style={styles.footer}>
            <View>
              <Text style={styles.footerLabel}>Grand Total</Text>
              <Text style={styles.footerAmount}>₹{grandTotal}</Text>
            </View>

            <PrimaryButton
              title={
                isBlocked
                  ? language === 'ta'
                    ? 'விநியோகக் கோரிக்கை தொடரவும் (>50 கி.மீ)'
                    : 'Request Delivery (>50 km)'
                  : language === 'ta'
                  ? 'செக்அவுட் தொடரவும்'
                  : 'Proceed to Checkout'
              }
              icon="arrow-right"
              onPress={handleProceedToCheckout}
              disabled={false}
              style={[
                styles.checkoutBtn,
                isBlocked && { backgroundColor: '#D97706' },
              ]}
            />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: 110,
  },
  locationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    padding: spacing.sm + 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.soft,
  },
  locationInfoCol: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  locationHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  locationName: {
    fontSize: fontSizes.xs + 1,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  locationAddress: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  gpsDetectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    gap: 4,
  },
  gpsDetectText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  blockedAlertCard: {
    backgroundColor: '#FFEBEE',
    borderWidth: 1.5,
    borderColor: colors.error,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.xs,
  },
  blockedAlertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  blockedAlertTitle: {
    fontSize: fontSizes.sm + 1,
    fontWeight: '800',
    color: colors.error,
  },
  blockedAlertDesc: {
    fontSize: fontSizes.xs,
    color: '#B71C1C',
    lineHeight: 18,
  },
  blockedItemsList: {
    marginTop: 4,
    gap: 4,
  },
  blockedItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  blockedItemName: {
    fontSize: fontSizes.xs,
    color: colors.error,
    fontWeight: '700',
    flex: 1,
  },
  blockedRemoveBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: '#FFCDD2',
    borderRadius: 4,
  },
  blockedRemoveBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.error,
  },
  itemsSection: {
    gap: spacing.xs + 2,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: fontSizes.sm + 2,
    fontWeight: '800',
    color: colors.text,
  },
  clearAllText: {
    fontSize: fontSizes.xs,
    color: colors.error,
    fontWeight: '700',
  },
  itemsList: {
    gap: spacing.sm,
  },
  cartCard: {
    padding: spacing.sm + 2,
  },
  cartCardOutOfRange: {
    borderColor: 'rgba(211, 47, 47, 0.5)',
    borderWidth: 1.5,
    backgroundColor: '#FFF8F8',
  },
  cardMainRow: {
    flexDirection: 'row',
    gap: spacing.sm + 2,
  },
  itemImage: {
    width: 72,
    height: 72,
    borderRadius: 8,
    backgroundColor: colors.surfaceSecondary,
  },
  itemDetailsCol: {
    flex: 1,
    gap: 4,
  },
  itemTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemName: {
    fontSize: fontSizes.sm,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
    paddingRight: 4,
  },
  itemFarmerText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  distanceBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  distancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 3,
  },
  distancePillGreen: {
    backgroundColor: colors.primaryLight,
  },
  distancePillRed: {
    backgroundColor: '#FFEBEE',
  },
  distancePillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  organicTag: {
    backgroundColor: colors.primary,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  organicTagText: {
    color: colors.white,
    fontSize: 9,
    fontWeight: '800',
  },
  cardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  unitPriceText: {
    fontSize: 11,
    color: colors.textMuted,
  },
  itemTotalText: {
    fontSize: fontSizes.sm + 1,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  vehicleCard: {
    backgroundColor: colors.surface,
  },
  vehicleHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  vehicleIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicleTextGroup: {
    flex: 1,
  },
  vehicleTitle: {
    fontSize: fontSizes.xs + 1,
    fontWeight: '800',
    color: colors.text,
  },
  vehicleSubtitle: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  vehicleFeeAmount: {
    fontSize: fontSizes.sm + 2,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  couponCard: {
    gap: spacing.xs + 2,
  },
  couponHeading: {
    fontSize: fontSizes.xs + 1,
    fontWeight: '700',
    color: colors.text,
  },
  couponInputRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  couponInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: fontSizes.xs + 1,
    backgroundColor: colors.surfaceSecondary,
    color: colors.text,
  },
  applyCouponBtn: {
    backgroundColor: colors.primaryDark,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyCouponBtnText: {
    color: colors.white,
    fontSize: fontSizes.xs,
    fontWeight: '800',
  },
  appliedCouponRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    padding: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(46, 125, 50, 0.25)',
  },
  appliedCouponLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    flex: 1,
  },
  appliedCouponCode: {
    fontSize: fontSizes.xs,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  appliedCouponSavings: {
    fontSize: 11,
    color: colors.primary,
    marginTop: 1,
  },
  removeCouponText: {
    fontSize: fontSizes.xs,
    fontWeight: '700',
    color: colors.error,
  },
  couponErrorText: {
    fontSize: 11,
    color: colors.error,
    marginTop: 2,
  },
  billCard: {
    gap: spacing.xs + 4,
  },
  billTitle: {
    fontSize: fontSizes.sm + 1,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 4,
  },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  billLabel: {
    fontSize: fontSizes.xs + 1,
    color: colors.textSecondary,
  },
  billSubNote: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 1,
  },
  billValue: {
    fontSize: fontSizes.xs + 1,
    fontWeight: '700',
    color: colors.text,
  },
  grandTotalRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.xs + 2,
    marginTop: 4,
  },
  grandTotalLabel: {
    fontSize: fontSizes.sm + 1,
    fontWeight: '800',
    color: colors.text,
  },
  grandTotalValue: {
    fontSize: fontSizes.md + 2,
    fontWeight: '900',
    color: colors.primaryDark,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    ...shadows.medium,
  },
  footerLabel: {
    fontSize: 10,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  footerAmount: {
    fontSize: fontSizes.lg,
    fontWeight: '900',
    color: colors.primaryDark,
  },
  checkoutBtn: {
    minWidth: 200,
  },
  checkoutBtnBlocked: {
    backgroundColor: colors.textMuted,
  },
});
