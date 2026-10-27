/**
 * Buyer Order Tracking Screen
 * Features:
 * - AppHeader on top with order reference
 * - Vertical timeline with the 6 mandatory stages:
 *   1. Order Placed
 *   2. Confirmed by Farmer
 *   3. Harvested & Packed
 *   4. Shipped from Farm
 *   5. Out for Delivery
 *   6. Delivered at Doorstep
 *   with timestamps, descriptions, and active stage indicators.
 * - Map with origin farm pin, destination pin, and moving delivery partner marker
 * - ETA and distance remaining counter
 * - Delivery partner card with Call and Chat actions
 * - COD card: "Pay Rs. X on delivery"
 * - Delivery OTP card: "Delivery OTP: [4829]"
 * - Live Seller status simulation bar to test real-time reactivity
 */

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';

import { AppHeader } from '@/components/AppHeader';
import { Card } from '@/components/Card';
import { PrimaryButton } from '@/components/PrimaryButton';
import { orderService, useOrderTracking, getStatusLabel } from '@/services/orderService';
import { OrderStatus, useLanguageStore, useOrderStore } from '@/store';
import { colors, fontSizes, shadows, spacing } from '@/theme';

const STATUS_PROGRESSION: OrderStatus[] = [
  'placed',
  'confirmed',
  'packed',
  'shipped',
  'out_for_delivery',
  'delivered',
];

