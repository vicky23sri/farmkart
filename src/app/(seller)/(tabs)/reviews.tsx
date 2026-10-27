/**
 * Seller Reviews & Payouts Screen
 * Features:
 * - Segmented switch between "Buyer Reviews" and "Payouts & COD Status"
 * - Reviews with Farmer Reply feature (modal reply prompt & instant response display)
 * - Payouts Overview with detailed COD Collection Status (driver cash handover & bank remittance)
 * - Features the signature dark green header with "Seller Mode" pill.
 */

import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useState } from 'react';
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
import { RatingStars } from '@/components/RatingStars';
import { useLanguageStore } from '@/store';
import { colors, fontSizes, shadows, spacing } from '@/theme';

interface SellerReviewItem {
  id: string;
  buyer: string;
  date: string;
  crop: string;
  rating: number;
  tags: string[];
  comment: string;
  farmerReply?: string;
  replyDate?: string;
}

interface CodHandoverItem {
  id: string;
  driverName: string;
  vehicle: string;
  orderId: string;
  amount: number;
  status: 'pending_deposit' | 'deposited' | 'settled';
}

const INITIAL_REVIEWS: SellerReviewItem[] = [
  {
    id: 'rev-1',
    buyer: 'Karthik V.',
    date: 'Today, 3:45 PM',
    crop: 'Country Tomatoes (நாட்டு தக்காளி)',
    rating: 5.0,
    tags: ['Fresh Harvest', 'Good Packaging', 'On Time'],
    comment:
      'Super fresh organic harvest! Picked straight from the vines and delivered the same afternoon. Authentic country taste.',
    farmerReply:
      'மிக்க நன்றி கார்த்திக் தம்பி! அடுத்த அறுவடை 10 நாட்களில் தயாராகும். (Thank you Karthik! Next batch ready in 10 days.)',
    replyDate: 'Today, 4:10 PM',
  },
  {
    id: 'rev-2',
    buyer: 'Meenakshi Sundaram',
    date: 'Yesterday',
    crop: 'Seeraga Samba Nellu (சீரக சம்பா)',
    rating: 4.8,
    tags: ['Fair Price', '100% Organic', 'Careful Handling'],
    comment:
      'Aged Cauvery delta paddy with zero chemical smell. Cooked aromatic biryani. Will buy full year harvest directly.',
  },
  {
    id: 'rev-3',
    buyer: 'Dr. S. Rajendran',
    date: '3 days ago',
    crop: 'Desi Cow Dung Vermicompost (மண்புழு உரம்)',
    rating: 5.0,
    tags: ['100% Organic', 'Friendly Farmer'],
    comment:
      'Loaded directly onto our farm pickup. Well-cured 9 months compost, rich dark texture. Garden plants are thriving!',
  },
];

const COD_HANDOVERS: CodHandoverItem[] = [
  {
    id: 'cod-1',
    driverName: 'Senthil Kumar',
    vehicle: 'Two-Wheeler Express (TN-59-BZ-4102)',
    orderId: 'ORD-7821',
    amount: 219,
    status: 'pending_deposit',
  },
  {
    id: 'cod-2',
    driverName: 'Murugan',
    vehicle: 'Mini Truck (TN-58-BZ-4412)',
    orderId: 'ORD-6402',
    amount: 690,
    status: 'deposited',
  },
  {
    id: 'cod-3',
    driverName: 'Palanisamy',
    vehicle: 'Tractor Trolley (TN-59-AG-1892)',
    orderId: 'ORD-3912',
    amount: 3500,
    status: 'settled',
  },
];

