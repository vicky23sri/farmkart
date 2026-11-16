/**
 * Seller Orders Screen
 * Order fulfillment management for incoming harvest orders from buyers:
 * - Tabs: Needs Approval, New, Packed, Shipped, Delivered
 * - Accept / Reject actions on new and extended-distance orders
 * - Status progression via the API; delivery requires the buyer's handover OTP
 * - UPI payment confirmation / rejection
 */

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { Card } from '@/components/Card';
import { StatusChip } from '@/components/StatusChip';
import { invalidateOrderQueries, orderService } from '@/services/orderService';
import {
  Order,
  OrderStatus,
  useLanguageStore,
} from '@/store';
import { colors, fontSizes, shadows, spacing } from '@/theme';

type SellerOrderTab = 'needs_approval' | 'new' | 'packed' | 'shipped' | 'delivered';

export default function SellerOrdersScreen() {
  const { language } = useLanguageStore();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<SellerOrderTab>('needs_approval');

  // Modal states for Approval & Rejection
  const [approvingOrder, setApprovingOrder] = useState<Order | null>(null);
  const [extraFee, setExtraFee] = useState<string>('0');
  const [sellerNote, setSellerNote] = useState<string>('');
  const [rejectingOrder, setRejectingOrder] = useState<Order | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');

  // Delivery handover OTP
  const [deliveringOrder, setDeliveringOrder] = useState<Order | null>(null);
  const [deliveryOtpInput, setDeliveryOtpInput] = useState<string>('');

  // UPI payment confirmation and rejection states
  const [rejectingPaymentOrder, setRejectingPaymentOrder] = useState<Order | null>(null);
  const [paymentRejectReason, setPaymentRejectReason] = useState<string>('');
  const [isProcessingPayment, setIsProcessingPayment] = useState<boolean>(false);
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);

  const {
    data,
    isLoading,
    isError,
    error,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
    isRefetching,
  } = useInfiniteQuery({
    queryKey: ['seller-my-orders-infinite'],
    queryFn: ({ pageParam = 0 }) => orderService.getMyOrders('all', 50, pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      const nextOffset = lastPage.offset + lastPage.limit;
      return nextOffset < lastPage.total ? nextOffset : undefined;
    },
    refetchInterval: 30000,
  });

  const sourceOrders = useMemo(() => data?.pages.flatMap((page) => page.items) ?? [], [data]);

  const matchesTab = (o: Order, tab: SellerOrderTab): boolean => {
    switch (tab) {
      case 'needs_approval':
        return o.status === 'pending_seller_approval' || o.status === 'awaiting_buyer_confirmation';
      case 'new':
        return o.status === 'placed';
      case 'packed':
        return o.status === 'confirmed' || o.status === 'packed';
      case 'shipped':
        return o.status === 'shipped' || o.status === 'out_for_delivery';
      case 'delivered':
        return o.status === 'delivered';
      default:
        return true;
    }
  };

  const tabOrders = sourceOrders.filter((o) => matchesTab(o, activeTab));
  const countNeedsApproval = sourceOrders.filter((o) => matchesTab(o, 'needs_approval')).length;
  const countNew = sourceOrders.filter((o) => matchesTab(o, 'new')).length;
  const countPacked = sourceOrders.filter((o) => matchesTab(o, 'packed')).length;
  const countShipped = sourceOrders.filter((o) => matchesTab(o, 'shipped')).length;
  const countDelivered = sourceOrders.filter((o) => matchesTab(o, 'delivered')).length;

  /** Runs an order mutation, refreshes every order view, and surfaces real errors. */
  const runOrderAction = async (
    order: Order,
    action: () => Promise<unknown>,
    successTitle: string,
    successMessage: string
  ): Promise<boolean> => {
    setBusyOrderId(order.id);
    try {
      await action();
      invalidateOrderQueries(queryClient, order.id);
      Alert.alert(successTitle, successMessage);
      return true;
    } catch (err: any) {
      Alert.alert(language === 'ta' ? 'பிழை' : 'Action failed', err?.message || 'Please try again.');
      return false;
    } finally {
      setBusyOrderId(null);
    }
  };

  // Accept Regular Order Handler (placed -> confirmed)
  const handleAcceptOrder = (order: Order) =>
    runOrderAction(
      order,
      () => orderService.approveOrder(order.id, 0),
      language === 'ta' ? 'ஆர்டர் ஏற்றுக்கொள்ளப்பட்டது' : 'Order Accepted',
      language === 'ta'
        ? `ஆர்டர் #${order.id} உறுதி செய்யப்பட்டது. அறுவடை மற்றும் பேக்கிங் செய்ய தொடங்குங்கள்.`
        : `Order #${order.id} has been confirmed. Schedule harvesting and packing.`
    );

  // Reject Order: always ask for a reason the buyer will see
  const handleRejectOrder = (order: Order) => {
    setRejectingOrder(order);
    setRejectionReason('');
  };

  // Submit Approval for Extended Order with Extra Fee & Note
  const handleConfirmApproval = async () => {
    if (!approvingOrder) return;
    const feeNum = Number.parseFloat(extraFee);
    if (extraFee.trim() && (!Number.isFinite(feeNum) || feeNum < 0)) {
      Alert.alert('Invalid fee', 'Please enter a valid transport fee (0 or more).');
      return;
    }
    const fee = Number.isFinite(feeNum) ? feeNum : 0;
    const ok = await runOrderAction(
      approvingOrder,
      () => orderService.approveOrder(approvingOrder.id, fee, sellerNote.trim() || undefined),
      'Order Approved',
      fee > 0
        ? `Delivery approved with extra fee ₹${fee}. Awaiting buyer confirmation.`
        : 'Delivery approved at the standard rate. Order is confirmed.'
    );
    if (ok) {
      setApprovingOrder(null);
      setExtraFee('0');
      setSellerNote('');
    }
  };

  // Submit Rejection with Reason
  const handleConfirmRejection = async () => {
    if (!rejectingOrder) return;
    const reason = rejectionReason.trim();
    if (reason.length < 3) {
      Alert.alert('Reason required', 'Please tell the buyer why you cannot fulfil this order.');
      return;
    }
    const ok = await runOrderAction(
      rejectingOrder,
      () => orderService.rejectOrder(rejectingOrder.id, reason),
      'Order Rejected',
      `Order #${rejectingOrder.id} has been rejected. The buyer has been notified.`
    );
    if (ok) {
      setRejectingOrder(null);
      setRejectionReason('');
    }
  };

  // Status Progression Handler
  const handleAdvanceStatus = async (order: Order) => {
    const next: Record<string, { status: 'packed' | 'shipped' | 'out_for_delivery' | 'delivered'; label: string }> = {
      confirmed: { status: 'packed', label: 'Harvested & Packed' },
      packed: { status: 'shipped', label: 'Shipped from Farm' },
      shipped: { status: 'out_for_delivery', label: 'Out for Delivery' },
      out_for_delivery: { status: 'delivered', label: 'Delivered' },
    };
    const step = next[order.status];
    if (!step) return;

    if (step.status === 'delivered') {
      // Handover must be verified with the buyer's OTP
      setDeliveringOrder(order);
      setDeliveryOtpInput('');
      return;
    }

    await runOrderAction(
      order,
      () => orderService.updateStatus(order.id, step.status),
      language === 'ta' ? 'நிலை மாற்றப்பட்டது' : 'Order Status Updated',
      language === 'ta'
        ? `ஆர்டர் #${order.id} "${step.label}" என மாற்றப்பட்டது.`
        : `Order #${order.id} updated to "${step.label}". The buyer has been notified.`
    );
  };

  const handleConfirmDelivery = async () => {
    if (!deliveringOrder) return;
    const otp = deliveryOtpInput.trim();
    if (!/^\d{6}$/.test(otp)) {
      Alert.alert('Enter OTP', "Enter the 6-digit delivery OTP shown in the buyer's app.");
      return;
    }
    const ok = await runOrderAction(
      deliveringOrder,
      () => orderService.updateStatus(deliveringOrder.id, 'delivered', { deliveryOtp: otp }),
      language === 'ta' ? 'விநியோகம் முடிந்தது' : 'Delivered',
      `Order #${deliveringOrder.id} has been marked as delivered.`
    );
    if (ok) {
      setDeliveringOrder(null);
      setDeliveryOtpInput('');
    }
  };

  const handleCallBuyer = (order: Order) => {
    if (!order.buyerPhone) return;
    Linking.openURL(`tel:${order.buyerPhone}`).catch(() =>
      Alert.alert('Unable to call', `Please call ${order.buyerPhone} from your phone.`)
    );
  };

  const handleConfirmPayment = (order: Order) => {
    Alert.alert(
      language === 'ta' ? 'கட்டணத்தை உறுதிப்படுத்து' : 'Confirm UPI Payment',
      language === 'ta'
        ? `வாங்குபவரின் UTR (${order.upiUtr || 'N/A'}) உங்கள் வங்கிக் கணக்கில் ₹${order.grandTotal} வரவு வைக்கப்பட்டுள்ளதா?`
        : `Have you verified receipt of ₹${order.grandTotal} with UTR ${order.upiUtr || 'N/A'} in your bank account?`,
      [
        { text: language === 'ta' ? 'ரத்து' : 'Cancel', style: 'cancel' },
        {
          text: language === 'ta' ? 'ஆம், பெறப்பட்டது' : 'Yes, Confirmed',
          onPress: async () => {
            setIsProcessingPayment(true);
            await runOrderAction(
              order,
              () => orderService.confirmPayment(order.id),
              language === 'ta' ? 'வெற்றி' : 'Payment Confirmed',
              language === 'ta'
                ? 'கட்டணம் வெற்றிகரமாக உறுதிப்படுத்தப்பட்டது!'
                : 'Payment confirmed. Order marked as paid.'
            );
            setIsProcessingPayment(false);
          },
        },
      ]
    );
  };

  const handleOpenRejectPayment = (order: Order) => {
    setRejectingPaymentOrder(order);
    setPaymentRejectReason('');
  };

  const handleSubmitRejectPayment = async () => {
    if (!rejectingPaymentOrder) return;
    const cleanReason = paymentRejectReason.trim();
    if (cleanReason.length < 2) {
      Alert.alert(
        language === 'ta' ? 'காரணம் தேவை' : 'Reason Required',
        language === 'ta'
          ? 'தயவுசெய்து நிராகரிப்புக்கான காரணத்தை உள்ளிடவும் (எ.கா. வங்கி கணக்கில் பணம் வரவு வைக்கப்படவில்லை).'
          : 'Please enter a reason for rejecting the payment (e.g. UTR not found in bank statement).'
      );
      return;
    }
    setIsProcessingPayment(true);
    const ok = await runOrderAction(
      rejectingPaymentOrder,
      () => orderService.rejectPayment(rejectingPaymentOrder.id, cleanReason),
      language === 'ta' ? 'நிராகரிக்கப்பட்டது' : 'Payment Rejected',
      language === 'ta'
        ? 'கட்டணம் நிராகரிக்கப்பட்டது. வாங்குபவர் மீண்டும் சரியான UTR சமர்ப்பிக்கலாம்.'
        : 'Payment rejected. The buyer can review the reason and resubmit a valid UTR.'
    );
    setIsProcessingPayment(false);
    if (ok) setRejectingPaymentOrder(null);
  };

  // Button Label Helper
  const getNextActionConfig = (status: OrderStatus) => {
    switch (status) {
      case 'confirmed':
        return {
          labelEn: 'Mark Harvest Packed',
          labelTa: 'பேக்கிங் முடிந்தது',
          icon: 'package-variant-closed',
          color: colors.primaryDark,
        };
      case 'packed':
        return {
          labelEn: 'Ship from Farm',
          labelTa: 'பண்ணையிலிருந்து அனுப்பு',
          icon: 'truck-fast',
          color: colors.accent,
        };
      case 'shipped':
        return {
          labelEn: 'Mark Out for Delivery',
          labelTa: 'விநியோகத்திற்கு புறப்பட்டது',
          icon: 'moped',
          color: '#1976D2',
        };
      case 'out_for_delivery':
        return {
          labelEn: 'Confirm Doorstep Delivery',
          labelTa: 'ஒப்படைக்கப்பட்டது என பதிவு செய்',
          icon: 'check-decagram',
          color: colors.success,
        };
      default:
        return null;
    }
  };

  return (
    <View style={styles.screen}>
      {/* Signature Dark Green Header with Seller Mode Pill */}
      <AppHeader
        isSeller={true}
        title={language === 'ta' ? 'வாங்குபவர் ஆர்டர்கள்' : 'Incoming Farm Orders'}
        showSearch={false}
        showCart={false}
      />

      {/* 5 Tabs: Needs Approval, New, Packed, Shipped, Delivered */}
      <View style={styles.tabsContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsScrollContent}>
          {[
            { id: 'needs_approval' as const, label: 'Needs Approval', count: countNeedsApproval, isWarning: true },
            { id: 'new' as const, label: 'New', count: countNew },
            { id: 'packed' as const, label: 'Packed', count: countPacked },
            { id: 'shipped' as const, label: 'Shipped', count: countShipped },
            { id: 'delivered' as const, label: 'Delivered', count: countDelivered },
          ].map((tab) => {
            const isSelected = activeTab === tab.id;
            return (
              <Pressable
                key={tab.id}
                onPress={() => setActiveTab(tab.id)}
                style={[
                  styles.tabBtn,
                  isSelected && styles.tabBtnActive,
                  tab.isWarning && isSelected && { backgroundColor: '#FEF3C7' },
                ]}>
                <Text
                  style={[
                    styles.tabBtnText,
                    isSelected && styles.tabBtnTextActive,
                    tab.isWarning && isSelected && { color: '#B45309' },
                  ]}>
                  {tab.label}
                </Text>
                <View
                  style={[
                    styles.tabBadge,
                    isSelected && styles.tabBadgeActive,
                    tab.count > 0 && tab.id === 'new' && styles.tabBadgeNew,
                    tab.isWarning && tab.count > 0 && { backgroundColor: '#D97706' },
                  ]}>
                  <Text
                    style={[
                      styles.tabBadgeText,
                      isSelected && styles.tabBadgeTextActive,
                      tab.count > 0 && tab.id === 'new' && styles.tabBadgeTextNew,
                      tab.isWarning && tab.count > 0 && { color: colors.white },
                    ]}>
                    {tab.count}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <FlatList
        data={tabOrders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.4}
        refreshing={isRefetching}
        onRefresh={refetch}
        ListFooterComponent={
          isFetchingNextPage ? (
            <View style={{ paddingVertical: spacing.md, alignItems: 'center' }}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : undefined
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={{ paddingVertical: spacing.xl, alignItems: 'center' }}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : isError ? (
            <Card style={styles.emptyCard}>
              <MaterialCommunityIcons name="wifi-off" size={48} color={colors.error} />
              <Text style={styles.emptyTitle}>Could not load orders</Text>
              <Text style={styles.emptySubtitle}>{(error as Error)?.message || 'Pull down to retry.'}</Text>
            </Card>
          ) : (
          <Card style={styles.emptyCard}>
            <MaterialCommunityIcons
              name="clipboard-text-clock-outline"
              size={48}
              color={colors.primary}
            />
            <Text style={styles.emptyTitle}>
              No {activeTab.replace('_', ' ').toUpperCase()} Orders
            </Text>
            <Text style={styles.emptySubtitle}>
              Orders matching this dispatch stage will appear here automatically.
            </Text>
          </Card>
          )
        }
        renderItem={({ item: order }) => {
          const nextAction = getNextActionConfig(order.status);
            const isNew = order.status === 'placed';
            const isBusy = busyOrderId === order.id;
            const isNeedsApproval =
              order.status === 'pending_seller_approval' ||
              order.status === 'awaiting_buyer_confirmation';
            const distanceVal = Number(
              (order as any).distanceKm || (order as any).distance || 72
            );

            return (
              <Card key={order.id} style={styles.orderCard}>
                {/* Header: ID, Date, Status */}
                <View style={styles.orderCardHeader}>
                  <View>
                    <View style={styles.orderIdRow}>
                      <Text style={styles.orderIdText}>{order.id}</Text>
                      {isNeedsApproval ? (
                        <View style={[styles.newAlertPill, { backgroundColor: '#FEF3C7' }]}>
                          <Text style={[styles.newAlertText, { color: '#B45309' }]}>
                            {order.status === 'awaiting_buyer_confirmation'
                              ? 'AWAITING BUYER'
                              : 'NEEDS APPROVAL'}
                          </Text>
                        </View>
                      ) : isNew ? (
                        <View style={styles.newAlertPill}>
                          <Text style={styles.newAlertText}>NEW ORDER</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.orderDateText}>{order.orderDate}</Text>
                  </View>

                  <StatusChip
                    label={order.statusLabel}
                    variant={
                      order.status === 'delivered'
                        ? 'success'
                        : order.status === 'cancelled'
                        ? 'error'
                        : isNeedsApproval
                        ? 'warning'
                        : isNew
                        ? 'warning'
                        : 'info'
                    }
                  />
                </View>

                {/* Extended Distance Warning Banner */}
                {isNeedsApproval && (
                  <View style={styles.extendedBanner}>
                    <MaterialCommunityIcons
                      name="map-marker-distance"
                      size={20}
                      color="#D97706"
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.extendedBannerTitle}>
                        Delivery Distance: {distanceVal} km (Beyond 50 km)
                      </Text>
                      <Text style={styles.extendedBannerSub}>
                        Extended delivery requested by buyer. You can accept and optionally specify an extra delivery fee.
                      </Text>
                    </View>
                  </View>
                )}

                {/* Buyer & Delivery Info */}
                <View style={styles.buyerBox}>
                  <View style={styles.buyerRow}>
                    <MaterialCommunityIcons
                      name="account"
                      size={16}
                      color={colors.primaryDark}
                    />
                    <Text style={styles.buyerNameText}>{order.buyerName}</Text>
                    {order.buyerPhone ? (
                      <Pressable
                        onPress={() => handleCallBuyer(order)}
                        accessibilityRole="button"
                        accessibilityLabel={`Call ${order.buyerName}`}
                        hitSlop={8}>
                        <Text style={styles.buyerPhoneText}>📞 {order.buyerPhone}</Text>
                      </Pressable>
                    ) : null}
                  </View>

                  <View style={styles.addressRow}>
                    <MaterialCommunityIcons
                      name="map-marker-outline"
                      size={14}
                      color={colors.textSecondary}
                    />
                    <Text style={styles.addressText} numberOfLines={2}>
                      {order.deliveryAddress}
                    </Text>
                  </View>

                  {order.deliveryNotes ? (
                    <View style={styles.slotRow}>
                      <MaterialCommunityIcons
                        name="note-text-outline"
                        size={14}
                        color={colors.accent}
                      />
                      <Text style={styles.slotText}>{order.deliveryNotes}</Text>
                    </View>
                  ) : null}
                </View>

                {/* Items Summary */}
                <View style={styles.itemsBox}>
                  <Text style={styles.itemsHeading}>Ordered Produce Items:</Text>
                  {order.items.map((item, idx) => (
                    <View key={idx} style={styles.itemLine}>
                      <View style={styles.itemDot} />
                      <Text style={styles.itemNameText} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={styles.itemQtyText}>
                        {item.quantity} {item.unit}
                      </Text>
                      <Text style={styles.itemAmountText}>
                        ₹{item.price * item.quantity}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* Total & Payment Mode */}
                <View style={styles.totalRow}>
                  <View style={styles.paymentModePill}>
                    <MaterialCommunityIcons
                      name={order.paymentMode === 'cod' ? 'cash-multiple' : 'qrcode-scan'}
                      size={14}
                      color={order.paymentMode === 'cod' ? '#E65100' : colors.primaryDark}
                    />
                    <Text
                      style={[
                        styles.paymentModeText,
                        order.paymentMode === 'cod' && { color: '#E65100' },
                      ]}>
                      {order.paymentMode === 'cod'
                        ? 'Cash on Delivery (COD)'
                        : 'Direct UPI'}
                    </Text>
                  </View>

                  <View style={styles.grandTotalCol}>
                    <Text style={styles.totalLabel}>Total Payout:</Text>
                    <Text style={styles.totalValue}>₹{order.grandTotal}</Text>
                  </View>
                </View>

                {/* Direct UPI Verification Section for Seller */}
                {order.paymentMode === 'upi' && (
                  <View style={styles.upiCardSection}>
                    {order.paymentStatus === 'submitted' && (
                      <View style={styles.upiSubmittedCard}>
                        <View style={styles.upiSubmittedHeader}>
                          <View style={styles.upiIconBg}>
                            <MaterialCommunityIcons name="shield-check" size={18} color="#1565C0" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.upiSubmittedTitle}>
                              {language === 'ta' ? 'வாங்குபவர் UTR சமர்ப்பித்துள்ளார்' : 'UPI Payment Submitted'}
                            </Text>
                            <Text style={styles.upiUtrNumberText}>
                              UTR: <Text style={styles.upiUtrBold}>{order.upiUtr || 'N/A'}</Text>
                            </Text>
                          </View>
                        </View>

                        {/* Confirm / Reject Buttons for Seller */}
                        <View style={styles.upiActionRow}>
                          <Pressable
                            style={styles.upiRejectBtn}
                            onPress={() => handleOpenRejectPayment(order)}
                            disabled={isProcessingPayment}>
                            <MaterialCommunityIcons name="close-circle" size={16} color={colors.error} />
                            <Text style={styles.upiRejectBtnText}>
                              {language === 'ta' ? 'நிராகரி' : 'Reject'}
                            </Text>
                          </Pressable>

                          <Pressable
                            style={styles.upiConfirmBtn}
                            onPress={() => handleConfirmPayment(order)}
                            disabled={isProcessingPayment}>
                            <MaterialCommunityIcons name="check-circle" size={16} color={colors.white} />
                            <Text style={styles.upiConfirmBtnText}>
                              {language === 'ta' ? 'கட்டணத்தை உறுதிப்படுத்து' : 'Confirm Payment'}
                            </Text>
                          </Pressable>
                        </View>
                      </View>
                    )}

                    {order.paymentStatus === 'paid' && (
                      <View style={styles.upiPaidPill}>
                        <MaterialCommunityIcons name="check-decagram" size={16} color={colors.success} />
                        <Text style={styles.upiPaidText}>
                          {language === 'ta' ? 'UPI கட்டணம் உறுதி செய்யப்பட்டது' : 'UPI Payment Confirmed'}
                          {order.upiUtr ? ` • UTR: ${order.upiUtr}` : ''}
                        </Text>
                      </View>
                    )}

                    {order.paymentStatus === 'rejected' && (
                      <View style={styles.upiRejectedPill}>
                        <MaterialCommunityIcons name="alert-circle-outline" size={16} color={colors.error} />
                        <Text style={styles.upiRejectedText}>
                          {language === 'ta' ? 'கட்டணம் நிராகரிக்கப்பட்டது' : 'Payment Rejected'}
                          {order.paymentRejectedReason ? `: ${order.paymentRejectedReason}` : ''}
                        </Text>
                      </View>
                    )}

                    {order.paymentStatus === 'pending' && (
                      <View style={styles.upiPendingPill}>
                        <MaterialCommunityIcons name="clock-outline" size={14} color="#B45309" />
                        <Text style={styles.upiPendingText}>
                          {language === 'ta' ? 'வாங்குபவர் செலுத்த காத்திருக்கிறது' : 'Awaiting buyer UPI transfer & UTR'}
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                <View style={styles.divider} />

                {/* Actions: Needs Approval (Approve / Reject) OR Normal Accept / Reject OR Update Status */}
                {isNeedsApproval ? (
                  order.status === 'awaiting_buyer_confirmation' ? (
                    <View style={styles.awaitingBox}>
                      <MaterialCommunityIcons
                        name="clock-outline"
                        size={16}
                        color="#D97706"
                      />
                      <Text style={styles.awaitingText}>
                        Waiting for buyer to confirm extra delivery fee (₹{order.extraDeliveryFee})
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.acceptRejectRow}>
                      <Pressable
                        style={styles.rejectBtn}
                        onPress={() => setRejectingOrder(order)}>
                        <MaterialCommunityIcons
                          name="close"
                          size={16}
                          color={colors.error}
                        />
                        <Text style={styles.rejectBtnText}>Reject (Reason)</Text>
                      </Pressable>

                      <Pressable
                        style={[styles.acceptBtn, { backgroundColor: '#D97706' }]}
                        onPress={() => {
                          setApprovingOrder(order);
                          setExtraFee('0');
                          setSellerNote('');
                        }}>
                        <MaterialCommunityIcons
                          name="check-bold"
                          size={16}
                          color={colors.white}
                        />
                        <Text style={styles.acceptBtnText}>Approve (Fee & Note)</Text>
                      </Pressable>
                    </View>
                  )
                ) : isNew ? (
                  <View style={styles.acceptRejectRow}>
                    <Pressable
                      style={styles.rejectBtn}
                      disabled={isBusy}
                      onPress={() => handleRejectOrder(order)}>
                      <MaterialCommunityIcons
                        name="close"
                        size={16}
                        color={colors.error}
                      />
                      <Text style={styles.rejectBtnText}>
                        {language === 'ta' ? 'நிராகரி' : 'Reject'}
                      </Text>
                    </Pressable>

                    <Pressable
                      style={[styles.acceptBtn, isBusy && { opacity: 0.6 }]}
                      disabled={isBusy}
                      onPress={() => handleAcceptOrder(order)}>
                      <MaterialCommunityIcons
                        name="check-bold"
                        size={16}
                        color={colors.white}
                      />
                      <Text style={styles.acceptBtnText}>
                        {language === 'ta' ? 'ஏற்றுக்கொள்' : 'Accept Order'}
                      </Text>
                    </Pressable>
                  </View>
                ) : nextAction ? (
                  <Pressable
                    style={[styles.advanceStatusBtn, { backgroundColor: nextAction.color }, isBusy && { opacity: 0.6 }]}
                    disabled={isBusy}
                    onPress={() => handleAdvanceStatus(order)}>
                    {isBusy ? (
                      <ActivityIndicator size="small" color={colors.white} />
                    ) : (
                      <MaterialCommunityIcons
                        name={nextAction.icon as any}
                        size={18}
                        color={colors.white}
                      />
                    )}
                    <Text style={styles.advanceStatusText}>
                      Update Status: {language === 'ta' ? nextAction.labelTa : nextAction.labelEn}
                    </Text>
                  </Pressable>
                ) : (
                  <View style={styles.deliveredCompleteRow}>
                    <MaterialCommunityIcons
                      name="check-circle"
                      size={18}
                      color={colors.success}
                    />
                    <Text style={styles.deliveredCompleteText}>
                      Harvest order delivered & verified by buyer
                    </Text>
                  </View>
                )}
              </Card>
            );
        }}
      />

      {/* Modal for Approving Extended-Distance Order */}
      <Modal
        visible={approvingOrder !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setApprovingOrder(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <MaterialCommunityIcons name="truck-check" size={24} color={colors.primaryDark} />
              <Text style={styles.modalTitle}>Approve Extended Delivery</Text>
            </View>
            <Text style={styles.modalSubtitle}>
              Order #{approvingOrder?.id} • Distance: {Number((approvingOrder as any)?.distanceKm || 72)} km
            </Text>
            <Text style={styles.modalAddressText} numberOfLines={2}>
              Delivery to: {approvingOrder?.deliveryAddress}
            </Text>

            <Text style={styles.inputLabel}>Additional Delivery Fee (₹)</Text>
            <TextInput
              style={styles.textInput}
              keyboardType="numeric"
              placeholder="0 (Free / standard rate)"
              placeholderTextColor={colors.textMuted}
              value={extraFee}
              onChangeText={setExtraFee}
            />
            <Text style={styles.inputHelp}>
              If fee &gt; 0, buyer must review and confirm before dispatch starts.
            </Text>

            <Text style={styles.inputLabel}>Seller Note to Buyer (Optional)</Text>
            <TextInput
              style={[styles.textInput, { height: 60 }]}
              multiline
              placeholder="e.g. Will arrange tempo delivery on Sunday morning"
              placeholderTextColor={colors.textMuted}
              value={sellerNote}
              onChangeText={setSellerNote}
            />

            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalCancelBtn}
                onPress={() => setApprovingOrder(null)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={styles.modalSubmitBtn}
                onPress={handleConfirmApproval}>
                <Text style={styles.modalSubmitText}>Confirm Approve</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal for Rejecting Extended-Distance Order */}
      <Modal
        visible={rejectingOrder !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setRejectingOrder(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <MaterialCommunityIcons name="close-circle-outline" size={24} color={colors.error} />
              <Text style={[styles.modalTitle, { color: colors.error }]}>Reject Delivery Request</Text>
            </View>
            <Text style={styles.modalSubtitle}>
              Order #{rejectingOrder?.id} • Distance: {Number((rejectingOrder as any)?.distanceKm || 72)} km
            </Text>

            <Text style={styles.inputLabel}>Reason for Rejection</Text>
            <TextInput
              style={[styles.textInput, { height: 70 }]}
              multiline
              placeholder="e.g. Distance exceeds available vehicle capacity"
              placeholderTextColor={colors.textMuted}
              value={rejectionReason}
              onChangeText={setRejectionReason}
            />

            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalCancelBtn}
                onPress={() => setRejectingOrder(null)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalSubmitBtn, { backgroundColor: colors.error }]}
                onPress={handleConfirmRejection}>
                <Text style={styles.modalSubmitText}>Confirm Reject</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal: verify the buyer's delivery OTP at handover */}
      <Modal
        visible={deliveringOrder !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setDeliveringOrder(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <MaterialCommunityIcons name="shield-key-outline" size={24} color={colors.success} />
              <Text style={styles.modalTitle}>
                {language === 'ta' ? 'விநியோக OTP' : 'Confirm Delivery'}
              </Text>
            </View>
            <Text style={styles.modalSubtitle}>
              {language === 'ta'
                ? `ஆர்டர் #${deliveringOrder?.id} • வாங்குபவரின் செயலியில் காட்டப்படும் 6 இலக்க OTP-ஐ உள்ளிடவும்.`
                : `Order #${deliveringOrder?.id} • Ask the buyer for the 6-digit OTP shown in their app.`}
            </Text>
            <TextInput
              style={[styles.textInput, { fontSize: 22, letterSpacing: 8, textAlign: 'center' }]}
              keyboardType="number-pad"
              maxLength={6}
              placeholder="••••••"
              placeholderTextColor={colors.textMuted}
              value={deliveryOtpInput}
              onChangeText={(t) => setDeliveryOtpInput(t.replace(/\D/g, ''))}
              autoFocus
            />
            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalCancelBtn}
                onPress={() => setDeliveringOrder(null)}
                disabled={busyOrderId !== null}>
                <Text style={styles.modalCancelText}>{language === 'ta' ? 'ரத்து' : 'Cancel'}</Text>
              </Pressable>
              <Pressable
                style={[styles.modalSubmitBtn, { backgroundColor: colors.success }]}
                onPress={handleConfirmDelivery}
                disabled={busyOrderId !== null}>
                {busyOrderId !== null ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={styles.modalSubmitText}>
                    {language === 'ta' ? 'உறுதிசெய்' : 'Mark Delivered'}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal for Rejecting Submitted UPI Payment */}
      <Modal
        visible={rejectingPaymentOrder !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setRejectingPaymentOrder(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <MaterialCommunityIcons name="alert-circle-outline" size={24} color={colors.error} />
              <Text style={styles.modalTitle}>
                {language === 'ta' ? 'UPI கட்டணத்தை நிராகரி' : 'Reject UPI Payment'}
              </Text>
            </View>
            <Text style={styles.modalSubtitle}>
              {language === 'ta'
                ? `ஆர்டர் #${rejectingPaymentOrder?.id} • சமர்ப்பிக்கப்பட்ட UTR: ${rejectingPaymentOrder?.upiUtr || 'N/A'}`
                : `Order #${rejectingPaymentOrder?.id} • Submitted UTR: ${rejectingPaymentOrder?.upiUtr || 'N/A'}`}
            </Text>

            <Text style={styles.inputLabel}>
              {language === 'ta' ? 'நிராகரிப்புக்கான காரணம் (தேவை)' : 'Rejection Reason (Required)'}
            </Text>
            <TextInput
              style={[styles.textInput, { height: 75 }]}
              multiline
              placeholder={
                language === 'ta'
                  ? 'எ.கா. வங்கி அறிக்கையில் UTR காணப்படவில்லை, தொகை பொருந்தவில்லை'
                  : 'e.g. UTR not received in bank account, transaction amount mismatch'
              }
              placeholderTextColor={colors.textMuted}
              value={paymentRejectReason}
              onChangeText={setPaymentRejectReason}
            />
            <Text style={styles.inputHelp}>
              {language === 'ta'
                ? 'வாங்குபவர் இந்த காரணத்தைக் கண்டு மீண்டும் 3 முறை வரை சரியான UTR சமர்ப்பிக்கலாம்.'
                : 'Buyer can view this reason and resubmit a corrected UTR up to 3 times.'}
            </Text>

            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalCancelBtn}
                onPress={() => setRejectingPaymentOrder(null)}
                disabled={isProcessingPayment}>
                <Text style={styles.modalCancelText}>
                  {language === 'ta' ? 'ரத்து' : 'Cancel'}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.modalSubmitBtn, { backgroundColor: colors.error }]}
                onPress={handleSubmitRejectPayment}
                disabled={isProcessingPayment}>
                {isProcessingPayment ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={styles.modalSubmitText}>
                    {language === 'ta' ? 'நிராகரிப்பை உறுதிசெய்' : 'Reject Payment'}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  tabsBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    justifyContent: 'space-between',
  },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    gap: 4,
  },
  tabBtnActive: {
    backgroundColor: colors.primaryLight,
  },
  tabBtnText: {
    fontSize: fontSizes.xs,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  tabBtnTextActive: {
    fontWeight: '800',
    color: colors.primaryDark,
  },
  tabBadge: {
    backgroundColor: colors.surfaceSecondary,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  tabBadgeActive: {
    backgroundColor: colors.primaryDark,
  },
  tabBadgeNew: {
    backgroundColor: colors.accent,
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  tabBadgeTextActive: {
    color: colors.white,
  },
  tabBadgeTextNew: {
    color: colors.white,
    fontWeight: '900',
  },
  scrollContent: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xxl + 40,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: 8,
  },
  emptyTitle: {
    fontSize: fontSizes.md,
    fontWeight: '800',
    color: colors.text,
  },
  emptySubtitle: {
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 240,
  },
  orderCard: {
    gap: spacing.xs + 2,
  },
  orderCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  orderIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  orderIdText: {
    fontSize: fontSizes.sm + 1,
    fontWeight: '800',
    color: colors.text,
  },
  newAlertPill: {
    backgroundColor: '#FFF3E0',
    borderWidth: 1,
    borderColor: colors.accent,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  newAlertText: {
    fontSize: 8,
    fontWeight: '900',
    color: colors.accent,
  },
  orderDateText: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  buyerBox: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 8,
    padding: spacing.xs + 2,
    gap: 4,
  },
  buyerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  buyerNameText: {
    fontSize: fontSizes.xs + 1,
    fontWeight: '700',
    color: colors.text,
  },
  buyerPhoneText: {
    fontSize: 11,
    color: colors.textSecondary,
    marginLeft: 'auto',
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
  },
  addressText: {
    fontSize: 11,
    color: colors.textSecondary,
    flex: 1,
  },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  slotText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.accent,
  },
  itemsBox: {
    gap: 4,
    marginTop: 2,
  },
  itemsHeading: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  itemLine: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
  },
  itemDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primary,
    marginRight: 6,
  },
  itemNameText: {
    fontSize: fontSizes.xs,
    color: colors.text,
    flex: 1,
  },
  itemQtyText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    marginRight: 10,
  },
  itemAmountText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  paymentModePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F8E9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  paymentModeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  grandTotalCol: {
    alignItems: 'flex-end',
  },
  totalLabel: {
    fontSize: 10,
    color: colors.textSecondary,
  },
  totalValue: {
    fontSize: fontSizes.sm + 1,
    fontWeight: '900',
    color: colors.primaryDark,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 4,
  },
  acceptRejectRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  rejectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.error,
    backgroundColor: '#FFEBEE',
    paddingVertical: 9,
    borderRadius: 8,
    gap: 4,
  },
  rejectBtnText: {
    fontSize: fontSizes.xs + 1,
    fontWeight: '700',
    color: colors.error,
  },
  acceptBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryDark,
    paddingVertical: 9,
    borderRadius: 8,
    gap: 6,
    ...shadows.soft,
  },
  acceptBtnText: {
    fontSize: fontSizes.xs + 1,
    fontWeight: '800',
    color: colors.white,
  },
  advanceStatusBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
    ...shadows.soft,
  },
  advanceStatusText: {
    fontSize: fontSizes.xs + 1,
    fontWeight: '800',
    color: colors.white,
  },
  deliveredCompleteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    gap: 6,
  },
  deliveredCompleteText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.success,
  },
  tabsContainer: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tabsScrollContent: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    gap: 6,
  },
  extendedBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FCD34D',
    borderRadius: 8,
    padding: spacing.sm,
    marginBottom: spacing.xs,
    gap: spacing.xs,
  },
  extendedBannerTitle: {
    fontSize: fontSizes.xs + 1,
    fontWeight: '800',
    color: '#92400E',
  },
  extendedBannerSub: {
    fontSize: 11,
    color: '#B45309',
    marginTop: 2,
    lineHeight: 15,
  },
  awaitingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    padding: spacing.sm,
    borderRadius: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  awaitingText: {
    fontSize: fontSizes.xs,
    fontWeight: '600',
    color: '#92400E',
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 420,
    ...shadows.medium,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  modalTitle: {
    fontSize: fontSizes.md,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  modalSubtitle: {
    fontSize: fontSizes.xs,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 4,
  },
  modalAddressText: {
    fontSize: 11,
    color: colors.textSecondary,
    backgroundColor: colors.background,
    padding: spacing.xs,
    borderRadius: 6,
    marginBottom: spacing.md,
  },
  inputLabel: {
    fontSize: fontSizes.xs,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
    marginTop: spacing.xs,
  },
  textInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    fontSize: fontSizes.sm,
    color: colors.text,
    backgroundColor: colors.background,
  },
  inputHelp: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 2,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalCancelText: {
    fontSize: fontSizes.xs + 1,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  modalSubmitBtn: {
    flex: 1.5,
    backgroundColor: colors.primaryDark,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    ...shadows.soft,
  },
  modalSubmitText: {
    fontSize: fontSizes.xs + 1,
    fontWeight: '800',
    color: colors.white,
  },
  upiCardSection: {
    marginTop: spacing.xs,
  },
  upiSubmittedCard: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 10,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  upiSubmittedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
  upiIconBg: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  upiSubmittedTitle: {
    fontSize: fontSizes.xs + 1,
    fontWeight: '700',
    color: '#1E40AF',
  },
  upiUtrNumberText: {
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
    marginTop: 1,
  },
  upiUtrBold: {
    fontWeight: '800',
    color: colors.text,
    letterSpacing: 0.5,
  },
  upiActionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  upiRejectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.error,
    backgroundColor: '#FEF2F2',
  },
  upiRejectBtnText: {
    fontSize: fontSizes.xs,
    fontWeight: '700',
    color: colors.error,
  },
  upiConfirmBtn: {
    flex: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: colors.primaryDark,
  },
  upiConfirmBtnText: {
    fontSize: fontSizes.xs,
    fontWeight: '700',
    color: colors.white,
  },
  upiPaidPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: 8,
  },
  upiPaidText: {
    fontSize: fontSizes.xs,
    fontWeight: '700',
    color: '#166534',
  },
  upiRejectedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: 8,
  },
  upiRejectedText: {
    fontSize: fontSizes.xs,
    fontWeight: '600',
    color: colors.error,
  },
  upiPendingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: 8,
  },
  upiPendingText: {
    fontSize: fontSizes.xs,
    fontWeight: '600',
    color: '#92400E',
  },
});
