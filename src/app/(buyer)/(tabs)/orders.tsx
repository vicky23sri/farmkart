/**
 * Buyer Orders Tab Screen
 * Features:
 * - AppHeader on top with cart badge and title
 * - 3 segmented tabs: Ongoing, Delivered, Cancelled (server-side filtered & paginated)
 * - Order cards with items, farmer, status chips, and quick actions
 * - Links to Order Detail and Order Tracking
 * - Cancellation before the farmer confirms
 */

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { StatusChip } from '@/components/StatusChip';
import { invalidateOrderQueries, orderService } from '@/services/orderService';
import {
  Order,
  OrderTab,
  useCartStore,
  useLanguageStore,
} from '@/store';
import { colors, fontSizes, spacing } from '@/theme';

export default function BuyerOrdersScreen() {
  const { language } = useLanguageStore();
  const { getTotalCount } = useCartStore();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<OrderTab>('ongoing');

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
    queryKey: ['buyer-my-orders-infinite', activeTab],
    queryFn: ({ pageParam = 0 }) => orderService.getMyOrders(activeTab, 20, pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      const nextOffset = lastPage.offset + lastPage.limit;
      return nextOffset < lastPage.total ? nextOffset : undefined;
    },
    refetchInterval: 30000,
  });

  const displayOrders = useMemo(() => data?.pages.flatMap((page) => page.items) ?? [], [data]);
  const activeTotal = data?.pages[0]?.total ?? 0;

  const handleCancel = (order: Order) => {
    Alert.alert('Cancel Order', `Are you sure you want to cancel order #${order.id}?`, [
      { text: 'No, Keep Order', style: 'cancel' },
      {
        text: 'Yes, Cancel',
        style: 'destructive',
        onPress: async () => {
          try {
            await orderService.cancelOrder(order.id);
            invalidateOrderQueries(queryClient, order.id);
            Alert.alert('Order Cancelled', `Order #${order.id} has been cancelled.`);
          } catch (err: any) {
            Alert.alert('Could not cancel', err?.message || 'Please try again.');
          }
        },
      },
    ]);
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

      {/* Segmented Tabs: Ongoing, Delivered, Cancelled */}
      <View style={styles.tabsBar}>
        {[
          { id: 'ongoing' as OrderTab, label: 'Ongoing', labelTa: 'விநியோகத்தில்' },
          { id: 'delivered' as OrderTab, label: 'Delivered', labelTa: 'முடிந்தவை' },
          { id: 'cancelled' as OrderTab, label: 'Cancelled', labelTa: 'ரத்து' },
        ].map((t) => ({ ...t, count: t.id === activeTab ? activeTotal : 0 })).map((tab) => {
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
      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : isError && displayOrders.length === 0 ? (
        <EmptyState
          title="Could not load orders"
          description={(error as Error)?.message || 'Please check your connection and try again.'}
          icon="wifi-off"
          actionLabel="Retry"
          onAction={() => refetch()}
        />
      ) : displayOrders.length === 0 ? (
        <EmptyState
          title={
            activeTab === 'ongoing'
              ? 'No Ongoing Orders'
              : activeTab === 'delivered'
              ? 'No Delivered Orders Yet'
              : 'No Cancelled Orders'
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
        <FlatList
          data={displayOrders}
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
          renderItem={({ item: order }) => {
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
                        : order.status === 'cancelled' || order.status === 'rejected'
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
                    {order.sellerName}
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
                      {order.paymentMode === 'cod' ? 'Cash on Delivery' : 'UPI'} • {order.orderDate}
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

                  {/* Delivered: Rate & Review */}
                  {isDelivered && (
                    <>
                      <Pressable
                        onPress={() =>
                          router.push({
                            pathname: '/(buyer)/rate-review',
                            params: { orderId: order.id },
                          })
                        }
                        style={styles.rateBtn}>
                        <MaterialCommunityIcons name="star" size={13} color={colors.white} />
                        <Text style={styles.rateBtnText}>
                          {language === 'ta' ? 'மதிப்பிட' : 'Rate & Review'}
                        </Text>
                      </Pressable>
                    </>
                  )}

                  {/* Before farmer confirmation: Cancel Order */}
                  {(order.status === 'placed' || order.status === 'pending_seller_approval') && (
                    <Pressable
                      onPress={() => handleCancel(order)}
                      style={styles.cancelBtn}>
                      <Text style={styles.cancelBtnText}>Cancel</Text>
                    </Pressable>
                  )}
                </View>
              </Card>
            );
          }}
        />
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