export default function SellerReviewsScreen() {
  const { language } = useLanguageStore();

  const [activeSegment, setActiveSegment] = useState<'reviews' | 'payouts'>('reviews');
  const [reviewsList, setReviewsList] = useState<SellerReviewItem[]>(INITIAL_REVIEWS);

  // Reply Modal State
  const [replyModalReview, setReplyModalReview] = useState<SellerReviewItem | null>(null);
  const [replyInputText, setReplyInputText] = useState('');

  // Open Reply Modal
  const openReplyModal = (review: SellerReviewItem) => {
    setReplyModalReview(review);
    setReplyInputText(review.farmerReply || '');
  };

  // Submit Farmer Reply
  const handleSaveReply = () => {
    if (!replyModalReview || !replyInputText.trim()) return;

    setReviewsList((prev) =>
      prev.map((r) =>
        r.id === replyModalReview.id
          ? {
              ...r,
              farmerReply: replyInputText.trim(),
              replyDate: 'Just now',
            }
          : r
      )
    );

    setReplyModalReview(null);

    Alert.alert(
      language === 'ta' ? 'பதில் அனுப்பப்பட்டது' : 'Reply Published',
      language === 'ta'
        ? 'வாங்குபவருக்கு உங்கள் பதில் அனுப்பப்பட்டது.'
        : 'Your reply has been published and is visible to marketplace buyers.'
    );
  };

  return (
    <View style={styles.screen}>
      {/* Signature Dark Green Header with Seller Mode Pill */}
      <AppHeader
        isSeller={true}
        title={language === 'ta' ? 'மதிப்பீடு & வருவாய்' : 'Reviews & Payouts'}
        showSearch={false}
        showCart={false}
      />

      {/* Top Segmented Selector: Reviews vs Payouts */}
      <View style={styles.segmentBar}>
        <Pressable
          style={[
            styles.segmentBtn,
            activeSegment === 'reviews' && styles.segmentBtnActive,
          ]}
          onPress={() => setActiveSegment('reviews')}>
          <MaterialCommunityIcons
            name="star-circle"
            size={18}
            color={activeSegment === 'reviews' ? colors.primaryDark : colors.textSecondary}
          />
          <Text
            style={[
              styles.segmentBtnText,
              activeSegment === 'reviews' && styles.segmentBtnTextActive,
            ]}>
            {language === 'ta' ? 'வாங்குபவர் மதிப்பீடு' : 'Buyer Reviews'}
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.segmentBtn,
            activeSegment === 'payouts' && styles.segmentBtnActive,
          ]}
          onPress={() => setActiveSegment('payouts')}>
          <MaterialCommunityIcons
            name="cash-check"
            size={18}
            color={activeSegment === 'payouts' ? colors.primaryDark : colors.textSecondary}
          />
          <Text
            style={[
              styles.segmentBtnText,
              activeSegment === 'payouts' && styles.segmentBtnTextActive,
            ]}>
            {language === 'ta' ? 'வருவாய் & COD' : 'Payouts & COD'}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* ======================================================== */}
        {/* TAB 1: BUYER REVIEWS WITH FARMER REPLY */}
        {/* ======================================================== */}
        {activeSegment === 'reviews' && (
          <>
            {/* Overall Farm Rating Card */}
            <Card style={styles.summaryCard}>
              <View style={styles.ratingScoreCol}>
                <Text style={styles.summaryScore}>4.9</Text>
                <RatingStars rating={4.9} size={18} showScore={false} />
                <Text style={styles.summaryText}>148 verified orders</Text>
              </View>

              <View style={styles.summaryBreakdownCol}>
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>Product Freshness</Text>
                  <Text style={styles.breakdownVal}>4.9 ★</Text>
                </View>
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>Farmer & Farm Trust</Text>
                  <Text style={styles.breakdownVal}>5.0 ★</Text>
                </View>
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>Logistics & Dispatch</Text>
                  <Text style={styles.breakdownVal}>4.8 ★</Text>
                </View>
              </View>
            </Card>

            <Text style={styles.sectionTitle}>
              {language === 'ta' ? 'வாங்குபவர் கருத்துகள்' : 'Recent Customer Reviews'}
            </Text>

            <View style={styles.reviewsList}>
              {reviewsList.map((rev) => (
                <Card key={rev.id} style={styles.reviewCard}>
                  {/* Review Header */}
                  <View style={styles.reviewHeader}>
                    <View>
                      <View style={styles.buyerNameRow}>
                        <Text style={styles.buyerName}>{rev.buyer}</Text>
                        <View style={styles.verifiedBuyerTag}>
                          <MaterialCommunityIcons
                            name="check-circle"
                            size={12}
                            color={colors.primaryDark}
                          />
                          <Text style={styles.verifiedBuyerText}>Verified Buyer</Text>
                        </View>
                      </View>
                      <Text style={styles.cropTag}>{rev.crop}</Text>
                    </View>
                    <Text style={styles.reviewDate}>{rev.date}</Text>
                  </View>

                  <RatingStars rating={rev.rating} size={14} />

                  {/* Quick Tags */}
                  {rev.tags && rev.tags.length > 0 && (
                    <View style={styles.tagsRow}>
                      {rev.tags.map((t, idx) => (
                        <View key={idx} style={styles.tagPill}>
                          <Text style={styles.tagPillText}>✓ {t}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  <Text style={styles.commentText}>{rev.comment}</Text>

                  {/* Existing Farmer Reply */}
                  {rev.farmerReply && (
                    <View style={styles.farmerReplyBox}>
                      <View style={styles.replyHeaderRow}>
                        <MaterialCommunityIcons
                          name="tractor"
                          size={14}
                          color={colors.primaryDark}
                        />
                        <Text style={styles.replyTitle}>Your Reply as Farmer:</Text>
                        {rev.replyDate && (
                          <Text style={styles.replyDateText}>{rev.replyDate}</Text>
                        )}
                      </View>
                      <Text style={styles.replyContentText}>{rev.farmerReply}</Text>
                    </View>
                  )}

                  {/* Reply Button */}
                  <Pressable
                    style={styles.replyBtn}
                    onPress={() => openReplyModal(rev)}>
                    <MaterialCommunityIcons
                      name="reply"
                      size={14}
                      color={colors.primaryDark}
                    />
                    <Text style={styles.replyBtnText}>
                      {rev.farmerReply
                        ? language === 'ta'
                          ? 'பதிலை மாற்று'
                          : 'Edit Reply'
                        : language === 'ta'
                        ? 'வாங்குபவருக்கு பதிலளி'
                        : 'Reply to Buyer'}
                    </Text>
                  </Pressable>
                </Card>
              ))}
            </View>
          </>
        )}

        {/* ======================================================== */}
        {/* TAB 2: PAYOUTS & COD COLLECTION STATUS */}
        {/* ======================================================== */}
        {activeSegment === 'payouts' && (
          <>
            {/* Net Payout Balance Card */}
            <Card style={styles.payoutOverviewCard}>
              <View style={styles.payoutHeaderRow}>
                <View>
                  <Text style={styles.payoutLabel}>Total Settled Earnings (This Month)</Text>
                  <Text style={styles.payoutTotalAmount}>₹84,250</Text>
                </View>
                <View style={styles.subsidyBadge}>
                  <Text style={styles.subsidyBadgeText}>0% Platform Fee</Text>
                </View>
              </View>

              <View style={styles.payoutDetailsGrid}>
                <View style={styles.payoutGridCol}>
                  <Text style={styles.gridSubLabel}>Available for Transfer</Text>
                  <Text style={styles.gridSubValue}>₹18,450</Text>
                </View>
                <View style={styles.payoutGridDivider} />
                <View style={styles.payoutGridCol}>
                  <Text style={styles.gridSubLabel}>Next NEFT Cycle</Text>
                  <Text style={[styles.gridSubValue, { color: colors.primaryDark }]}>
                    Today, 6:00 PM
                  </Text>
                </View>
              </View>
            </Card>

            {/* COD Collection Status Card */}
            <Card style={styles.codStatusCard}>
              <View style={styles.codHeaderRow}>
                <View style={styles.codIconCircle}>
                  <MaterialCommunityIcons name="cash-multiple" size={22} color="#E65100" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.codCardTitle}>
                    {language === 'ta'
                      ? 'பொருளைப் பெற்றவுடன் ரொக்கம் (COD நிலவரம்)'
                      : 'Cash on Delivery (COD) Collection Status'}
                  </Text>
                  <Text style={styles.codCardSubtitle}>
                    Real-time driver collections & Mandi cash desk deposits
                  </Text>
                </View>
              </View>

              {/* COD Balance Metrics */}
              <View style={styles.codMetricsRow}>
                <View style={styles.codMetricBox}>
                  <Text style={styles.codMetricValue}>₹4,409</Text>
                  <Text style={styles.codMetricLabel}>Cash with Delivery Drivers</Text>
                  <Text style={styles.codMetricHint}>Awaiting daily deposit</Text>
                </View>

                <View style={styles.codMetricBox}>
                  <Text style={[styles.codMetricValue, { color: colors.success }]}>
                    ₹32,150
                  </Text>
                  <Text style={styles.codMetricLabel}>COD Deposited to Bank</Text>
                  <Text style={styles.codMetricHint}>Verified NEFT credited</Text>
                </View>
              </View>

              {/* Driver Handover List */}
              <Text style={styles.handoverHeading}>Driver COD Handover Log:</Text>
              <View style={styles.handoverList}>
                {COD_HANDOVERS.map((item) => (
                  <View key={item.id} style={styles.handoverItem}>
                    <View style={styles.handoverLeft}>
                      <Text style={styles.driverNameText}>{item.driverName}</Text>
                      <Text style={styles.driverVehicleText}>{item.vehicle}</Text>
                      <Text style={styles.orderRefText}>Ref: {item.orderId}</Text>
                    </View>

                    <View style={styles.handoverRight}>
                      <Text style={styles.handoverAmount}>₹{item.amount}</Text>
                      <View
                        style={[
                          styles.statusPill,
                          item.status === 'settled'
                            ? styles.statusPillSettled
                            : item.status === 'deposited'
                            ? styles.statusPillDeposited
                            : styles.statusPillPending,
                        ]}>
                        <Text
                          style={[
                            styles.statusPillText,
                            item.status === 'settled'
                              ? styles.statusTextSettled
                              : item.status === 'deposited'
                              ? styles.statusTextDeposited
                              : styles.statusTextPending,
                          ]}>
                          {item.status === 'settled'
                            ? 'Credited to Bank'
                            : item.status === 'deposited'
                            ? 'At Mandi Desk'
                            : 'In Transit'}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            </Card>

            {/* Connected Bank Account Details */}
            <Card style={styles.bankCard}>
              <View style={styles.bankHeaderRow}>
                <View style={styles.bankIconBg}>
                  <MaterialCommunityIcons name="bank" size={20} color={colors.primaryDark} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.bankTitle}>Direct Bank Settlement Account</Text>
                  <Text style={styles.bankSubtitle}>
                    State Bank of India (SBI) • Agritech Branch
                  </Text>
                </View>
                <View style={styles.verifiedTag}>
                  <MaterialCommunityIcons name="check-decagram" size={14} color={colors.primaryDark} />
                  <Text style={styles.verifiedTagText}>Active</Text>
                </View>
              </View>

              <View style={styles.accountNumberRow}>
                <Text style={styles.accountNumberLabel}>Account:</Text>
                <Text style={styles.accountNumberValue}>•••• •••• •••• 4891</Text>
                <Text style={styles.ifscText}>IFSC: SBIN0001234</Text>
              </View>
            </Card>
          </>
        )}
      </ScrollView>

      {/* Reply Modal */}
      <Modal
        visible={!!replyModalReview}
        transparent
        animationType="fade"
        onRequestClose={() => setReplyModalReview(null)}>
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setReplyModalReview(null)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>
              Reply to {replyModalReview?.buyer}
            </Text>
            <Text style={styles.modalSubtitle}>
              Regarding: {replyModalReview?.crop}
            </Text>

            <Text style={styles.customerCommentPreview}>
              &quot;{replyModalReview?.comment}&quot;
            </Text>

            <Text style={styles.inputLabel}>Your Response as Verified Farmer:</Text>
            <TextInput
              style={styles.replyTextInput}
              multiline
              numberOfLines={4}
              placeholder="e.g. நன்றி! அடுத்த அறுவடை விரைவில் வரும். (Thank you! Next harvest ready soon.)"
              value={replyInputText}
              onChangeText={setReplyInputText}
            />

            <View style={styles.modalActionsRow}>
              <Pressable
                style={styles.modalCancelBtn}
                onPress={() => setReplyModalReview(null)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalSaveBtn} onPress={handleSaveReply}>
                <Text style={styles.modalSaveText}>Publish Reply</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  segmentBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
    backgroundColor: colors.surfaceSecondary,
  },
  segmentBtnActive: {
    backgroundColor: colors.primaryLight,
  },
  segmentBtnText: {
    fontSize: fontSizes.xs + 1,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  segmentBtnTextActive: {
    fontWeight: '800',
    color: colors.primaryDark,
  },
  scrollContent: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xxl + 40,
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    backgroundColor: '#F1F8E9',
    gap: spacing.md,
  },
  ratingScoreCol: {
    alignItems: 'center',
    paddingRight: spacing.md,
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  summaryScore: {
    fontSize: 36,
    fontWeight: '900',
    color: colors.primaryDark,
  },
  summaryText: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 2,
  },
  summaryBreakdownCol: {
    flex: 1,
    gap: 4,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  breakdownLabel: {
    fontSize: 11,
    color: colors.text,
  },
  breakdownVal: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  sectionTitle: {
    fontSize: fontSizes.md,
    fontWeight: '800',
    color: colors.text,
  },
  reviewsList: {
    gap: spacing.sm + 2,
  },
  reviewCard: {
    gap: spacing.xs + 2,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  buyerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  buyerName: {
    fontSize: fontSizes.sm + 1,
    fontWeight: '800',
    color: colors.text,
  },
  verifiedBuyerTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    gap: 2,
  },
  verifiedBuyerText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  cropTag: {
    fontSize: fontSizes.xs,
    color: colors.primaryDark,
    fontWeight: '600',
    marginTop: 1,
  },
  reviewDate: {
    fontSize: 11,
    color: colors.textMuted,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 2,
  },
  tagPill: {
    backgroundColor: '#F1F8E9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tagPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  commentText: {
    fontSize: fontSizes.xs + 1,
    color: colors.textSecondary,
    lineHeight: 18,
    marginTop: 2,
  },
  farmerReplyBox: {
    backgroundColor: '#F9FBE7',
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    padding: spacing.xs + 2,
    borderRadius: 6,
    gap: 2,
    marginTop: 4,
  },
  replyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  replyTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  replyDateText: {
    fontSize: 9,
    color: colors.textMuted,
    marginLeft: 'auto',
  },
  replyContentText: {
    fontSize: 11,
    color: colors.text,
    lineHeight: 16,
  },
  replyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: colors.surfaceSecondary,
  },
  replyBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  payoutOverviewCard: {
    backgroundColor: '#E8F5E9',
    borderWidth: 1.5,
    borderColor: colors.primaryLight,
    gap: spacing.md,
  },
  payoutHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  payoutLabel: {
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
  },
  payoutTotalAmount: {
    fontSize: 32,
    fontWeight: '900',
    color: colors.primaryDark,
    marginTop: 2,
  },
  subsidyBadge: {
    backgroundColor: colors.primaryDark,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  subsidyBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.white,
  },
  payoutDetailsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.08)',
    paddingTop: spacing.sm,
  },
  payoutGridCol: {
    flex: 1,
  },
  payoutGridDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
    marginHorizontal: spacing.sm,
  },
  gridSubLabel: {
    fontSize: 10,
    color: colors.textSecondary,
  },
  gridSubValue: {
    fontSize: fontSizes.sm + 1,
    fontWeight: '800',
    color: colors.text,
    marginTop: 1,
  },
  codStatusCard: {
    backgroundColor: '#FFF8E1',
    borderWidth: 1.5,
    borderColor: '#FFE082',
    gap: spacing.sm,
  },
  codHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  codIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFE082',
    alignItems: 'center',
    justifyContent: 'center',
  },
  codCardTitle: {
    fontSize: fontSizes.sm + 1,
    fontWeight: '800',
    color: '#E65100',
  },
  codCardSubtitle: {
    fontSize: 10,
    color: colors.textSecondary,
  },
  codMetricsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: 2,
  },
  codMetricBox: {
    flex: 1,
    backgroundColor: colors.white,
    padding: spacing.xs + 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFE082',
  },
  codMetricValue: {
    fontSize: fontSizes.md + 1,
    fontWeight: '900',
    color: '#E65100',
  },
  codMetricLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.text,
    marginTop: 2,
  },
  codMetricHint: {
    fontSize: 9,
    color: colors.textMuted,
    marginTop: 1,
  },
  handoverHeading: {
    fontSize: fontSizes.xs + 1,
    fontWeight: '700',
    color: colors.text,
    marginTop: 4,
  },
  handoverList: {
    gap: 6,
  },
  handoverItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    padding: spacing.xs + 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFE082',
  },
  handoverLeft: {
    flex: 1,
  },
  driverNameText: {
    fontSize: fontSizes.xs + 1,
    fontWeight: '700',
    color: colors.text,
  },
  driverVehicleText: {
    fontSize: 10,
    color: colors.textSecondary,
  },
  orderRefText: {
    fontSize: 9,
    fontWeight: '600',
    color: colors.primaryDark,
  },
  handoverRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  handoverAmount: {
    fontSize: fontSizes.sm,
    fontWeight: '800',
    color: colors.text,
  },
  statusPill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  statusPillPending: {
    backgroundColor: '#FFF3E0',
  },
  statusPillDeposited: {
    backgroundColor: '#E3F2FD',
  },
  statusPillSettled: {
    backgroundColor: '#E8F5E9',
  },
  statusPillText: {
    fontSize: 9,
    fontWeight: '700',
  },
  statusTextPending: {
    color: '#E65100',
  },
  statusTextDeposited: {
    color: '#1565C0',
  },
  statusTextSettled: {
    color: colors.primaryDark,
  },
  bankCard: {
    gap: spacing.xs + 2,
  },
  bankHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  bankIconBg: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bankTitle: {
    fontSize: fontSizes.sm,
    fontWeight: '800',
    color: colors.text,
  },
  bankSubtitle: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  verifiedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    gap: 2,
  },
  verifiedTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  accountNumberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSecondary,
    padding: spacing.xs + 2,
    borderRadius: 6,
    marginTop: 4,
    gap: 8,
  },
  accountNumberLabel: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  accountNumberValue: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text,
  },
  ifscText: {
    fontSize: 10,
    color: colors.textMuted,
    marginLeft: 'auto',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  modalCard: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadows.medium,
  },
  modalTitle: {
    fontSize: fontSizes.md,
    fontWeight: '800',
    color: colors.text,
  },
  modalSubtitle: {
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
  },
  customerCommentPreview: {
    fontSize: fontSizes.xs + 1,
    fontStyle: 'italic',
    color: colors.textSecondary,
    backgroundColor: colors.surfaceSecondary,
    padding: spacing.sm,
    borderRadius: 6,
  },
  inputLabel: {
    fontSize: fontSizes.xs,
    fontWeight: '700',
    color: colors.textSecondary,
    marginTop: 4,
  },
  replyTextInput: {
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: fontSizes.sm,
    color: colors.text,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  modalActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  modalCancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  modalCancelText: {
    fontSize: fontSizes.sm,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  modalSaveBtn: {
    backgroundColor: colors.primaryDark,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  modalSaveText: {
    fontSize: fontSizes.sm,
    fontWeight: '800',
    color: colors.white,
  },
});
