/**
 * Seller Dashboard Screen
 * Overview of farm earnings, active orders, low stock alerts, farm rating, and the last 7 days of sales,
 * all computed from live API data.
 * Features the signature dark green header with "Seller Mode" pill.
 */

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  Dimensions,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { Card } from '@/components/Card';
import { authService } from '@/services/authService';
import { orderService } from '@/services/orderService';
import { payoutService } from '@/services/payoutService';
import { productService } from '@/services/productService';
import { reviewService } from '@/services/reviewService';
import { useLanguageStore } from '@/store';
import { colors, fontSizes, shadows, spacing } from '@/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const LOW_STOCK_THRESHOLD = 15;
const DAY_LABELS = [
  { en: 'Sun', ta: 'ஞாயிறு' },
  { en: 'Mon', ta: 'திங்கள்' },
  { en: 'Tue', ta: 'செவ்வாய்' },
  { en: 'Wed', ta: 'புதன்' },
  { en: 'Thu', ta: 'வியாழன்' },
  { en: 'Fri', ta: 'வெள்ளி' },
  { en: 'Sat', ta: 'சனி' },
];

interface WeeklySalesDay {
  key: string;
  day: string;
  dayTamil: string;
  amount: number;
  orders: number;
  isToday?: boolean;
}

function parseServerDate(ts?: string): Date | null {
  if (!ts) return null;
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(ts) ? ts : `${ts}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

const formatINR = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

export default function SellerDashboardScreen() {
  const { language } = useLanguageStore();
  const queryClient = useQueryClient();

  const { data: profile } = useQuery({ queryKey: ['me'], queryFn: () => authService.getProfile() });
  const { data: ordersPage, refetch: refetchOrders } = useQuery({
    queryKey: ['orders-mine', 'all', 100, 0],
    queryFn: () => orderService.getMyOrders('all', 100, 0),
    refetchInterval: 60000,
  });
  const { data: productsPage, refetch: refetchProducts } = useQuery({
    queryKey: ['seller-products-dashboard'],
    queryFn: () => productService.getMyProducts({ limit: 100, offset: 0 }),
  });
  const { data: payout, refetch: refetchPayout } = useQuery({
    queryKey: ['payout-summary'],
    queryFn: () => payoutService.getPayoutSummary(),
  });
  const { data: reviewsPage } = useQuery({
    queryKey: ['seller-reviews-summary', profile?.id],
    queryFn: () => reviewService.getSellerReviews(profile!.id, 100, 0),
    enabled: Boolean(profile?.id),
  });

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.allSettled([refetchOrders(), refetchProducts(), refetchPayout()]);
    setRefreshing(false);
  };

  const orders = useMemo(() => ordersPage?.items ?? [], [ordersPage]);
  const products = useMemo(() => productsPage?.items ?? [], [productsPage]);

  const lowStockItems = useMemo(
    () => products.filter((p) => p.isActive !== false && p.stock <= LOW_STOCK_THRESHOLD),
    [products]
  );

  // Last 7 days of non-cancelled orders, grouped by local calendar day
  const weeklyData: WeeklySalesDay[] = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days: WeeklySalesDay[] = [];
    for (let offset = 6; offset >= 0; offset--) {
      const d = new Date(today);
      d.setDate(today.getDate() - offset);
      const label = DAY_LABELS[d.getDay()];
      days.push({ key: d.toDateString(), day: label.en, dayTamil: label.ta, amount: 0, orders: 0, isToday: offset === 0 });
    }
    for (const o of orders) {
      if (o.status === 'cancelled' || o.status === 'rejected') continue;
      const created = parseServerDate(o.createdAt);
      if (!created) continue;
      created.setHours(0, 0, 0, 0);
      const bucket = days.find((d) => d.key === created.toDateString());
      if (bucket) {
        bucket.amount += o.grandTotal;
        bucket.orders += 1;
      }
    }
    return days;
  }, [orders]);

  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  const selectedDay = weeklyData.find((d) => d.key === selectedDayKey) ?? weeklyData[weeklyData.length - 1];
  const totalWeeklySales = weeklyData.reduce((acc, curr) => acc + curr.amount, 0);
  const maxWeeklyAmount = Math.max(1, ...weeklyData.map((d) => d.amount));

  const todayStats = weeklyData[weeklyData.length - 1];
  const activeOrders = orders.filter((o) => o.tab === 'ongoing').length;

  const reviews = reviewsPage?.items ?? [];
  const avgRating = reviews.length
    ? reviews.reduce((acc, r) => acc + r.farmer_rating, 0) / reviews.length
    : null;

  // Quick Restock handler for low-stock alert
  const handleQuickRestock = (productId: string, currentStock: number, name: string) => {
    Alert.alert(
      language === 'ta' ? 'கையிருப்பு புதுப்பிப்பு' : 'Restock Harvest',
      language === 'ta'
        ? `${name} பயிருக்கு மேலும் 50 அலகுகள் சேர்க்கவா?`
        : `Add +50 stock units to ${name}?`,
      [
        { text: language === 'ta' ? 'ரத்து' : 'Cancel', style: 'cancel' },
        {
          text: language === 'ta' ? '+50 சேர்க்க' : '+50 Add Stock',
          onPress: async () => {
            try {
              await productService.updateStock(productId, currentStock + 50);
              queryClient.invalidateQueries({ queryKey: ['seller-products-dashboard'] });
              queryClient.invalidateQueries({ queryKey: ['seller-my-products-infinite'] });
              Alert.alert(
                language === 'ta' ? 'புதுப்பிக்கப்பட்டது' : 'Stock Updated',
                `${name} stock is now ${currentStock + 50}.`
              );
            } catch (err: any) {
              Alert.alert('Could not update stock', err?.message || 'Please try again.');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.screen}>
      {/* Signature Dark Green Header with Seller Mode Pill */}
      <AppHeader
        isSeller={true}
        title={language === 'ta' ? 'பண்ணை டாஷ்போர்டு' : 'Farm Dashboard'}
        showSearch={false}
        showCart={false}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}>
        {/* Farm & Seller Welcome Banner */}
        <View style={styles.welcomeBanner}>
          <View style={styles.avatarBox}>
            <MaterialCommunityIcons name="tractor" size={28} color={colors.white} />
          </View>
          <View style={styles.welcomeInfo}>
            <View style={styles.farmerNameRow}>
              <Text style={styles.welcomeFarmer}>{profile?.name || (language === 'ta' ? 'விவசாயி' : 'Farmer')}</Text>
            </View>
            {profile?.address ? <Text style={styles.farmSub}>{profile.address}</Text> : null}
            {!profile?.upi_id ? (
              <Pressable onPress={() => router.push('/(seller)/(tabs)/profile')}>
                <Text style={styles.farmSub}>
                  {language === 'ta' ? '⚠️ UPI கட்டணம் பெற உங்கள் UPI ஐடியைச் சேர்க்கவும்' : '⚠️ Add your UPI ID to receive online payments'}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        {/* 4 Core Metric KPI Cards */}
        <View style={styles.metricsGrid}>
          {/* 1. Active Orders */}
          <Card style={styles.metricCard}>
            <View style={[styles.metricIconBg, { backgroundColor: '#E3F2FD' }]}>
              <MaterialCommunityIcons name="truck-fast" size={20} color="#1976D2" />
            </View>
            <Text style={styles.metricValue}>{activeOrders}</Text>
            <Text style={styles.metricLabel}>
              {language === 'ta' ? 'நடப்பு ஆர்டர்கள்' : 'Active Orders'}
            </Text>
            <Text style={styles.metricDelta}>{todayStats?.orders ?? 0} placed today</Text>
          </Card>

          {/* 2. Earnings */}
          <Card style={styles.metricCard}>
            <View style={[styles.metricIconBg, { backgroundColor: '#E8F5E9' }]}>
              <MaterialCommunityIcons name="currency-inr" size={20} color={colors.primaryDark} />
            </View>
            <Text style={styles.metricValue}>{formatINR(payout?.total_earnings ?? 0)}</Text>
            <Text style={styles.metricLabel}>
              {language === 'ta' ? 'மொத்த வருவாய்' : 'Delivered Earnings'}
            </Text>
            <Text style={[styles.metricDelta, { color: colors.primaryDark }]}>
              COD pending {formatINR(payout?.cod_pending ?? 0)}
            </Text>
          </Card>

          {/* 3. Farm Rating */}
          <Card style={styles.metricCard}>
            <View style={[styles.metricIconBg, { backgroundColor: '#FFF8E1' }]}>
              <MaterialCommunityIcons name="star" size={20} color="#F57F17" />
            </View>
            <View style={styles.ratingRow}>
              <Text style={styles.metricValue}>{avgRating !== null ? avgRating.toFixed(1) : '—'}</Text>
              <Text style={styles.ratingMax}>/ 5</Text>
            </View>
            <Text style={styles.metricLabel}>
              {language === 'ta' ? 'பண்ணை மதிப்பீடு' : 'Farmer Rating'}
            </Text>
            <Text style={styles.metricDelta}>
              {reviewsPage?.total ?? 0} reviews
            </Text>
          </Card>

          {/* 4. Active Crops */}
          <Card style={styles.metricCard}>
            <View style={[styles.metricIconBg, { backgroundColor: '#EDE7F6' }]}>
              <MaterialCommunityIcons name="sprout" size={20} color="#5E35B1" />
            </View>
            <Text style={styles.metricValue}>
              {products.filter((p) => p.isActive !== false).length}
            </Text>
            <Text style={styles.metricLabel}>
              {language === 'ta' ? 'செயலில் உள்ளவை' : 'Active Crops'}
            </Text>
            <Text style={styles.metricDelta}>
              {productsPage?.total ?? products.length} total listed
            </Text>
          </Card>
        </View>

        {/* Low Stock Alerts Banner / Section */}
        {lowStockItems.length > 0 && (
          <Card style={styles.lowStockSectionCard}>
            <View style={styles.lowStockHeaderRow}>
              <View style={styles.lowStockTitleRow}>
                <View style={styles.warningIconBg}>
                  <MaterialCommunityIcons name="alert" size={18} color="#D32F2F" />
                </View>
                <View>
                  <Text style={styles.lowStockTitle}>
                    {language === 'ta'
                      ? 'குறைந்த கையிருப்பு எச்சரிக்கை'
                      : 'Low Stock Alerts'}
                  </Text>
                  <Text style={styles.lowStockSubtitle}>
                    {lowStockItems.length}{' '}
                    {lowStockItems.length === 1 ? 'crop needs' : 'crops need'}{' '}
                    harvest replenish
                  </Text>
                </View>
              </View>
              <Pressable
                onPress={() => router.push('/(seller)/(tabs)/products')}
                hitSlop={6}>
                <Text style={styles.viewInventoryLink}>
                  {language === 'ta' ? 'அனைத்தும்' : 'Manage'}
                </Text>
              </Pressable>
            </View>

            <View style={styles.lowStockList}>
              {lowStockItems.map((item) => (
                <View key={item.id} style={styles.lowStockItemRow}>
                  <View style={styles.lowStockCropInfo}>
                    <Text style={styles.lowStockCropName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.lowStockBadgeText}>
                      Only {item.stock} {item.unit} remaining
                    </Text>
                  </View>
                  <Pressable
                    style={styles.restockBtn}
                    onPress={() =>
                      handleQuickRestock(item.id, item.stock, item.name)
                    }>
                    <MaterialCommunityIcons
                      name="plus-circle-outline"
                      size={14}
                      color={colors.white}
                    />
                    <Text style={styles.restockBtnText}>
                      {language === 'ta' ? 'சேர்' : '+ Restock'}
                    </Text>
                  </Pressable>
                </View>
              ))}
            </View>
          </Card>
        )}

        {/* Weekly Sales Chart (last 7 days, from real orders) */}
        <Card style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <View>
              <Text style={styles.chartTitle}>
                {language === 'ta' ? 'கடந்த 7 நாட்கள் விற்பனை' : 'Last 7 Days Sales'}
              </Text>
              <Text style={styles.chartSubtitle}>Total: {formatINR(totalWeeklySales)}</Text>
            </View>
            {selectedDay ? (
              <View style={styles.chartBadge}>
                <Text style={styles.chartBadgeText}>
                  {selectedDay.day}: {formatINR(selectedDay.amount)} ({selectedDay.orders} orders)
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.barContainer}>
            {weeklyData.map((item) => {
              const isSelected = selectedDay?.key === item.key;
              const barHeightPct = item.amount > 0 ? Math.max(8, (item.amount / maxWeeklyAmount) * 100) : 2;

              return (
                <Pressable
                  key={item.key}
                  onPress={() => setSelectedDayKey(item.key)}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.day}: ${formatINR(item.amount)}, ${item.orders} orders`}
                  style={styles.barColumn}>
                  <Text style={[styles.barValueTag, isSelected && styles.barValueTagActive]}>
                    {item.amount >= 1000 ? `₹${(item.amount / 1000).toFixed(1)}k` : `₹${Math.round(item.amount)}`}
                  </Text>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        { height: `${barHeightPct}%` },
                        isSelected && styles.barFillSelected,
                        item.isToday && styles.barFillToday,
                      ]}
                    />
                  </View>
                  <Text
                    style={[
                      styles.barDayLabel,
                      isSelected && styles.barDayLabelSelected,
                    ]}>
                    {language === 'ta' ? item.dayTamil.slice(0, 3) : item.day}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Card>

        {/* Quick Actions Row */}
        <View style={styles.quickActionsGrid}>
          <Pressable
            style={[styles.quickActionBtn, { backgroundColor: colors.primaryDark }]}
            onPress={() => router.push('/(seller)/add-product')}>
            <MaterialCommunityIcons name="sprout" size={20} color={colors.white} />
            <Text style={styles.quickActionText}>
              {language === 'ta' ? 'புதிய பயிர் சேர்க்க' : 'Add New Crop'}
            </Text>
          </Pressable>

          <Pressable
            style={[styles.quickActionBtn, { backgroundColor: colors.accent }]}
            onPress={() => router.push('/(seller)/(tabs)/orders')}>
            <MaterialCommunityIcons name="clipboard-list-outline" size={20} color={colors.white} />
            <Text style={styles.quickActionText}>
              {language === 'ta' ? 'ஆர்டர்கள் மேலாண்மை' : 'Manage Orders'}
            </Text>
          </Pressable>
        </View>
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
    paddingBottom: spacing.xxl + 20,
  },
  welcomeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryDark,
    borderRadius: 14,
    padding: spacing.md,
    gap: spacing.sm + 2,
    ...shadows.soft,
  },
  avatarBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcomeInfo: {
    flex: 1,
  },
  farmerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  welcomeFarmer: {
    fontSize: fontSizes.md + 1,
    fontWeight: '800',
    color: colors.white,
  },
  verifiedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
    gap: 2,
  },
  verifiedText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.white,
  },
  farmSub: {
    fontSize: 11,
    color: colors.primaryLight,
    marginTop: 2,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  metricCard: {
    width: (SCREEN_WIDTH - spacing.md * 2 - spacing.sm) / 2,
    padding: spacing.sm + 2,
    gap: 2,
  },
  metricIconBg: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  metricValue: {
    fontSize: fontSizes.lg,
    fontWeight: '900',
    color: colors.text,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  ratingMax: {
    fontSize: 11,
    color: colors.textSecondary,
    marginLeft: 2,
  },
  metricLabel: {
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  metricDelta: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
  },
  lowStockSectionCard: {
    backgroundColor: '#FFF8F8',
    borderWidth: 1.5,
    borderColor: '#FFCDD2',
    gap: spacing.sm,
  },
  lowStockHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lowStockTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    flex: 1,
  },
  warningIconBg: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFEBEE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lowStockTitle: {
    fontSize: fontSizes.sm,
    fontWeight: '800',
    color: '#C62828',
  },
  lowStockSubtitle: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  viewInventoryLink: {
    fontSize: fontSizes.xs,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  lowStockList: {
    gap: 8,
    marginTop: 4,
  },
  lowStockItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFEBEE',
  },
  lowStockCropInfo: {
    flex: 1,
    marginRight: 8,
  },
  lowStockCropName: {
    fontSize: fontSizes.xs + 1,
    fontWeight: '700',
    color: colors.text,
  },
  lowStockBadgeText: {
    fontSize: 10,
    color: '#D32F2F',
    fontWeight: '600',
    marginTop: 1,
  },
  restockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    gap: 4,
  },
  restockBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.white,
  },
  chartCard: {
    gap: spacing.md,
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  chartTitle: {
    fontSize: fontSizes.sm + 1,
    fontWeight: '800',
    color: colors.text,
  },
  chartSubtitle: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  chartGrowthTag: {
    color: colors.primaryDark,
    fontWeight: '700',
  },
  chartBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  chartBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  barContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 140,
    paddingTop: 16,
    paddingBottom: 4,
  },
  barColumn: {
    alignItems: 'center',
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
  },
  barValueTag: {
    fontSize: 9,
    color: colors.textMuted,
    marginBottom: 4,
  },
  barValueTagActive: {
    color: colors.primaryDark,
    fontWeight: '800',
  },
  barTrack: {
    width: 22,
    height: 90,
    backgroundColor: '#F1F8E9',
    borderRadius: 6,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    backgroundColor: colors.primary,
    borderRadius: 6,
  },
  barFillSelected: {
    backgroundColor: colors.primaryDark,
  },
  barFillToday: {
    backgroundColor: colors.accent,
  },
  barDayLabel: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 6,
    fontWeight: '600',
  },
  barDayLabelSelected: {
    color: colors.primaryDark,
    fontWeight: '800',
  },
  quickActionsGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  quickActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
    ...shadows.soft,
  },
  quickActionText: {
    fontSize: fontSizes.xs + 1,
    fontWeight: '800',
    color: colors.white,
  },
  mandiCard: {
    gap: spacing.xs + 2,
  },
  mandiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  mandiHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  mandiTitle: {
    fontSize: fontSizes.sm,
    fontWeight: '800',
    color: colors.text,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    gap: 4,
  },
  liveBlinkDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D32F2F',
  },
  mandiLiveTag: {
    fontSize: 9,
    fontWeight: '900',
    color: '#D32F2F',
  },
  rateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  cropName: {
    fontSize: fontSizes.xs,
    color: colors.text,
  },
  cropPrice: {
    fontSize: fontSizes.xs,
    fontWeight: '700',
    color: colors.primaryDark,
  },
});