export default function BuyerTrackingScreen() {
  const { orderId } = useLocalSearchParams<{ orderId?: string }>();
  const { language } = useLanguageStore();
  const { getOrderById, orders, updateOrderStatus } = useOrderStore();

  // Find target order or fallback to ongoing order or first order
  const localOrder =
    (orderId ? getOrderById(orderId) : undefined) ||
    orders.find((o) => o.tab === 'ongoing') ||
    orders[0];

  // TanStack Query polling every 15 seconds
  const { data: trackData, refetch } = useOrderTracking(localOrder?.id);

  const order = localOrder;

  if (!order) {
    return (
      <View style={styles.screen}>
        <AppHeader isSeller={false} showBack title="Tracking" />
        <View style={styles.centerContainer}>
          <Text style={styles.emptyText}>No active order to track.</Text>
          <PrimaryButton
            title="Go to Orders"
            onPress={() => router.replace('/(buyer)/(tabs)/orders')}
            style={{ marginTop: spacing.md }}
          />
        </View>
      </View>
    );
  }

  const isCOD = order.paymentMode === 'cod';
  const partner = order.deliveryPartner || {
    name: 'Senthil Kumar',
    phone: '+91 98421 99881',
    vehicleNumber: 'TN-59-BZ-4102',
    vehicleType: 'Two-Wheeler Direct Express',
    lat: 9.995,
    lng: 78.04,
    eta: '25 mins (4:45 PM)',
    distanceRemainingKm: 3.8,
  };

  // Next status for live simulation testing
  const currentIndex = STATUS_PROGRESSION.indexOf(order.status);
  const nextStatus =
    currentIndex >= 0 && currentIndex < STATUS_PROGRESSION.length - 1
      ? STATUS_PROGRESSION[currentIndex + 1]
      : null;

  const currentStatus = (trackData?.current_status || order.status) as string;

  const handleAcceptFee = async () => {
    try {
      await orderService.buyerConfirm(order.id);
      updateOrderStatus(order.id, 'confirmed');
      refetch();
      Alert.alert('Fee Accepted', 'You accepted the extra delivery charge. Order is now confirmed!');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not confirm order.');
    }
  };

  const handleCancelOrder = async () => {
    try {
      await orderService.cancelOrder(order.id);
      updateOrderStatus(order.id, 'cancelled');
      refetch();
      Alert.alert('Order Cancelled', 'Your order has been cancelled.');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not cancel order.');
    }
  };

  const handleSimulateFarmerUpdate = async () => {
    const targetStatus = nextStatus || 'confirmed';
    try {
      await orderService.updateStatus(order.id, targetStatus);
    } catch {
      // fallback
    }
    updateOrderStatus(order.id, targetStatus);
    refetch();
  };

  return (
    <View style={styles.screen}>
      <AppHeader
        isSeller={false}
        showBack
        title={language === 'ta' ? 'நேரலை விநியோகம்' : 'Live Farm Tracking'}
        showSearch={false}
        showCart={false}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* Status & ETA Header Card */}
        <Card style={styles.etaCard}>
          <View style={styles.etaHeaderRow}>
            <View style={styles.etaTextCol}>
              <View style={styles.liveIndicatorRow}>
                <View style={styles.liveDot} />
                <Text style={styles.liveTagText}>LIVE HARVEST DISPATCH</Text>
              </View>
              <Text style={styles.etaTimeText}>
                {currentStatus === 'delivered'
                  ? 'Delivered at Doorstep'
                  : trackData?.eta || partner.eta}
              </Text>
              <Text style={styles.etaSubText}>
                {getStatusLabel(currentStatus)} • {order.id}
              </Text>
            </View>

            <View style={styles.orderIdBadge}>
              <Text style={styles.orderIdBadgeText}>{order.id}</Text>
            </View>
          </View>
        </Card>

        {/* 1. Status: Waiting for seller approval */}
        {currentStatus === 'pending_seller_approval' && (
          <View style={styles.amberStatusCard}>
            <MaterialCommunityIcons name="clock-outline" size={24} color="#B45309" />
            <View style={{ flex: 1 }}>
              <Text style={styles.amberStatusTitle}>Waiting for seller approval</Text>
              <Text style={styles.amberStatusDesc}>
                Your address is beyond our usual 50 km range. The seller will check if delivery is possible.
              </Text>
            </View>
          </View>
        )}

        {/* 2. Status: Awaiting your confirmation */}
        {currentStatus === 'awaiting_buyer_confirmation' && (
          <Card style={styles.confirmationCard}>
            <View style={styles.confirmationHeader}>
              <MaterialCommunityIcons name="alert-decagram" size={24} color="#D97706" />
              <View style={{ flex: 1 }}>
                <Text style={styles.confirmationTitle}>Awaiting your confirmation</Text>
                <Text style={styles.confirmationDesc}>
                  The farmer has reviewed your extended delivery order and approved it with an additional transport fee.
                </Text>
              </View>
            </View>

            <View style={styles.feeBreakdownBox}>
              <View style={styles.feeRow}>
                <Text style={styles.feeLabel}>Extra Transport Charge:</Text>
                <Text style={styles.feeValue}>+ ₹{(order as any).extraDeliveryFee || 150}</Text>
              </View>
              <View style={styles.feeRow}>
                <Text style={[styles.feeLabel, { fontWeight: '800' }]}>Updated Total:</Text>
                <Text style={[styles.feeValue, { fontWeight: '800', color: colors.primaryDark }]}>
                  ₹{(order as any).extraDeliveryFee ? order.grandTotal + (order as any).extraDeliveryFee : order.grandTotal}
                </Text>
              </View>
            </View>

            <View style={styles.actionButtonsRow}>
              <Pressable style={styles.cancelFeeBtn} onPress={handleCancelOrder}>
                <Text style={styles.cancelFeeBtnText}>Cancel Order</Text>
              </Pressable>

              <Pressable style={styles.acceptFeeBtn} onPress={handleAcceptFee}>
                <Text style={styles.acceptFeeBtnText}>Accept & Confirm</Text>
              </Pressable>
            </View>
          </Card>
        )}

        {/* 3. Status: Rejected by seller */}
        {currentStatus === 'rejected' && (
          <View style={styles.rejectedCard}>
            <MaterialCommunityIcons name="close-circle-outline" size={24} color={colors.error} />
            <View style={{ flex: 1 }}>
              <Text style={styles.rejectedTitle}>Rejected by seller</Text>
              <Text style={styles.rejectedDesc}>
                {(order as any).rejectReason || 'Reason: Road impassable or outside feasible transport range.'}
              </Text>
            </View>
          </View>
        )}

        {/* Live Simulation Control Bar for Testing */}
        <View style={styles.simBar}>
          <View style={styles.simTextCol}>
            <Text style={styles.simTitle}>Seller Status Simulator</Text>
            <Text style={styles.simDesc}>
              Simulate farmer advancing stage from field
            </Text>
          </View>
          <Pressable
            onPress={handleSimulateFarmerUpdate}
            style={styles.simBtn}>
            <MaterialCommunityIcons
              name="play-circle-outline"
              size={16}
              color={colors.white}
            />
            <Text style={styles.simBtnText}>
              {nextStatus ? `Advance to ${nextStatus}` : 'Reset to Confirmed'}
            </Text>
          </Pressable>
        </View>

        {/* COD "Pay Rs. X on delivery" Notification Card */}
        {isCOD && (
          <View
            style={[
              styles.codCard,
              order.status === 'delivered' && styles.codCardDelivered,
            ]}>
            <View style={styles.codRow}>
              <MaterialCommunityIcons
                name={
                  order.status === 'delivered'
                    ? 'check-decagram'
                    : 'cash-multiple'
                }
                size={22}
                color={
                  order.status === 'delivered'
                    ? colors.success
                    : colors.primary
                }
              />
              <View style={styles.codTextGroup}>
                <Text
                  style={[
                    styles.codTitle,
                    order.status === 'delivered' && styles.codTitleDelivered,
                  ]}>
                  {order.status === 'delivered'
                    ? `Paid ₹${order.grandTotal} on delivery`
                    : `Pay ₹${order.grandTotal} on delivery`}
                </Text>
                <Text style={styles.codSubtitle}>
                  {order.status === 'delivered'
                    ? 'Cash on Delivery payment received & verified'
                    : 'Cash on Delivery collection by delivery partner'}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Delivery OTP Card */}
        <Card style={styles.otpCard}>
          <View style={styles.otpLeft}>
            <MaterialCommunityIcons
              name={
                order.status === 'delivered'
                  ? 'shield-check'
                  : 'shield-key-outline'
              }
              size={22}
              color={
                order.status === 'delivered' ? colors.success : colors.accent
              }
            />
            <View>
              <Text style={styles.otpLabel}>
                {order.status === 'delivered'
                  ? 'Delivery Verified'
                  : 'Delivery Security OTP'}
              </Text>
              <Text style={styles.otpSub}>
                {order.status === 'delivered'
                  ? 'Produce delivered with OTP authentication'
                  : 'Share only upon receiving produce'}
              </Text>
            </View>
          </View>
          <View
            style={[
              styles.otpPill,
              order.status === 'delivered' && styles.otpPillVerified,
            ]}>
            <Text
              style={[
                styles.otpCode,
                order.status === 'delivered' && styles.otpCodeVerified,
              ]}>
              {order.deliveryOtp}
            </Text>
          </View>
        </Card>

        {/* Map with Delivery Partner Marker */}
        <Card style={styles.mapCard}>
          <Text style={styles.cardTitle}>Live Route Map</Text>
          <View style={styles.mapWrap}>
            {Platform.OS !== 'web' ? (
              <MapView
                style={styles.mapView}
                initialRegion={{
                  latitude: partner.lat,
                  longitude: partner.lng,
                  latitudeDelta: 0.12,
                  longitudeDelta: 0.12,
                }}>
                {/* Farmer / Origin Marker */}
                <Marker
                  coordinate={{
                    latitude: order.sellerLat,
                    longitude: order.sellerLng,
                  }}
                  title={order.sellerFarm}
                  description="Origin Farm"
                  pinColor="green"
                />

                {/* Buyer / Destination Marker */}
                <Marker
                  coordinate={{
                    latitude: 9.9252,
                    longitude: 78.1198,
                  }}
                  title="Your Doorstep"
                  description={order.deliveryAddress}
                  pinColor="red"
                />

                {/* Live Delivery Partner Marker */}
                <Marker
                  coordinate={{
                    latitude: partner.lat,
                    longitude: partner.lng,
                  }}
                  title={partner.name}
                  description={`${partner.vehicleType} (${partner.vehicleNumber})`}
                />
              </MapView>
            ) : (
              // Cross-platform Web Simulation Card
              <View style={styles.mapWebFallback}>
                <View style={styles.routeIllustration}>
                  <View style={styles.routePoint}>
                    <MaterialCommunityIcons
                      name="sprout"
                      size={20}
                      color={colors.primary}
                    />
                    <Text style={styles.routePointLabel}>{order.sellerVillage}</Text>
                  </View>

                  <View style={styles.routeLine}>
                    <View style={styles.partnerMarkerCircle}>
                      <MaterialCommunityIcons
                        name="truck-fast"
                        size={18}
                        color={colors.white}
                      />
                    </View>
                  </View>

                  <View style={styles.routePoint}>
                    <MaterialCommunityIcons
                      name="home"
                      size={20}
                      color={colors.accent}
                    />
                    <Text style={styles.routePointLabel}>Doorstep</Text>
                  </View>
                </View>

                <Text style={styles.mapCoordText}>
                  Partner Location: {partner.lat.toFixed(4)}°N,{' '}
                  {partner.lng.toFixed(4)}°E • {partner.vehicleNumber}
                </Text>
              </View>
            )}
          </View>
        </Card>

        {/* Delivery Partner Contact Card with Call and Chat */}
        <Card style={styles.partnerCard}>
          <View style={styles.partnerRow}>
            <View style={styles.driverAvatar}>
              <MaterialCommunityIcons
                name="account-hard-hat"
                size={28}
                color={colors.primary}
              />
            </View>
            <View style={styles.driverInfoCol}>
              <Text style={styles.driverName}>{partner.name}</Text>
              <Text style={styles.driverVehicle}>
                {partner.vehicleType} • {partner.vehicleNumber}
              </Text>
              <Text style={styles.driverRating}>4.9 ★ Verified Partner</Text>
            </View>

            {/* Call and Chat Buttons */}
            <View style={styles.contactButtonsRow}>
              {/* Call Button */}
              <Pressable
                onPress={() =>
                  Alert.alert(
                    'Call Driver',
                    `Calling delivery partner ${partner.name} at ${partner.phone}`
                  )
                }
                style={styles.callBtn}>
                <MaterialCommunityIcons
                  name="phone"
                  size={18}
                  color={colors.white}
                />
              </Pressable>

              {/* Chat Button */}
              <Pressable
                onPress={() =>
                  Alert.alert(
                    'Chat with Driver',
                    `Opening direct message to ${partner.name}: "I am at the doorstep/gate."`
                  )
                }
                style={styles.chatBtn}>
                <MaterialCommunityIcons
                  name="message-text-outline"
                  size={18}
                  color={colors.primaryDark}
                />
              </Pressable>
            </View>
          </View>
        </Card>

        {/* Vertical Tracking Timeline */}
        <Card style={styles.timelineCard}>
          <Text style={styles.cardTitle}>
            {language === 'ta'
              ? 'விநியோக காலவரிசை'
              : 'Harvest & Delivery Timeline'}
          </Text>

          <View style={styles.timelineContainer}>
            {order.timeline.map((step, idx) => {
              const isLast = idx === order.timeline.length - 1;

              return (
                <View key={step.status} style={styles.timelineRow}>
                  {/* Left Column: Icon Circle and Connecting Vertical Line */}
                  <View style={styles.stepperCol}>
                    <View
                      style={[
                        styles.stepperDot,
                        step.done
                          ? styles.stepperDotDone
                          : step.current
                          ? styles.stepperDotCurrent
                          : styles.stepperDotPending,
                      ]}>
                      {step.done ? (
                        <MaterialCommunityIcons
                          name="check"
                          size={14}
                          color={colors.white}
                        />
                      ) : step.current ? (
                        <View style={styles.activeGlowPulse} />
                      ) : (
                        <View style={styles.pendingInnerDot} />
                      )}
                    </View>

                    {!isLast && (
                      <View
                        style={[
                          styles.verticalLine,
                          step.done && styles.verticalLineDone,
                        ]}
                      />
                    )}
                  </View>

                  {/* Right Column: Step Title, Description, and Timestamp */}
                  <View style={styles.stepperContentCol}>
                    <View style={styles.stepTitleRow}>
                      <Text
                        style={[
                          styles.stepTitleText,
                          step.done && styles.stepTitleDone,
                          step.current && styles.stepTitleCurrent,
                        ]}>
                        {language === 'ta' ? step.titleTamil : step.title}
                      </Text>
                      {step.time && (
                        <Text style={styles.stepTimestamp}>{step.time}</Text>
                      )}
                    </View>

                    <Text style={styles.stepDesc}>{step.description}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </Card>

        {/* View Order Detail CTA */}
        <Pressable
          onPress={() =>
            router.push({
              pathname: '/(buyer)/order-detail',
              params: { id: order.id },
            })
          }
          style={styles.orderDetailBtn}>
          <MaterialCommunityIcons
            name="receipt"
            size={18}
            color={colors.primaryDark}
          />
          <Text style={styles.orderDetailBtnText}>
            View Full Order Receipt & Invoice
          </Text>
          <MaterialCommunityIcons
            name="chevron-right"
            size={18}
            color={colors.primaryDark}
          />
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  emptyText: {
    fontSize: fontSizes.md,
    color: colors.textSecondary,
  },
  etaCard: {
    backgroundColor: colors.primaryDark,
    borderRadius: 16,
    padding: spacing.md,
  },
  etaHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  etaTextCol: {
    flex: 1,
  },
  liveIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00E676',
  },
  liveTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#00E676',
    letterSpacing: 0.5,
  },
  etaTimeText: {
    fontSize: fontSizes.lg + 2,
    fontWeight: '900',
    color: colors.white,
  },
  etaSubText: {
    fontSize: fontSizes.xs,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  orderIdBadge: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  orderIdBadgeText: {
    color: colors.white,
    fontSize: fontSizes.xs,
    fontWeight: '700',
  },
  simBar: {
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
  simTextCol: {
    flex: 1,
  },
  simTitle: {
    fontSize: fontSizes.xs + 1,
    fontWeight: '700',
    color: colors.text,
  },
  simDesc: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 1,
  },
  simBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  simBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.white,
  },
  codCard: {
    backgroundColor: '#E8F5E9',
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 12,
    padding: spacing.sm + 2,
  },
  codCardDelivered: {
    backgroundColor: '#E8F5E9',
    borderColor: colors.success,
  },
  codRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  codTextGroup: {
    flex: 1,
  },
  codTitle: {
    fontSize: fontSizes.sm,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  codTitleDelivered: {
    color: colors.success,
  },
  codSubtitle: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  otpCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF8E1',
    borderWidth: 1,
    borderColor: '#FFE082',
    padding: spacing.sm + 2,
  },
  otpLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  otpLabel: {
    fontSize: fontSizes.xs + 1,
    fontWeight: '800',
    color: colors.text,
  },
  otpSub: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 1,
  },
  otpPill: {
    backgroundColor: colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  otpPillVerified: {
    backgroundColor: '#E8F5E9',
    borderWidth: 1,
    borderColor: colors.success,
  },
  otpCode: {
    fontSize: fontSizes.md,
    fontWeight: '900',
    color: colors.white,
    letterSpacing: 2,
  },
  otpCodeVerified: {
    color: colors.success,
  },
  mapCard: {
    gap: spacing.xs + 2,
  },
  cardTitle: {
    fontSize: fontSizes.sm + 1,
    fontWeight: '800',
    color: colors.text,
  },
  mapWrap: {
    height: 180,
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 4,
    position: 'relative',
  },
  mapView: {
    width: '100%',
    height: '100%',
  },
  mapWebFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: '#EDF5EC',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    gap: spacing.sm,
  },
  routeIllustration: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '90%',
    justifyContent: 'space-between',
  },
  routePoint: {
    alignItems: 'center',
    gap: 2,
  },
  routePointLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  routeLine: {
    flex: 1,
    height: 4,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
    position: 'relative',
  },
  partnerMarkerCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.soft,
  },
  mapCoordText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  partnerCard: {
    padding: spacing.sm + 2,
  },
  partnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  driverAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverInfoCol: {
    flex: 1,
  },
  driverName: {
    fontSize: fontSizes.sm,
    fontWeight: '800',
    color: colors.text,
  },
  driverVehicle: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  driverRating: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
    marginTop: 2,
  },
  contactButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  callBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(46, 125, 50, 0.3)',
  },
  timelineCard: {
    gap: spacing.md,
  },
  timelineContainer: {
    paddingTop: 4,
  },
  timelineRow: {
    flexDirection: 'row',
    minHeight: 56,
  },
  stepperCol: {
    alignItems: 'center',
    width: 32,
    marginRight: spacing.sm,
  },
  stepperDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  stepperDotDone: {
    backgroundColor: colors.primary,
  },
  stepperDotCurrent: {
    backgroundColor: colors.primary,
    borderWidth: 3,
    borderColor: colors.primaryLight,
  },
  stepperDotPending: {
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  activeGlowPulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.white,
  },
  pendingInnerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.textMuted,
  },
  verticalLine: {
    flex: 1,
    width: 2,
    backgroundColor: colors.border,
    marginVertical: 2,
  },
  verticalLineDone: {
    backgroundColor: colors.primary,
  },
  stepperContentCol: {
    flex: 1,
    paddingBottom: spacing.sm + 2,
  },
  stepTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stepTitleText: {
    fontSize: fontSizes.xs + 1,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  stepTitleDone: {
    color: colors.text,
    fontWeight: '700',
  },
  stepTitleCurrent: {
    color: colors.primaryDark,
    fontWeight: '900',
    fontSize: fontSizes.sm,
  },
  stepTimestamp: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: '600',
  },
  stepDesc: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 15,
  },
  orderDetailBtn: {
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
  orderDetailBtnText: {
    fontSize: fontSizes.xs + 1,
    fontWeight: '700',
    color: colors.primaryDark,
    flex: 1,
    marginHorizontal: spacing.xs,
  },
  amberStatusCard: {
    flexDirection: 'row',
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  amberStatusTitle: {
    fontSize: fontSizes.sm,
    fontWeight: '800',
    color: '#92400E',
    marginBottom: 4,
  },
  amberStatusDesc: {
    fontSize: fontSizes.xs,
    color: '#78350F',
    lineHeight: 16,
  },
  confirmationCard: {
    padding: spacing.md,
    backgroundColor: '#FFFBEB',
    borderColor: '#F59E0B',
    borderWidth: 1,
    gap: spacing.sm,
  },
  confirmationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  confirmationTitle: {
    fontSize: fontSizes.sm,
    fontWeight: '800',
    color: '#92400E',
  },
  confirmationDesc: {
    fontSize: fontSizes.xs,
    color: '#78350F',
    marginTop: 2,
    lineHeight: 16,
  },
  feeBreakdownBox: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    padding: spacing.sm,
    borderRadius: 8,
    gap: 4,
  },
  feeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  feeLabel: {
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
  },
  feeValue: {
    fontSize: fontSizes.xs,
    color: colors.text,
    fontWeight: '700',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: 4,
  },
  cancelFeeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  cancelFeeBtnText: {
    fontSize: fontSizes.xs + 1,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  acceptFeeBtn: {
    flex: 1.5,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  acceptFeeBtnText: {
    fontSize: fontSizes.xs + 1,
    fontWeight: '800',
    color: colors.white,
  },
  rejectedCard: {
    flexDirection: 'row',
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#EF4444',
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  rejectedTitle: {
    fontSize: fontSizes.sm,
    fontWeight: '800',
    color: '#991B1B',
    marginBottom: 4,
  },
  rejectedDesc: {
    fontSize: fontSizes.xs,
    color: '#7F1D1D',
    lineHeight: 16,
  },
});
