/**
 * Seller Dashboard Screen
 * Overview of farm earnings, today's orders, low stock alerts, farm rating, and weekly sales chart.
 * Features the signature dark green header with "Seller Mode" pill.
 */

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { Card } from '@/components/Card';
import {
  useLanguageStore,
  useOrderStore,
  useSellerProductStore,
} from '@/store';
import { colors, fontSizes, shadows, spacing } from '@/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface WeeklySalesDay {
  day: string;
  dayTamil: string;
  amount: number;
  orders: number;
  isToday?: boolean;
}

const WEEKLY_DATA: WeeklySalesDay[] = [
  { day: 'Mon', dayTamil: 'திங்கள்', amount: 8500, orders: 4 },
  { day: 'Tue', dayTamil: 'செவ்வாய்', amount: 11200, orders: 5 },
  { day: 'Wed', dayTamil: 'புதன்', amount: 9800, orders: 4 },
  { day: 'Thu', dayTamil: 'வியாழன்', amount: 14500, orders: 7 },
  { day: 'Fri', dayTamil: 'வெள்ளி', amount: 16200, orders: 8 },
  { day: 'Sat', dayTamil: 'சனி', amount: 21000, orders: 11 },
  { day: 'Sun', dayTamil: 'ஞாயிறு', amount: 18450, orders: 9, isToday: true },
];

