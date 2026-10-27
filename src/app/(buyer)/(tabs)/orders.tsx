/**
 * Buyer Orders Tab Screen
 * Features:
 * - AppHeader on top with cart badge and title
 * - 4 segmented tabs: Ongoing, Delivered, Cancelled, Returns with count badges
 * - Full integration with shared useOrderStore
 * - Order cards with items, farmer profile, status chips, and quick actions
 * - Links to Order Detail and Live Order Tracking
 * - Return request and cancellation actions
 */

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { StatusChip } from '@/components/StatusChip';
import {
  Order,
  OrderTab,
  useCartStore,
  useLanguageStore,
  useOrderStore,
} from '@/store';
import { colors, fontSizes, spacing } from '@/theme';

export default function BuyerOrdersScreen() {
  const { language } = useLanguageStore();
  const { getTotalCount } = useCartStore();
  const { orders, cancelOrder, requestReturn } = useOrderStore();

  const [activeTab, setActiveTab] = useState<OrderTab>('ongoing');

  // Filter orders by active tab
  const currentOrders = orders.filter((o) => o.tab === activeTab);

  // Tab counts
  const countOngoing = orders.filter((o) => o.tab === 'ongoing').length;
  const countDelivered = orders.filter((o) => o.tab === 'delivered').length;
  const countCancelled = orders.filter((o) => o.tab === 'cancelled').length;
  const countReturns = orders.filter((o) => o.tab === 'returns').length;

  const handleCancel = (order: Order) => {
    Alert.alert(
      'Cancel Order',
      `Are you sure you want to cancel order ${order.id}?`,
      [
        { text: 'No, Keep Order', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: () => {
            cancelOrder(order.id, 'Cancelled by buyer');
            Alert.alert('Order Cancelled', `Order ${order.id} has been cancelled.`);
          },
        },
      ]
    );
  };

  const handleReturn = (order: Order) => {
    Alert.alert(
      'Request Return',
      `Submit a return request for ${order.id}? Farmer will arrange pickup or refund.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Request Return',
          onPress: () => {
            requestReturn(order.id, 'Quality verification return');
            Alert.alert(
              'Return Requested',
              `Return request for ${order.id} submitted successfully.`
            );
          },
        },
      ]
    );
  };

  return (
    <View style={styles.screen}>
      <AppHeader
        isSeller={false}
        title={language === 'ta' ? 'என் ஆர்டர்கள்' : 'My Orders'}
        cartCount={getTotalCount()}
        onCartPress={() => router.push('/(buyer)/(tabs)/cart')}
        onSearchPress={() => router.push('/(buyer)/products')}
      />

      {/* 4 Segmented Tabs: Ongoing, Delivered, Cancelled, Returns */}
      <View style={styles.tabsBar}>
        {[
          {
            id: 'ongoing' as OrderTab,
            label: 'Ongoing',
            labelTa: 'விநியோகத்தில்',
            count: countOngoing,
          },
          {
            id: 'delivered' as OrderTab,
            label: 'Delivered',
            labelTa: 'முடிந்தவை',
            count: countDelivered,
          },
          {
            id: 'cancelled' as OrderTab,
            label: 'Cancelled',
            labelTa: 'ரத்து',
            count: countCancelled,
          },
          {
            id: 'returns' as OrderTab,
            label: 'Returns',
            labelTa: 'திரும்பல்',
            count: countReturns,
          },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <Pressable
              key={tab.id}
              onPress={() => setActiveTab(tab.id)}
              style={[styles.tabBtn, isActive && styles.tabBtnActive]}>
              <Text
                style={[styles.tabBtnText, isActive && styles.tabBtnTextActive]}>
                {language === 'ta' ? tab.labelTa : tab.label}
              </Text>
              {tab.count > 0 && (
                <View
                  style={[
                    styles.tabCountBadge,
                    isActive && styles.tabCountBadgeActive,
                  ]}>
                  <Text
                    style={[
                      styles.tabCountText,
                      isActive && styles.tabCountTextActive,
                    ]}>
                    {tab.count}
                  </Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      {/* Orders List / Empty State */}
      {currentOrders.length === 0 ? (
        <EmptyState
          title={
            activeTab === 'ongoing'
              ? 'No Ongoing Orders'
              : activeTab === 'delivered'
              ? 'No Delivered Orders Yet'
              : activeTab === 'cancelled'
              ? 'No Cancelled Orders'
              : 'No Returns Requested'
          }
          description={
            activeTab === 'ongoing'
              ? 'You have no live harvest dispatches right now.'
              : 'Past orders in this tab will appear here.'
          }
          icon="clipboard-text-clock-outline"
          actionLabel="Explore Fresh Harvest"
          onAction={() => router.push('/(buyer)/(tabs)')}
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          {currentOrders.map((order) => {
            const isOngoing = order.tab === 'ongoing';
            const isDelivered = order.tab === 'delivered';
            const firstItem = order.items[0];

            return (
              <Card key={order.id} style={styles.orderCard}>
                {/* Header Row: ID, Date, Status */}
                <View style={styles.orderHeaderRow}>
                  <View>
                    <Text style={styles.orderIdText}>{order.id}</Text>
                    <Text style={styles.orderDateText}>{order.orderDate}</Text>
                  </View>
                  <StatusChip
                    label={order.statusLabel}
                    variant={
                      order.status === 'delivered'
                        ? 'success'
                        : order.status === 'cancelled' ||
                          order.status === 'returned'
                        ? 'error'
                        : 'info'
                    }
                  />
                </View>

                {/* Farmer / Farm Info */}
                <View style={styles.farmerRow}>
                  <MaterialCommunityIcons
                    name="tractor"
                    size={16}
                    color={colors.primary}
                  />
                  <Text style={styles.farmerNameText}>
                    {order.sellerName} • {order.sellerFarm}
                  </Text>
                </View>

                {/* Produce Items Preview */}
                <View style={styles.itemsPreviewRow}>
                  {firstItem?.image && (
                    <Image
                      source={{ uri: firstItem.image }}
                      style={styles.itemThumb}
                      resizeMode="cover"
                    />
                  )}
                  <View style={styles.itemsTextCol}>
                    <Text style={styles.itemsHeadline} numberOfLines={1}>
                      {firstItem?.name || 'Fresh Produce'}
                    </Text>
                    <Text style={styles.itemsSubText}>
                      {order.items.length > 1
                        ? `+ ${order.items.length - 1} other produce items`
                        : `${firstItem?.quantity} ${firstItem?.unit}`}
                    </Text>
                    <Text style={styles.deliverySlotTag}>
                      Slot: {order.deliverySlot}
                    </Text>
                  </View>

                  <View style={styles.totalCol}>
                    <Text style={styles.totalAmount}>₹{order.grandTotal}</Text>
                    <Text style={styles.paymentModeTag}>
                      {order.paymentMode.toUpperCase()}
                    </Text>
                  </View>
                </View>

                <View style={styles.divider} />

                {/* Bottom Actions */}
                <View style={styles.cardActionsRow}>
                  {/* View Details */}
                  <Pressable
                    onPress={() =>
                      router.push({
                        pathname: '/(buyer)/order-detail',
                        params: { id: order.id },
                      })
                    }
                    style={styles.detailsBtn}>
                    <MaterialCommunityIcons
                      name="receipt"
                      size={14}
                      color={colors.textSecondary}
                    />
                    <Text style={styles.detailsBtnText}>
                      {language === 'ta' ? 'விபரம்' : 'Order Detail'}
                    </Text>
                  </Pressable>

                  {/* Ongoing: Track Order */}
                  {isOngoing && (
                    <Pressable
                      onPress={() =>
                        router.push({
                          pathname: '/(buyer)/tracking',
                          params: { orderId: order.id },
                        })
                      }
                      style={styles.trackBtn}>
                      <MaterialCommunityIcons
                        name="truck-fast"
                        size={14}
                        color={colors.white}
                      />
                      <Text style={styles.trackBtnText}>
                        {language === 'ta' ? 'கண்காணிக்க' : 'Track Order'}
                      </Text>
                    </Pressable>
                  )}

                  {/* Delivered: Rate & Review and Return */}
                  {isDelivered && (
                    <>
                      <Pressable
                        onPress={() =>
                          router.push({
                            pathname: '/(buyer)/rate-review',
                            params: { orderId: order.id },
                          })
                        }
                        style={order.isReviewed ? styles.reviewedBtn : styles.rateBtn}>
                        <MaterialCommunityIcons
                          name="star"
                          size={13}
                          color={order.isReviewed ? colors.primaryDark : colors.white}
                        />
                        <Text
                          style={
                            order.isReviewed
                              ? styles.reviewedBtnText
                              : styles.rateBtnText
                          }>
                          {order.isReviewed
                            ? language === 'ta'
                              ? 'மதிப்பிடப்பட்டது'
                              : 'Reviewed'
                            : language === 'ta'
                            ? 'மதிப்பிட'
                            : 'Rate & Review'}
                        </Text>
                      </Pressable>

                      <Pressable
                        onPress={() => handleReturn(order)}
                        style={styles.returnBtn}>
                        <Text style={styles.returnBtnText}>Return</Text>
                      </Pressable>
                    </>
                  )}

                  {/* Placed: Cancel Order */}
                  {order.status === 'placed' && (
                    <Pressable
                      onPress={() => handleCancel(order)}
                      style={styles.cancelBtn}>
                      <Text style={styles.cancelBtnText}>Cancel</Text>
                    </Pressable>
                  )}
                </View>
              </Card>
            );
          })}
        </ScrollView>
      )}
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
  tabCountBadge: {
    backgroundColor: colors.surfaceSecondary,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  tabCountBadgeActive: {
    backgroundColor: colors.primary,
  },
  tabCountText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  tabCountTextActive: {
    color: colors.white,
  },
  scrollContent: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  orderCard: {
    gap: spacing.xs + 2,
  },
  orderHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  orderIdText: {
    fontSize: fontSizes.sm + 1,
    fontWeight: '800',
    color: colors.text,
  },
  orderDateText: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  farmerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  farmerNameText: {
    fontSize: fontSizes.xs,
    fontWeight: '600',
    color: colors.primaryDark,
  },
  itemsPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 4,
  },
  itemThumb: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: colors.surfaceSecondary,
  },
  itemsTextCol: {
    flex: 1,
  },
  itemsHeadline: {
    fontSize: fontSizes.xs + 1,
    fontWeight: '700',
    color: colors.text,
  },
  itemsSubText: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  deliverySlotTag: {
    fontSize: 10,
    color: colors.accent,
    fontWeight: '600',
    marginTop: 1,
  },
  totalCol: {
    alignItems: 'flex-end',
  },
  totalAmount: {
    fontSize: fontSizes.md + 1,
    fontWeight: '900',
    color: colors.primaryDark,
  },
  paymentModeTag: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.textMuted,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 4,
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    paddingTop: 2,
  },
  detailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
    gap: 4,
  },
  detailsBtnText: {
    fontSize: fontSizes.xs,
    fontWeight: '700',
    color: colors.text,
  },
  trackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: colors.primary,
    gap: 4,
  },
  trackBtnText: {
    fontSize: fontSizes.xs,
    fontWeight: '800',
    color: colors.white,
  },
  rateBtn: {
    backgroundColor: colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    gap: 3,
  },
  rateBtnText: {
    fontSize: fontSizes.xs,
    fontWeight: '800',
    color: colors.white,
  },
  reviewedBtn: {
    backgroundColor: colors.primaryLight,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    gap: 3,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  reviewedBtnText: {
    fontSize: fontSizes.xs,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  returnBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  returnBtnText: {
    fontSize: fontSizes.xs,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  cancelBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFCDD2',
    backgroundColor: '#FFEBEE',
  },
  cancelBtnText: {
    fontSize: fontSizes.xs,
    fontWeight: '700',
    color: colors.error,
  },
});
