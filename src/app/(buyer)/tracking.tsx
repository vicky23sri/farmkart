/**
 * Buyer Order Tracking Screen
 * - Live status from the API (polled every 15 seconds)
 * - Extended-delivery fee confirmation / cancellation
 * - COD amount and delivery handover OTP
 * - Call the farmer directly
 * - Vertical timeline built from the server's status history
 */

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { Card } from '@/components/Card';
import { PrimaryButton } from '@/components/PrimaryButton';
import {
  getStatusLabel,
  invalidateOrderQueries,
  orderService,
  useOrder,
  useOrderTracking,
} from '@/services/orderService';
import { useLanguageStore } from '@/store';
import { colors, fontSizes, shadows, spacing } from '@/theme';

export default function BuyerTrackingScreen() {
  const { orderId } = useLocalSearchParams<{ orderId?: string }>();
  const { language } = useLanguageStore();
  const queryClient = useQueryClient();
  const [isMutating, setIsMutating] = useState(false);

  const { data: order, isLoading, isError, error, refetch } = useOrder(orderId);
  const { data: trackData } = useOrderTracking(orderId);

  if (isLoading) {
    return (
      <View style={styles.screen}>
        <AppHeader isSeller={false} showBack title="Tracking" />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.screen}>
        <AppHeader isSeller={false} showBack title="Tracking" />
        <View style={styles.centerContainer}>
          <Text style={styles.emptyText}>
            {isError ? (error as Error)?.message || 'Could not load this order.' : 'No order to track.'}
          </Text>
          <PrimaryButton
            title={isError ? 'Retry' : 'Go to Orders'}
            onPress={() => (isError ? refetch() : router.replace('/(buyer)/(tabs)/orders'))}
            style={{ marginTop: spacing.md }}
          />
        </View>
      </View>
    );
  }

  const isCOD = order.paymentMode === 'cod';
  const currentStatus = (trackData?.current_status || order.status) as string;
  const deliveryOtp = trackData?.delivery_otp || order.deliveryOtp;
  const isClosed = currentStatus === 'cancelled' || currentStatus === 'rejected';

  const runMutation = async (action: () => Promise<unknown>, successTitle: string, successMsg: string) => {
    setIsMutating(true);
    try {
      await action();
      invalidateOrderQueries(queryClient, order.id);
      Alert.alert(successTitle, successMsg);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Something went wrong. Please try again.');
    } finally {
      setIsMutating(false);
    }
  };

  const handleAcceptFee = () =>
    runMutation(
      () => orderService.buyerConfirm(order.id),
      'Fee Accepted',
      'You accepted the extra delivery charge. Your order is now confirmed.'
    );

  const handleCancelOrder = () =>
    Alert.alert('Cancel Order', 'Are you sure you want to cancel this order?', [
      { text: 'Keep Order', style: 'cancel' },
      {
        text: 'Cancel Order',
        style: 'destructive',
        onPress: () =>
          runMutation(() => orderService.cancelOrder(order.id), 'Order Cancelled', 'Your order has been cancelled.'),
      },
    ]);

  const handleCallFarmer = () => {
    if (!order.sellerPhone) return;
    Linking.openURL(`tel:${order.sellerPhone}`).catch(() =>
      Alert.alert('Unable to call', `Please call ${order.sellerPhone} from your phone.`)
    );
  };

  return (
    <View style={styles.screen}>
      <AppHeader
        isSeller={false}
        showBack
        title={language === 'ta' ? 'ஆர்டர் நிலை' : 'Track Order'}
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
              <Text style={styles.etaTimeText}>
                {currentStatus === 'delivered' ? 'Delivered' : trackData?.eta || getStatusLabel(currentStatus)}
              </Text>
              <Text style={styles.etaSubText}>{getStatusLabel(currentStatus)}</Text>
            </View>

            <View style={styles.orderIdBadge}>
              <Text style={styles.orderIdBadgeText}>#{order.id}</Text>
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
                Your address is outside the farmer&apos;s usual delivery range. The farmer will check if delivery is
                possible.
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
                  The farmer can deliver to your address for an additional transport fee.
                </Text>
                {order.sellerNote ? <Text style={styles.confirmationDesc}>“{order.sellerNote}”</Text> : null}
              </View>
            </View>

            <View style={styles.feeBreakdownBox}>
              <View style={styles.feeRow}>
                <Text style={styles.feeLabel}>Extra Transport Charge:</Text>
                <Text style={styles.feeValue}>+ ₹{order.extraDeliveryFee}</Text>
              </View>
              <View style={styles.feeRow}>
                <Text style={[styles.feeLabel, { fontWeight: '800' }]}>Updated Total:</Text>
                <Text style={[styles.feeValue, { fontWeight: '800', color: colors.primaryDark }]}>
                  ₹{order.grandTotal}
                </Text>
              </View>
            </View>

            <View style={styles.actionButtonsRow}>
              <Pressable style={styles.cancelFeeBtn} onPress={handleCancelOrder} disabled={isMutating}>
                <Text style={styles.cancelFeeBtnText}>Cancel Order</Text>
              </Pressable>

              <Pressable style={styles.acceptFeeBtn} onPress={handleAcceptFee} disabled={isMutating}>
                {isMutating ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.acceptFeeBtnText}>Accept & Confirm</Text>
                )}
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
              <Text style={styles.rejectedDesc}>{order.rejectReason || 'No reason was given.'}</Text>
            </View>
          </View>
        )}

        {/* Buyer may cancel before the farmer confirms */}
        {currentStatus === 'placed' || currentStatus === 'pending_seller_approval' ? (
          <Pressable style={styles.cancelFeeBtn} onPress={handleCancelOrder} disabled={isMutating}>
            <Text style={styles.cancelFeeBtnText}>Cancel Order</Text>
          </Pressable>
        ) : null}

        {/* COD "Pay Rs. X on delivery" Notification Card */}
        {isCOD && !isClosed && (
          <View
            style={[
              styles.codCard,
              currentStatus === 'delivered' && styles.codCardDelivered,
            ]}>
            <View style={styles.codRow}>
              <MaterialCommunityIcons
                name={currentStatus === 'delivered' ? 'check-decagram' : 'cash-multiple'}
                size={22}
                color={currentStatus === 'delivered' ? colors.success : colors.primary}
              />
              <View style={styles.codTextGroup}>
                <Text
                  style={[
                    styles.codTitle,
                    currentStatus === 'delivered' && styles.codTitleDelivered,
                  ]}>
                  {currentStatus === 'delivered'
                    ? `Paid ₹${order.grandTotal} on delivery`
                    : `Pay ₹${order.grandTotal} on delivery`}
                </Text>
                <Text style={styles.codSubtitle}>
                  {currentStatus === 'delivered'
                    ? 'Cash on Delivery payment received'
                    : 'Pay the farmer in cash when you receive your order'}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Delivery OTP Card */}
        {deliveryOtp && !isClosed ? (
          <Card style={styles.otpCard}>
            <View style={styles.otpLeft}>
              <MaterialCommunityIcons
                name={currentStatus === 'delivered' ? 'shield-check' : 'shield-key-outline'}
                size={22}
                color={currentStatus === 'delivered' ? colors.success : colors.accent}
              />
              <View>
                <Text style={styles.otpLabel}>
                  {currentStatus === 'delivered' ? 'Delivery Verified' : 'Delivery OTP'}
                </Text>
                <Text style={styles.otpSub}>
                  {currentStatus === 'delivered'
                    ? 'Delivered with OTP verification'
                    : 'Share only after you receive your produce'}
                </Text>
              </View>
            </View>
            <View
              style={[
                styles.otpPill,
                currentStatus === 'delivered' && styles.otpPillVerified,
              ]}>
              <Text
                style={[
                  styles.otpCode,
                  currentStatus === 'delivered' && styles.otpCodeVerified,
                ]}>
                {deliveryOtp}
              </Text>
            </View>
          </Card>
        ) : null}

        {/* Farmer contact */}
        <Card style={styles.partnerCard}>
          <View style={styles.partnerRow}>
            <View style={styles.driverAvatar}>
              <MaterialCommunityIcons name="sprout" size={28} color={colors.primary} />
            </View>
            <View style={styles.driverInfoCol}>
              <Text style={styles.driverName}>{order.sellerName}</Text>
              {order.sellerAddress ? <Text style={styles.driverVehicle}>{order.sellerAddress}</Text> : null}
              <Text style={styles.driverRating}>Delivering to: {order.deliveryAddress}</Text>
            </View>
            {order.sellerPhone ? (
              <View style={styles.contactButtonsRow}>
                <Pressable
                  onPress={handleCallFarmer}
                  style={styles.callBtn}
                  accessibilityRole="button"
                  accessibilityLabel={`Call ${order.sellerName}`}>
                  <MaterialCommunityIcons name="phone" size={18} color={colors.white} />
                </Pressable>
              </View>
            ) : null}
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
