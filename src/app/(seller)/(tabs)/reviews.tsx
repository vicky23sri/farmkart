/**
 * Seller Reviews & Payouts Screen
 * Features:
 * - Segmented switch between "Buyer Reviews" and "Payouts & COD Status"
 * - Reviews with Farmer Reply feature (modal reply prompt & instant response display)
 * - Earnings overview from the payouts API (UPI received directly, COD collected / pending)
 * - Features the signature dark green header with "Seller Mode" pill.
 */

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
import { authService } from '@/services/authService';
import { payoutService } from '@/services/payoutService';
import { reviewService } from '@/services/reviewService';
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

const formatINR = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

export default function SellerReviewsScreen() {
  const { language } = useLanguageStore();

  const [activeSegment, setActiveSegment] = useState<'reviews' | 'payouts'>('reviews');
  const { data: profile } = useQuery({ queryKey: ['me'], queryFn: () => authService.getProfile() });
  const sellerId = profile?.id;
  const { data: payout, isLoading: isPayoutLoading, refetch: refetchPayout } = useQuery({
    queryKey: ['payout-summary'],
    queryFn: () => payoutService.getPayoutSummary(),
  });

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
    isRefetching,
  } = useInfiniteQuery({
    queryKey: ['seller-reviews-infinite', sellerId],
    queryFn: ({ pageParam = 0 }) => reviewService.getSellerReviews(sellerId!, 20, pageParam),
    enabled: Boolean(sellerId),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      const nextOffset = lastPage.offset + lastPage.limit;
      return nextOffset < lastPage.total ? nextOffset : undefined;
    },
  });

  const rawReviews = useMemo(() => data?.pages.flatMap((page) => page.items) ?? [], [data]);
  const totalReviews = data?.pages[0]?.total ?? 0;

  const displayReviews: SellerReviewItem[] = useMemo(
    () =>
      rawReviews.map((r) => ({
        id: String(r.id),
        buyer: r.buyer_name || 'Verified Buyer',
        date: r.created_at ? new Date(/[zZ]$/.test(r.created_at) ? r.created_at : `${r.created_at}Z`).toLocaleDateString() : '',
        crop: `Order #${r.order_id}`,
        rating: r.product_rating,
        tags: r.tags || [],
        comment: r.text || '',
        farmerReply: r.seller_reply,
        replyDate: r.seller_reply ? 'Answered' : undefined,
      })),
    [rawReviews]
  );

  const average = (key: 'product_rating' | 'farmer_rating' | 'delivery_rating') =>
    rawReviews.length ? rawReviews.reduce((acc, r) => acc + (r[key] || 0), 0) / rawReviews.length : 0;
  const avgProduct = average('product_rating');
  const avgFarmer = average('farmer_rating');
  const avgDelivery = average('delivery_rating');
  const avgOverall = rawReviews.length ? (avgProduct + avgFarmer + avgDelivery) / 3 : 0;
  const [isSavingReply, setIsSavingReply] = useState(false);

  // Reply Modal State
  const [replyModalReview, setReplyModalReview] = useState<SellerReviewItem | null>(null);
  const [replyInputText, setReplyInputText] = useState('');

  // Open Reply Modal
  const openReplyModal = (review: SellerReviewItem) => {
    setReplyModalReview(review);
    setReplyInputText(review.farmerReply || '');
  };

  // Submit Farmer Reply
  const handleSaveReply = async () => {
    if (!replyModalReview || replyInputText.trim().length < 2) return;

    setIsSavingReply(true);
    try {
      await reviewService.replyToReview(Number(replyModalReview.id), replyInputText.trim());
      await refetch();
    } catch (err: any) {
      Alert.alert('Could not publish reply', err?.message || 'Please try again.');
      return;
    } finally {
      setIsSavingReply(false);
    }

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

      {activeSegment === 'reviews' ? (
        <FlatList
          data={displayReviews}
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
          ListHeaderComponent={
            <>
              {/* Overall Farm Rating Card */}
              <Card style={styles.summaryCard}>
                <View style={styles.ratingScoreCol}>
                  <Text style={styles.summaryScore}>{totalReviews ? avgOverall.toFixed(1) : '—'}</Text>
                  <RatingStars rating={avgOverall} size={18} showScore={false} />
                  <Text style={styles.summaryText}>{totalReviews} reviews</Text>
                </View>

                <View style={styles.summaryBreakdownCol}>
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>Product Quality</Text>
                    <Text style={styles.breakdownVal}>{totalReviews ? `${avgProduct.toFixed(1)} ★` : '—'}</Text>
                  </View>
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>Farmer</Text>
                    <Text style={styles.breakdownVal}>{totalReviews ? `${avgFarmer.toFixed(1)} ★` : '—'}</Text>
                  </View>
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>Delivery</Text>
                    <Text style={styles.breakdownVal}>{totalReviews ? `${avgDelivery.toFixed(1)} ★` : '—'}</Text>
                  </View>
                </View>
              </Card>

              <Text style={styles.sectionTitle}>
                {language === 'ta' ? 'வாங்குபவர் கருத்துகள்' : 'Recent Customer Reviews'}
              </Text>
            </>
          }
          ListEmptyComponent={
            isLoading || !sellerId ? (
              <ActivityIndicator style={{ marginTop: spacing.lg }} color={colors.primary} />
            ) : (
              <Text style={[styles.summaryText, { textAlign: 'center', marginTop: spacing.lg }]}>
                No reviews yet. Reviews appear after buyers receive their orders.
              </Text>
            )
          }
          ListFooterComponent={
            isFetchingNextPage ? (
              <View style={{ paddingVertical: spacing.md, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : undefined
          }
          renderItem={({ item: rev }) => (
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
          )}
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>

        {/* TAB 2: EARNINGS (from /payouts/summary) */}
        {isPayoutLoading ? (
          <ActivityIndicator style={{ marginTop: spacing.lg }} color={colors.primary} />
        ) : (
          <>
            <Card style={styles.payoutOverviewCard}>
              <View style={styles.payoutHeaderRow}>
                <View>
                  <Text style={styles.payoutLabel}>Earnings from Delivered Orders</Text>
                  <Text style={styles.payoutTotalAmount}>{formatINR(payout?.total_earnings ?? 0)}</Text>
                </View>
                <View style={styles.subsidyBadge}>
                  <Text style={styles.subsidyBadgeText}>{payout?.delivered_orders_count ?? 0} delivered</Text>
                </View>
              </View>

              <View style={styles.payoutDetailsGrid}>
                <View style={styles.payoutGridCol}>
                  <Text style={styles.gridSubLabel}>UPI received (confirmed)</Text>
                  <Text style={styles.gridSubValue}>{formatINR(payout?.online_earnings ?? 0)}</Text>
                </View>
                <View style={styles.payoutGridDivider} />
                <View style={styles.payoutGridCol}>
                  <Text style={styles.gridSubLabel}>COD collected</Text>
                  <Text style={[styles.gridSubValue, { color: colors.primaryDark }]}>
                    {formatINR(payout?.cod_collected ?? 0)}
                  </Text>
                </View>
              </View>
            </Card>

            <Card style={styles.codStatusCard}>
              <View style={styles.codHeaderRow}>
                <View style={styles.codIconCircle}>
                  <MaterialCommunityIcons name="cash-multiple" size={22} color="#E65100" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.codCardTitle}>
                    {language === 'ta' ? 'பொருளைப் பெற்றவுடன் ரொக்கம் (COD)' : 'Cash on Delivery (COD)'}
                  </Text>
                  <Text style={styles.codCardSubtitle}>
                    You collect COD cash from the buyer at handover. UPI payments go directly to your UPI ID.
                  </Text>
                </View>
              </View>

              <View style={styles.codMetricsRow}>
                <View style={styles.codMetricBox}>
                  <Text style={styles.codMetricValue}>{formatINR(payout?.cod_pending ?? 0)}</Text>
                  <Text style={styles.codMetricLabel}>COD still to collect</Text>
                  <Text style={styles.codMetricHint}>Open COD orders</Text>
                </View>
                <View style={styles.codMetricBox}>
                  <Text style={[styles.codMetricValue, { color: colors.success }]}>
                    {formatINR(payout?.cod_collected ?? 0)}
                  </Text>
                  <Text style={styles.codMetricLabel}>COD collected</Text>
                  <Text style={styles.codMetricHint}>Marked delivered with OTP</Text>
                </View>
              </View>

              <Pressable onPress={() => refetchPayout()} style={{ marginTop: spacing.sm }}>
                <Text style={[styles.codCardSubtitle, { color: colors.primaryDark }]}>Refresh</Text>
              </Pressable>
            </Card>
          </>
        )}
        </ScrollView>
      )}

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
              <Pressable
                style={[styles.modalSaveBtn, isSavingReply && { opacity: 0.6 }]}
                disabled={isSavingReply}
                onPress={handleSaveReply}>
                <Text style={styles.modalSaveText}>{isSavingReply ? 'Publishing…' : 'Publish Reply'}</Text>
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
