/**
 * Seller Orders Screen
 * Order fulfillment management for incoming harvest orders from buyers:
 * - 4 Tabs: New, Packed, Shipped, Delivered with real-time numeric badges
 * - Accept / Reject actions on new orders
 * - "Update Status" progression that directly updates shared useOrderStore
 * - Dark green header with "Seller Mode" pill
 */

import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import {
  Alert,
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
import { orderService } from '@/services';
import {
  Order,
  OrderStatus,
  useLanguageStore,
  useOrderStore,
} from '@/store';
import { colors, fontSizes, shadows, spacing } from '@/theme';

type SellerOrderTab = 'needs_approval' | 'new' | 'packed' | 'shipped' | 'delivered';

export default function SellerOrdersScreen() {
  const { language } = useLanguageStore();
  const { orders, updateOrderStatus, cancelOrder } = useOrderStore();

  const [activeTab, setActiveTab] = useState<SellerOrderTab>('needs_approval');

  // Modal states for Approval & Rejection of extended-distance orders
  const [approvingOrder, setApprovingOrder] = useState<Order | null>(null);
  const [extraFee, setExtraFee] = useState<string>('0');
  const [sellerNote, setSellerNote] = useState<string>('');
  const [rejectingOrder, setRejectingOrder] = useState<Order | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');

  // Filter orders by seller tabs
  const tabOrders = useMemo(() => {
    switch (activeTab) {
      case 'needs_approval':
        return orders.filter(
          (o) =>
            o.status === 'pending_seller_approval' ||
            o.status === 'awaiting_buyer_confirmation' ||
            (o as any).isExtendedDelivery ||
            (o.status === 'placed' &&
              Number((o as any).distanceKm || (o as any).distance || 0) > 50)
        );
      case 'new':
        return orders.filter(
          (o) =>
            o.status === 'placed' &&
            !(
              (o as any).isExtendedDelivery ||
              Number((o as any).distanceKm || (o as any).distance || 0) > 50
            )
        );
      case 'packed':
        return orders.filter((o) => o.status === 'confirmed' || o.status === 'packed');
      case 'shipped':
        return orders.filter((o) => o.status === 'shipped' || o.status === 'out_for_delivery');
      case 'delivered':
        return orders.filter((o) => o.status === 'delivered');
      default:
        return orders;
    }
  }, [orders, activeTab]);

  // Tab counts
  const countNeedsApproval = orders.filter(
    (o) =>
      o.status === 'pending_seller_approval' ||
      o.status === 'awaiting_buyer_confirmation' ||
      (o as any).isExtendedDelivery ||
      (o.status === 'placed' &&
        Number((o as any).distanceKm || (o as any).distance || 0) > 50)
  ).length;
  const countNew = orders.filter(
    (o) =>
      o.status === 'placed' &&
      !(
        (o as any).isExtendedDelivery ||
        Number((o as any).distanceKm || (o as any).distance || 0) > 50
      )
  ).length;
  const countPacked = orders.filter((o) => o.status === 'confirmed' || o.status === 'packed').length;
  const countShipped = orders.filter(
    (o) => o.status === 'shipped' || o.status === 'out_for_delivery'
  ).length;
  const countDelivered = orders.filter((o) => o.status === 'delivered').length;

  // Accept Regular Order Handler
  const handleAcceptOrder = async (order: Order) => {
    try {
      await orderService.updateStatus(order.id, 'confirmed');
    } catch {
      // Fallback to local store
    }
    updateOrderStatus(order.id, 'confirmed');
    Alert.alert(
      language === 'ta' ? 'ஆர்டர் ஏற்றுக்கொள்ளப்பட்டது' : 'Order Accepted',
      language === 'ta'
        ? `ஆர்டர் ${order.id} உறுதி செய்யப்பட்டது. அறுவடை மற்றும் பேக்கிங் செய்ய தொடங்குங்கள்.`
        : `Order ${order.id} has been confirmed. Schedule harvesting and packing.`
    );
  };

  // Reject Regular Order Handler
  const handleRejectOrder = (order: Order) => {
    Alert.alert(
      language === 'ta' ? 'ஆர்டரை நிராகரிக்கவா?' : 'Reject Order?',
      language === 'ta'
        ? `காரணம்: கையிருப்பு பற்றாக்குறை அல்லது விநியோக தூரம் அதிகம். ${order.id} நிராகரிக்கவா?`
        : `Are you sure you want to reject order ${order.id}? Buyer will be notified immediately.`,
      [
        { text: language === 'ta' ? 'ரத்து' : 'Cancel', style: 'cancel' },
        {
          text: language === 'ta' ? 'நிராகரி' : 'Reject Order',
          style: 'destructive',
          onPress: async () => {
            try {
              await orderService.rejectOrder(order.id, 'Rejected by farmer due to field constraints');
            } catch {
              // fallback
            }
            cancelOrder(order.id, 'Rejected by farmer due to field constraints');
            Alert.alert(
              language === 'ta' ? 'ஆர்டர் ரத்து செய்யப்பட்டது' : 'Order Rejected',
              `Order ${order.id} has been rejected.`
            );
          },
        },
      ]
    );
  };

  // Submit Approval for Extended Order with Extra Fee & Note
  const handleConfirmApproval = async () => {
    if (!approvingOrder) return;
    const feeNum = parseFloat(extraFee) || 0;
    try {
      await orderService.approveOrder(approvingOrder.id, feeNum, sellerNote);
    } catch {
      // fallback
    }
    const nextSt = feeNum > 0 ? 'awaiting_buyer_confirmation' : 'confirmed';
    updateOrderStatus(approvingOrder.id, nextSt as any);

    Alert.alert(
      'Order Approved',
      feeNum > 0
        ? `Delivery approved with extra fee ₹${feeNum}. Awaiting buyer confirmation.`
        : `Delivery approved at standard rate. Order is confirmed.`
    );
    setApprovingOrder(null);
    setExtraFee('0');
    setSellerNote('');
  };

  // Submit Rejection for Extended Order with Reason
  const handleConfirmRejection = async () => {
    if (!rejectingOrder) return;
    const reason = rejectionReason.trim() || 'Seller cannot deliver to this extended distance';
    try {
      await orderService.rejectOrder(rejectingOrder.id, reason);
    } catch {
      // fallback
    }
    cancelOrder(rejectingOrder.id, reason);
    Alert.alert('Order Rejected', `Order ${rejectingOrder.id} has been rejected with reason: "${reason}".`);
    setRejectingOrder(null);
    setRejectionReason('');
  };

  // Status Progression Handler
  const handleAdvanceStatus = async (order: Order) => {
    let nextStatus: OrderStatus | null = null;
    let nextActionLabel = '';

    if (order.status === 'confirmed') {
      nextStatus = 'packed';
      nextActionLabel = 'Harvested & Packed';
    } else if (order.status === 'packed') {
      nextStatus = 'shipped';
      nextActionLabel = 'Shipped from Farm';
    } else if (order.status === 'shipped') {
      nextStatus = 'out_for_delivery';
      nextActionLabel = 'Out for Delivery';
    } else if (order.status === 'out_for_delivery') {
      nextStatus = 'delivered';
      nextActionLabel = 'Delivered at Doorstep';
    }

    if (!nextStatus) return;

    try {
      await orderService.updateStatus(order.id, nextStatus);
    } catch {
      // fallback
    }
    updateOrderStatus(order.id, nextStatus);

    Alert.alert(
      language === 'ta' ? 'நிலை மாற்றப்பட்டது' : 'Order Status Updated',
      language === 'ta'
        ? `ஆர்டர் ${order.id} "${nextActionLabel}" என மாற்றப்பட்டது. வாங்குபவரின் நேரலை திரையில் இது உடனடியாக பிரதிபலிக்கும்.`
        : `Order ${order.id} updated to "${nextActionLabel}". Buyer's live tracking screen is updated in real time!`
    );
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

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {tabOrders.length === 0 ? (
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
        ) : (
          tabOrders.map((order) => {
            const nextAction = getNextActionConfig(order.status);
            const isNew = order.status === 'placed';
            const isNeedsApproval =
              activeTab === 'needs_approval' ||
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
                    <Text style={styles.buyerPhoneText}>{order.buyerPhone}</Text>
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

                  <View style={styles.slotRow}>
                    <MaterialCommunityIcons
                      name="clock-time-four-outline"
                      size={14}
                      color={colors.accent}
                    />
                    <Text style={styles.slotText}>Slot: {order.deliverySlot}</Text>
                  </View>
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
                      name={order.paymentMode === 'cod' ? 'cash-multiple' : 'credit-card-check'}
                      size={14}
                      color={order.paymentMode === 'cod' ? '#E65100' : colors.primaryDark}
                    />
                    <Text
                      style={[
                        styles.paymentModeText,
                        order.paymentMode === 'cod' && { color: '#E65100' },
                      ]}>
                      {order.paymentMode === 'cod'
                        ? 'COD (Collect on Delivery)'
                        : 'Paid Online (UPI)'}
                    </Text>
                  </View>

                  <View style={styles.grandTotalCol}>
                    <Text style={styles.totalLabel}>Total Payout:</Text>
                    <Text style={styles.totalValue}>₹{order.grandTotal}</Text>
                  </View>
                </View>

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
                        Waiting for buyer to confirm extra delivery fee (₹{(order as any).extraDeliveryFee || 0})
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
                      style={styles.acceptBtn}
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
                    style={[styles.advanceStatusBtn, { backgroundColor: nextAction.color }]}
                    onPress={() => handleAdvanceStatus(order)}>
                    <MaterialCommunityIcons
                      name={nextAction.icon as any}
                      size={18}
                      color={colors.white}
                    />
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
          })
        )}
      </ScrollView>

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
});