export default function SellerDashboardScreen() {
  const { language } = useLanguageStore();
  const { orders } = useOrderStore();
  const { products, updateStock } = useSellerProductStore();

  const [selectedDay, setSelectedDay] = useState<WeeklySalesDay>(WEEKLY_DATA[6]);

  const lowStockItems = useMemo(
    () => products.filter((p) => p.isActive && p.stock <= 15),
    [products]
  );

  const totalWeeklySales = WEEKLY_DATA.reduce((acc, curr) => acc + curr.amount, 0);
  const maxWeeklyAmount = Math.max(...WEEKLY_DATA.map((d) => d.amount));

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
          onPress: () => {
            updateStock(productId, currentStock + 50);
            Alert.alert(
              language === 'ta' ? 'புதுப்பிக்கப்பட்டது' : 'Stock Updated',
              `${name} stock is now ${currentStock + 50}.`
            );
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
        showsVerticalScrollIndicator={false}>
        {/* Farm & Seller Welcome Banner */}
        <View style={styles.welcomeBanner}>
          <View style={styles.avatarBox}>
            <MaterialCommunityIcons name="tractor" size={28} color={colors.white} />
          </View>
          <View style={styles.welcomeInfo}>
            <View style={styles.farmerNameRow}>
              <Text style={styles.welcomeFarmer}>Ramasamy Gounder</Text>
              <View style={styles.verifiedTag}>
                <MaterialCommunityIcons name="check-decagram" size={13} color={colors.white} />
                <Text style={styles.verifiedText}>Verified</Text>
              </View>
            </View>
            <Text style={styles.farmSub}>
              Vadipatti Iyarkai Pannai • Madurai District
            </Text>
          </View>
        </View>

        {/* 4 Core Metric KPI Cards: Today's Orders, Earnings, Rating, Active Crops */}
        <View style={styles.metricsGrid}>
          {/* 1. Today's Orders */}
          <Card style={styles.metricCard}>
            <View style={[styles.metricIconBg, { backgroundColor: '#E3F2FD' }]}>
              <MaterialCommunityIcons name="truck-fast" size={20} color="#1976D2" />
            </View>
            <Text style={styles.metricValue}>
              {orders.filter((o) => o.tab === 'ongoing').length || 6}
            </Text>
            <Text style={styles.metricLabel}>
              {language === 'ta' ? "இன்றைய ஆர்டர்கள்" : "Today's Orders"}
            </Text>
            <Text style={styles.metricDelta}>+2 from yesterday</Text>
          </Card>

          {/* 2. Today's Earnings */}
          <Card style={styles.metricCard}>
            <View style={[styles.metricIconBg, { backgroundColor: '#E8F5E9' }]}>
              <MaterialCommunityIcons name="currency-inr" size={20} color={colors.primaryDark} />
            </View>
            <Text style={styles.metricValue}>₹18,450</Text>
            <Text style={styles.metricLabel}>
              {language === 'ta' ? 'இன்றைய வருவாய்' : "Today's Earnings"}
            </Text>
            <Text style={[styles.metricDelta, { color: colors.primaryDark }]}>
              ₹74,200 this mo.
            </Text>
          </Card>

          {/* 3. Farm Rating */}
          <Card style={styles.metricCard}>
            <View style={[styles.metricIconBg, { backgroundColor: '#FFF8E1' }]}>
              <MaterialCommunityIcons name="star" size={20} color="#F57F17" />
            </View>
            <View style={styles.ratingRow}>
              <Text style={styles.metricValue}>4.9</Text>
              <Text style={styles.ratingMax}>/ 5</Text>
            </View>
            <Text style={styles.metricLabel}>
              {language === 'ta' ? 'பண்ணை மதிப்பீடு' : 'Farmer Rating'}
            </Text>
            <Text style={styles.metricDelta}>148 verified reviews</Text>
          </Card>

          {/* 4. Active Crops */}
          <Card style={styles.metricCard}>
            <View style={[styles.metricIconBg, { backgroundColor: '#EDE7F6' }]}>
              <MaterialCommunityIcons name="sprout" size={20} color="#5E35B1" />
            </View>
            <Text style={styles.metricValue}>
              {products.filter((p) => p.isActive).length}
            </Text>
            <Text style={styles.metricLabel}>
              {language === 'ta' ? 'செயலில் உள்ளவை' : 'Active Crops'}
            </Text>
            <Text style={styles.metricDelta}>
              {products.length} total listed
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

        {/* Simple Weekly Sales Chart */}
        <Card style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <View>
              <Text style={styles.chartTitle}>
                {language === 'ta' ? 'வாராந்திர விற்பனை வரைபடம்' : 'Weekly Sales Performance'}
              </Text>
              <Text style={styles.chartSubtitle}>
                Total: ₹{totalWeeklySales.toLocaleString('en-IN')}{' '}
                <Text style={styles.chartGrowthTag}>+24% vs last week</Text>
              </Text>
            </View>
            <View style={styles.chartBadge}>
              <Text style={styles.chartBadgeText}>
                {selectedDay.day}: ₹{selectedDay.amount.toLocaleString('en-IN')} (
                {selectedDay.orders} orders)
              </Text>
            </View>
          </View>

          {/* Bar Chart Visualization */}
          <View style={styles.barContainer}>
            {WEEKLY_DATA.map((item) => {
              const isSelected = selectedDay.day === item.day;
              const barHeightPct = Math.max(15, (item.amount / maxWeeklyAmount) * 100);

              return (
                <Pressable
                  key={item.day}
                  onPress={() => setSelectedDay(item)}
                  style={styles.barColumn}>
                  <Text style={[styles.barValueTag, isSelected && styles.barValueTagActive]}>
                    ₹{(item.amount / 1000).toFixed(1)}k
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

        {/* Live Mandi Benchmark Rates */}
        <Card style={styles.mandiCard}>
          <View style={styles.mandiHeader}>
            <View style={styles.mandiHeaderLeft}>
              <MaterialCommunityIcons
                name="chart-line"
                size={20}
                color={colors.primary}
              />
              <Text style={styles.mandiTitle}>
                {language === 'ta'
                  ? 'இன்றைய மண்டி நேரடி விலை'
                  : "Today's Mandi Benchmark Rates"}
              </Text>
            </View>
            <View style={styles.livePill}>
              <View style={styles.liveBlinkDot} />
              <Text style={styles.mandiLiveTag}>LIVE</Text>
            </View>
          </View>

          <View style={styles.rateRow}>
            <Text style={styles.cropName}>Country Tomato (நாட்டு தக்காளி)</Text>
            <Text style={styles.cropPrice}>₹32 - ₹36 / kg</Text>
          </View>
          <View style={styles.rateRow}>
            <Text style={styles.cropName}>Shallot Onion (சின்ன வெங்காயம்)</Text>
            <Text style={styles.cropPrice}>₹42 - ₹48 / kg</Text>
          </View>
          <View style={styles.rateRow}>
            <Text style={styles.cropName}>Seeraga Samba Nellu (சீரக சம்பா)</Text>
            <Text style={styles.cropPrice}>₹4,000 - ₹4,400 / quintal</Text>
          </View>
          <View style={styles.rateRow}>
            <Text style={styles.cropName}>Organic Cow Dung (மாட்டு எருவு)</Text>
            <Text style={styles.cropPrice}>₹3,200 - ₹3,600 / tractor</Text>
          </View>
        </Card>
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
