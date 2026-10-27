/**
 * Buyer Order Detail Screen
 * Features:
 * - AppHeader with order ID and status
 * - Itemized list of harvested produce items
 * - Delivery address, slot & instructions
 * - Payment status (Paid vs COD)
 * - COD highlight card: "Pay Rs. X on delivery"
 * - Delivery OTP card: "Share with driver upon produce inspection"
 * - Tax Invoice Download button with interactive invoice modal
 * - Direct link to Live Tracking
 */

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { Card } from '@/components/Card';
import { PrimaryButton } from '@/components/PrimaryButton';
import { StatusChip } from '@/components/StatusChip';
import { useLanguageStore, useOrderStore } from '@/store';
import { colors, fontSizes, spacing } from '@/theme';

export default function BuyerOrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { language } = useLanguageStore();
  const { getOrderById, orders } = useOrderStore();

  const [showInvoiceModal, setShowInvoiceModal] = useState(false);

  // Fetch target order or fallback to first order
  const order = (id ? getOrderById(id) : undefined) || orders[0];

  if (!order) {
    return (
      <View style={styles.screen}>
        <AppHeader isSeller={false} showBack title="Order Not Found" />
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Order details could not be found.</Text>
          <PrimaryButton
            title="Return to Orders"
            onPress={() => router.replace('/(buyer)/(tabs)/orders')}
            style={{ marginTop: spacing.md }}
          />
        </View>
      </View>
    );
  }

  const isOngoing = order.tab === 'ongoing';
  const isCOD = order.paymentMode === 'cod';

  return (
    <View style={styles.screen}>
      <AppHeader
        isSeller={false}
        showBack
        title={`Order ${order.id}`}
        showSearch={false}
        showCart={false}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* Status Highlight Card */}
        <Card style={styles.statusCard}>
          <View style={styles.statusHeaderRow}>
            <View>
              <Text style={styles.orderIdText}>{order.id}</Text>
              <Text style={styles.orderDateText}>Placed on {order.orderDate}</Text>
            </View>
            <StatusChip
              label={order.statusLabel}
              variant={
                order.status === 'delivered'
                  ? 'success'
                  : order.status === 'cancelled' || order.status === 'returned'
                  ? 'error'
                  : 'info'
              }
            />
          </View>

          {/* Track Live CTA if Ongoing */}
          {isOngoing && (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: '/(buyer)/tracking',
                  params: { orderId: order.id },
                })
              }
              style={styles.trackCtaBtn}>
              <MaterialCommunityIcons
                name="truck-fast"
                size={18}
                color={colors.white}
              />
              <Text style={styles.trackCtaText}>
                {language === 'ta'
                  ? 'நேரலை விநியோகத்தை கண்காணிக்க'
                  : 'Track Live Delivery Timeline & Map'}
              </Text>
              <MaterialCommunityIcons
                name="arrow-right"
                size={16}
                color={colors.white}
              />
            </Pressable>
          )}
        </Card>

        {/* Delivered: Rate & Review Banner */}
        {order.status === 'delivered' && (
          <Card style={styles.reviewBannerCard}>
            <View style={styles.reviewBannerContent}>
              <View style={[styles.reviewBannerIconBg, order.isReviewed ? styles.reviewBannerIconBgReviewed : styles.reviewBannerIconBgPending]}>
                <MaterialCommunityIcons
                  name={order.isReviewed ? 'check-decagram' : 'star'}
                  size={24}
                  color={order.isReviewed ? colors.primaryDark : colors.white}
                />
              </View>
              <View style={styles.reviewBannerTextCol}>
                <Text style={styles.reviewBannerTitle}>
                  {order.isReviewed
                    ? language === 'ta'
                      ? 'விளைபொருள் மதிப்பிடப்பட்டது'
                      : 'Harvest Reviewed ★'
                    : language === 'ta'
                    ? 'விளைபொருளை மதிப்பிடவும்'
                    : 'Rate & Review Produce'}
                </Text>
                <Text style={styles.reviewBannerSubtitle}>
                  {order.isReviewed
                    ? `Quality: ${order.review?.productRating || 5}★ • Farmer: ${order.review?.farmerRating || 5}★`
                    : language === 'ta'
                    ? 'விவசாயி, தரம் மற்றும் விநியோகத்திற்கு மதிப்பீடு வழங்கவும்'
                    : 'Share feedback on freshness, packaging & farmer'}
                </Text>
              </View>
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: '/(buyer)/rate-review',
                    params: { orderId: order.id },
                  })
                }
                style={order.isReviewed ? styles.editReviewBtn : styles.leaveReviewBtn}>
                <Text
                  style={
                    order.isReviewed
                      ? styles.editReviewBtnText
                      : styles.leaveReviewBtnText
                  }>
                  {order.isReviewed
                    ? language === 'ta'
                      ? 'திருத்து'
                      : 'Edit'
                    : language === 'ta'
                    ? 'மதிப்பிட'
                    : 'Review'}
                </Text>
              </Pressable>
            </View>
          </Card>
        )}

        {/* COD "Pay Rs. X on Delivery" & Delivery OTP Card */}
        {isCOD && order.status !== 'delivered' && (
          <View style={styles.codCard}>
            <View style={styles.codHeaderRow}>
              <View style={styles.codIconCircle}>
                <MaterialCommunityIcons
                  name="cash-multiple"
                  size={24}
                  color={colors.primary}
                />
              </View>
              <View style={styles.codTextGroup}>
                <Text style={styles.codPayAmountLabel}>Cash on Delivery</Text>
                <Text style={styles.codPayAmountValue}>
                  Pay ₹{order.grandTotal} on delivery
                </Text>
                <Text style={styles.codHintText}>
                  Please keep exact cash ready or scan driver&apos;s QR on arrival.
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Delivery OTP Card */}
        {order.status !== 'delivered' && order.status !== 'cancelled' && (
          <Card style={styles.otpCard}>
            <View style={styles.otpLeft}>
              <MaterialCommunityIcons
                name="shield-key"
                size={22}
                color={colors.accent}
              />
              <View>
                <Text style={styles.otpLabel}>Delivery Verification OTP</Text>
                <Text style={styles.otpInstruction}>
                  Share this code with the driver after inspecting produce
                </Text>
              </View>
            </View>
            <View style={styles.otpBadge}>
              <Text style={styles.otpNumber}>{order.deliveryOtp}</Text>
            </View>
          </Card>
        )}

        {/* Harvested Items Section */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>
            {language === 'ta' ? 'விளைபொருட்கள்' : 'Harvested Produce Items'} (
            {order.items.length})
          </Text>

          <View style={styles.itemsList}>
            {order.items.map((item, index) => (
              <View key={item.id || index} style={styles.itemRow}>
                {item.image ? (
                  <Image
                    source={{ uri: item.image }}
                    style={styles.itemThumb}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.itemPlaceholder}>
                    <MaterialCommunityIcons
                      name="sprout"
                      size={24}
                      color={colors.primary}
                    />
                  </View>
                )}

                <View style={styles.itemInfoCol}>
                  <Text style={styles.itemName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.itemSubText}>
                    {item.quantity} {item.unit} • ₹{item.price} / {item.unit}
                  </Text>
                  {item.farmerName && (
                    <Text style={styles.itemFarmerTag}>
                      Farmer: {item.farmerName}
                    </Text>
                  )}
                </View>

                <Text style={styles.itemTotal}>
                  ₹{item.price * item.quantity}
                </Text>
              </View>
            ))}
          </View>
        </Card>

        {/* Farmer & Source Farm Card */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Source Farm & Seller</Text>
          <View style={styles.farmerRow}>
            <View style={styles.farmerIconBg}>
              <MaterialCommunityIcons
                name="tractor"
                size={24}
                color={colors.primaryDark}
              />
            </View>
            <View style={styles.farmerDetailsCol}>
              <Text style={styles.farmerNameText}>{order.sellerName}</Text>
              <Text style={styles.farmerFarmText}>{order.sellerFarm}</Text>
              <Text style={styles.farmerVillageText}>
                {order.sellerVillage}
              </Text>
            </View>
            <Pressable
              onPress={() =>
                Alert.alert(
                  'Calling Farmer',
                  `Dialing ${order.sellerName} at ${order.sellerPhone}`
                )
              }
              style={styles.callFarmerSmallBtn}>
              <MaterialCommunityIcons
                name="phone"
                size={16}
                color={colors.white}
              />
            </Pressable>
          </View>
        </Card>

        {/* Delivery Address & Slot */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Delivery Destination</Text>
          <View style={styles.addressBox}>
            <View style={styles.addressRow}>
              <MaterialCommunityIcons
                name="map-marker"
                size={18}
                color={colors.primary}
              />
              <Text style={styles.addressText}>{order.deliveryAddress}</Text>
            </View>

            <View style={styles.slotRow}>
              <MaterialCommunityIcons
                name="clock-time-four-outline"
                size={18}
                color={colors.accent}
              />
              <Text style={styles.slotText}>{order.deliverySlot}</Text>
            </View>

            {order.deliveryNotes && (
              <View style={styles.notesRow}>
                <MaterialCommunityIcons
                  name="note-text-outline"
                  size={16}
                  color={colors.textSecondary}
                />
                <Text style={styles.notesText}>{order.deliveryNotes}</Text>
              </View>
            )}
          </View>
        </Card>

        {/* Payment Summary & Invoice Action */}
        <Card style={styles.sectionCard}>
          <View style={styles.billHeaderRow}>
            <Text style={styles.sectionTitle}>Payment & Bill Breakdown</Text>
            <View
              style={[
                styles.payStatusTag,
                order.paymentStatus === 'paid'
                  ? styles.payStatusTagPaid
                  : styles.payStatusTagPending,
              ]}>
              <Text
                style={[
                  styles.payStatusText,
                  order.paymentStatus === 'paid'
                    ? styles.payStatusTextPaid
                    : styles.payStatusTextPending,
                ]}>
                {order.paymentStatus === 'paid' ? 'PAID' : 'PAYMENT PENDING'}
              </Text>
            </View>
          </View>

          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Produce Subtotal</Text>
            <Text style={styles.billValue}>₹{order.subtotal}</Text>
          </View>

          {order.couponDiscount > 0 && (
            <View style={styles.billRow}>
              <Text style={[styles.billLabel, { color: colors.primary }]}>
                Coupon Discount
              </Text>
              <Text style={[styles.billValue, { color: colors.primary }]}>
                - ₹{order.couponDiscount}
              </Text>
            </View>
          )}

          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Farm-to-Door Delivery</Text>
            <Text style={styles.billValue}>₹{order.deliveryFee}</Text>
          </View>

          <View style={[styles.billRow, styles.grandTotalRow]}>
            <Text style={styles.grandTotalLabel}>Total Amount</Text>
            <Text style={styles.grandTotalValue}>₹{order.grandTotal}</Text>
          </View>

          <View style={styles.divider} />

          {/* Invoice Button */}
          <Pressable
            onPress={() => setShowInvoiceModal(true)}
            style={styles.invoiceBtn}>
            <MaterialCommunityIcons
              name="file-document-outline"
              size={18}
              color={colors.primaryDark}
            />
            <Text style={styles.invoiceBtnText}>
              Download Mandi Tax Invoice (GST / Bill)
            </Text>
            <MaterialCommunityIcons
              name="download"
              size={16}
              color={colors.primaryDark}
            />
          </Pressable>
        </Card>
      </ScrollView>

      {/* Tax Invoice Modal */}
      <Modal
        visible={showInvoiceModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowInvoiceModal(false)}>
        <View style={styles.invoiceBackdrop}>
          <View style={styles.invoiceCard}>
            <View style={styles.invoiceHeader}>
              <View>
                <Text style={styles.invoiceTitle}>FARMKART AGRO INVOICE</Text>
                <Text style={styles.invoiceSubtitle}>
                  Tamil Nadu Mandi Direct Farmer Receipt
                </Text>
              </View>
              <Pressable onPress={() => setShowInvoiceModal(false)} hitSlop={8}>
                <MaterialCommunityIcons
                  name="close"
                  size={24}
                  color={colors.textSecondary}
                />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.invoiceMetaRow}>
                <Text style={styles.invoiceMetaText}>
                  Invoice No: INV-{order.id.replace('ORD-', '')}
                </Text>
                <Text style={styles.invoiceMetaText}>Date: {order.orderDate}</Text>
              </View>

              <View style={styles.invoicePartyRow}>
                <View style={styles.invoicePartyCol}>
                  <Text style={styles.partyLabel}>Seller / Farmer:</Text>
                  <Text style={styles.partyName}>{order.sellerName}</Text>
                  <Text style={styles.partySub}>{order.sellerFarm}</Text>
                  <Text style={styles.partySub}>Mandi Reg: TN-MDU-2024</Text>
                </View>
                <View style={styles.invoicePartyCol}>
                  <Text style={styles.partyLabel}>Billed To Buyer:</Text>
                  <Text style={styles.partyName}>{order.buyerName}</Text>
                  <Text style={styles.partySub}>{order.deliveryAddress}</Text>
                </View>
              </View>

              <View style={styles.invoiceTable}>
                <View style={styles.invoiceTableHeader}>
                  <Text style={[styles.invoiceTh, { flex: 2 }]}>Produce</Text>
                  <Text style={[styles.invoiceTh, { flex: 1, textAlign: 'center' }]}>
                    Qty
                  </Text>
                  <Text style={[styles.invoiceTh, { flex: 1, textAlign: 'right' }]}>
                    Amount
                  </Text>
                </View>

                {order.items.map((item, i) => (
                  <View key={i} style={styles.invoiceTableRow}>
                    <Text style={[styles.invoiceTd, { flex: 2 }]} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text
                      style={[styles.invoiceTd, { flex: 1, textAlign: 'center' }]}>
                      {item.quantity} {item.unit}
                    </Text>
                    <Text style={[styles.invoiceTd, { flex: 1, textAlign: 'right' }]}>
                      ₹{item.price * item.quantity}
                    </Text>
                  </View>
                ))}
              </View>

              <View style={styles.invoiceTotalBox}>
                <Text style={styles.invoiceTotalLabel}>Grand Total (Net)</Text>
                <Text style={styles.invoiceTotalValue}>₹{order.grandTotal}</Text>
              </View>
            </ScrollView>

            <PrimaryButton
              title="Save & Share Receipt (PDF)"
              icon="share-variant"
              onPress={() => {
                setShowInvoiceModal(false);
                Alert.alert('Invoice Saved', 'Tax invoice saved to downloads!');
              }}
              style={{ marginTop: spacing.sm }}
            />
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
  scrollContent: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  emptyText: {
    fontSize: fontSizes.md,
    color: colors.textSecondary,
  },
  statusCard: {
    gap: spacing.sm,
  },
  statusHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  orderIdText: {
    fontSize: fontSizes.md + 1,
    fontWeight: '800',
    color: colors.text,
  },
  orderDateText: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  trackCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginTop: 4,
  },
  trackCtaText: {
    fontSize: fontSizes.xs + 1,
    fontWeight: '800',
    color: colors.white,
    flex: 1,
    marginHorizontal: 8,
  },
  codCard: {
    backgroundColor: '#E8F5E9',
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 12,
    padding: spacing.md,
  },
  codHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  codIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(46, 125, 50, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  codTextGroup: {
    flex: 1,
  },
  codPayAmountLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primaryDark,
    textTransform: 'uppercase',
  },
  codPayAmountValue: {
    fontSize: fontSizes.md + 2,
    fontWeight: '900',
    color: colors.primaryDark,
    marginTop: 1,
  },
  codHintText: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
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
    gap: spacing.xs + 4,
    flex: 1,
    paddingRight: spacing.sm,
  },
  otpLabel: {
    fontSize: fontSizes.xs,
    fontWeight: '800',
    color: colors.text,
  },
  otpInstruction: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 1,
  },
  otpBadge: {
    backgroundColor: colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  otpNumber: {
    fontSize: fontSizes.md + 1,
    fontWeight: '900',
    color: colors.white,
    letterSpacing: 2,
  },
  sectionCard: {
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: fontSizes.sm + 1,
    fontWeight: '800',
    color: colors.text,
  },
  itemsList: {
    gap: spacing.sm,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  itemThumb: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: colors.surfaceSecondary,
  },
  itemPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemInfoCol: {
    flex: 1,
    gap: 2,
  },
  itemName: {
    fontSize: fontSizes.xs + 1,
    fontWeight: '700',
    color: colors.text,
  },
  itemSubText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  itemFarmerTag: {
    fontSize: 10,
    color: colors.primary,
    fontWeight: '600',
  },
  itemTotal: {
    fontSize: fontSizes.sm,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  farmerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  farmerIconBg: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  farmerDetailsCol: {
    flex: 1,
  },
  farmerNameText: {
    fontSize: fontSizes.sm,
    fontWeight: '700',
    color: colors.text,
  },
  farmerFarmText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  farmerVillageText: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 1,
  },
  callFarmerSmallBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addressBox: {
    gap: spacing.xs + 2,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  addressText: {
    fontSize: fontSizes.xs + 1,
    color: colors.text,
    flex: 1,
    lineHeight: 18,
  },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  slotText: {
    fontSize: fontSizes.xs,
    color: colors.accent,
    fontWeight: '700',
  },
  notesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  notesText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  billHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  payStatusTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  payStatusTagPaid: {
    backgroundColor: colors.primaryLight,
  },
  payStatusTagPending: {
    backgroundColor: '#FFF3E0',
  },
  payStatusText: {
    fontSize: 10,
    fontWeight: '800',
  },
  payStatusTextPaid: {
    color: colors.primaryDark,
  },
  payStatusTextPending: {
    color: colors.accent,
  },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  billLabel: {
    fontSize: fontSizes.xs + 1,
    color: colors.textSecondary,
  },
  billValue: {
    fontSize: fontSizes.xs + 1,
    fontWeight: '700',
    color: colors.text,
  },
  grandTotalRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.xs + 2,
    marginTop: 4,
  },
  grandTotalLabel: {
    fontSize: fontSizes.sm + 1,
    fontWeight: '800',
    color: colors.text,
  },
  grandTotalValue: {
    fontSize: fontSizes.md + 2,
    fontWeight: '900',
    color: colors.primaryDark,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 4,
  },
  invoiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryLight,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(46, 125, 50, 0.25)',
    gap: 6,
  },
  invoiceBtnText: {
    fontSize: fontSizes.xs,
    fontWeight: '800',
    color: colors.primaryDark,
    flex: 1,
    textAlign: 'center',
  },
  invoiceBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: spacing.md,
  },
  invoiceCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.md,
    maxHeight: '85%',
  },
  invoiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  invoiceTitle: {
    fontSize: fontSizes.sm + 2,
    fontWeight: '900',
    color: colors.primaryDark,
  },
  invoiceSubtitle: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 1,
  },
  invoiceMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs + 2,
  },
  invoiceMetaText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  invoicePartyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceSecondary,
    padding: spacing.sm,
    borderRadius: 8,
    marginVertical: spacing.xs,
    gap: spacing.sm,
  },
  invoicePartyCol: {
    flex: 1,
  },
  partyLabel: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  partyName: {
    fontSize: fontSizes.xs + 1,
    fontWeight: '800',
    color: colors.text,
    marginTop: 2,
  },
  partySub: {
    fontSize: 10,
    color: colors.textSecondary,
  },
  invoiceTable: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    marginVertical: spacing.sm,
    overflow: 'hidden',
  },
  invoiceTableHeader: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceSecondary,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  invoiceTh: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  invoiceTableRow: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  invoiceTd: {
    fontSize: 11,
    color: colors.text,
  },
  invoiceTotalBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs + 2,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 4,
  },
  invoiceTotalLabel: {
    fontSize: fontSizes.sm,
    fontWeight: '800',
    color: colors.text,
  },
  invoiceTotalValue: {
    fontSize: fontSizes.md,
    fontWeight: '900',
    color: colors.primaryDark,
  },
  reviewBannerCard: {
    padding: spacing.sm + 2,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reviewBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  reviewBannerIconBg: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewBannerIconBgReviewed: {
    backgroundColor: colors.primaryLight,
  },
  reviewBannerIconBgPending: {
    backgroundColor: colors.accent,
  },
  reviewBannerTextCol: {
    flex: 1,
  },
  reviewBannerTitle: {
    fontSize: fontSizes.sm + 1,
    fontWeight: '700',
    color: colors.text,
  },
  reviewBannerSubtitle: {
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  leaveReviewBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  leaveReviewBtnText: {
    color: colors.white,
    fontSize: fontSizes.xs,
    fontWeight: '800',
  },
  editReviewBtn: {
    backgroundColor: colors.primaryLight,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  editReviewBtnText: {
    color: colors.primaryDark,
    fontSize: fontSizes.xs,
    fontWeight: '700',
  },
});
