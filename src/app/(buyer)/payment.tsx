/**
 * Buyer Payment Screen
 * Features:
 * - Payment modes: UPI, Credit/Debit Card, Net Banking, Wallet, Cash on Delivery (COD)
 * - COD convenience fee (+₹20) note and dynamic calculation
 * - Mock result simulation with animated verification
 * - Order ID generation & cart clearance
 * - Navigation to Order Confirmation
 */

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
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
import { PrimaryButton } from '@/components/PrimaryButton';
import { orderService } from '@/services/orderService';
import {
  buildTimeline,
  useCartStore,
  useLanguageStore,
  useLocationStore,
  useOrderStore,
} from '@/store';
import { colors, fontSizes, shadows, spacing } from '@/theme';

type PaymentMode = 'upi' | 'card' | 'netbanking' | 'wallet' | 'cod';

const BANKS = [
  { id: 'sbi', name: 'State Bank of India', short: 'SBI' },
  { id: 'tmb', name: 'Tamilnad Mercantile Bank', short: 'TMB' },
  { id: 'hdfc', name: 'HDFC Bank', short: 'HDFC' },
  { id: 'icici', name: 'ICICI Bank', short: 'ICICI' },
  { id: 'indian_bank', name: 'Indian Bank', short: 'IB' },
  { id: 'canara', name: 'Canara Bank', short: 'CANARA' },
];

const WALLETS = [
  { id: 'amazon', name: 'Amazon Pay', balance: '₹450' },
  { id: 'paytm', name: 'Paytm Wallet', balance: '₹120' },
  { id: 'mobikwik', name: 'MobiKwik', balance: '₹0' },
];

export default function BuyerPaymentScreen() {
  const { language } = useLanguageStore();
  const { currentLocation } = useLocationStore();
  const { clearCart, items, getSubtotal, couponDiscount } = useCartStore();
  const { createOrder } = useOrderStore();
  const params = useLocalSearchParams<{
    slotId?: string;
    notes?: string;
    grandTotal?: string;
    isExtendedDelivery?: string;
    address?: string;
    lat?: string;
    lng?: string;
  }>();

  const isExtended = params.isExtendedDelivery === 'true';
  const baseTotal = params.grandTotal ? Number(params.grandTotal) : 350;

  const [paymentMode, setPaymentMode] = useState<PaymentMode>(isExtended ? 'cod' : 'upi');
  const [upiId, setUpiId] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardName, setCardName] = useState('');
  const [selectedBank, setSelectedBank] = useState('sbi');
  const [selectedWallet, setSelectedWallet] = useState('amazon');

  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState('Initiating...');

  // COD fee note (+₹20)
  const codFee = paymentMode === 'cod' ? 20 : 0;
  const finalPayable = baseTotal + codFee;

  const handlePayNow = async () => {
    // Validation
    if (paymentMode === 'upi' && upiId && !upiId.includes('@')) {
      Alert.alert('Invalid UPI ID', 'Please enter a valid UPI ID (e.g. name@okhdfc).');
      return;
    }

    if (paymentMode === 'card') {
      if (cardNumber.replace(/\s/g, '').length < 12) {
        Alert.alert('Invalid Card', 'Please enter a valid 16-digit card number.');
        return;
      }
    }

    setIsProcessing(true);
    setProcessingStep('Sending order to farmer...');

    try {
      // 1. Format payload for FastAPI backend
      const backendItems = items.map((item) => ({
        product_id: parseInt(item.product.id, 10) || 1,
        quantity: item.quantity,
      }));

      // Fallback sample product if cart was loaded from mock string ID
      const validItems =
        backendItems.length > 0
          ? backendItems
          : [{ product_id: 1, quantity: 1 }];

      const targetAddress = params.address || currentLocation.address || '45 Anna Nagar, Madurai';
      const targetLat = params.lat ? Number(params.lat) : currentLocation.lat ?? 9.9252;
      const targetLng = params.lng ? Number(params.lng) : currentLocation.lng ?? 78.1198;

      let backendOrderId = `FK-${Math.floor(100000 + Math.random() * 900000)}`;

      try {
        const orderRes = await orderService.createOrder({
          items: validItems,
          address: targetAddress,
          lat: targetLat,
          lng: targetLng,
          payment_method: paymentMode === 'cod' ? 'cod' : 'online',
        });
        backendOrderId = String(orderRes.id);
      } catch (backendErr: any) {
        console.warn('[handlePayNow] Backend call fallback:', backendErr.message);
      }

      // Also persist to store for local offline display
      const orderItems = items.map((item) => ({
        id: item.product.id,
        name: item.product.name,
        nameTamil: item.product.nameTamil,
        price: item.product.price,
        quantity: item.quantity,
        unit: item.selectedUnit,
        image: item.product.images[0],
        farmerName: item.product.sellerName,
      }));

      createOrder({
        id: backendOrderId,
        orderDate: 'Just now',
        tab: 'ongoing',
        status: isExtended ? 'placed' : 'placed',
        statusLabel: isExtended ? 'Waiting for seller approval' : 'Order Placed',
        buyerName: 'Karthik V.',
        buyerPhone: '+91 98765 43210',
        sellerId: items[0]?.product.sellerId || 'seller-1',
        sellerName: items[0]?.product.sellerName || 'Vadipatti Organic Farm',
        sellerFarm: 'Vadipatti Organic Farm',
        sellerPhone: '+91 98421 56780',
        sellerVillage: items[0]?.product.village || 'Vadipatti, Madurai',
        sellerLat: items[0]?.product.lat || 10.0528,
        sellerLng: items[0]?.product.lng || 77.9625,
        deliveryAddress: targetAddress,
        deliverySlot:
          params.slotId === 'slot-2'
            ? 'Today Evening (4:30 PM - 7:30 PM)'
            : 'Today Morning Express',
        deliveryNotes: params.notes,
        items: orderItems.length > 0 ? orderItems : [
          {
            id: 'prod-07',
            name: 'Country Tomatoes (நாட்டு தக்காளி)',
            price: 35,
            quantity: 3,
            unit: 'kg',
            image: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=400',
            farmerName: 'Ramasamy Gounder',
          },
        ],
        subtotal: getSubtotal() || 105,
        deliveryFee: 30,
        couponDiscount: couponDiscount || 0,
        grandTotal: finalPayable,
        paymentMode,
        paymentStatus: paymentMode === 'cod' ? 'pending' : 'paid',
        deliveryOtp: String(Math.floor(1000 + Math.random() * 9000)),
        timeline: buildTimeline('placed', 'Just now'),
      });

      setIsProcessing(false);
      clearCart();

      // Navigate to order confirmation
      router.replace({
        pathname: '/(buyer)/order-confirmation',
        params: {
          orderId: backendOrderId,
          amount: String(finalPayable),
          paymentMode,
          slotId: params.slotId || 'slot-1',
          address: targetAddress,
        },
      });
    } catch (err: any) {
      setIsProcessing(false);
      Alert.alert('Order Failed', err.message || 'Could not place order. Please check backend connection.');
    }
  };

  return (
    <View style={styles.screen}>
      <AppHeader
        isSeller={false}
        showBack
        title={language === 'ta' ? 'பணம் செலுத்துதல்' : 'Select Payment Method'}
        showSearch={false}
        showCart={false}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* Payable Header Card */}
        <Card style={styles.amountCard}>
          <View style={styles.amountLeft}>
            <Text style={styles.amountLabel}>Total Payable Amount</Text>
            <Text style={styles.amountValue}>₹{finalPayable}</Text>
            {paymentMode === 'cod' && (
              <Text style={styles.codNoticeText}>
                Includes ₹20 Cash on Delivery handling fee
              </Text>
            )}
          </View>
          <View style={styles.escrowBadge}>
            <MaterialCommunityIcons
              name="shield-check"
              size={18}
              color={colors.primaryDark}
            />
            <Text style={styles.escrowText}>100% Direct Farmer Escrow</Text>
          </View>
        </Card>

        {/* Extended Delivery Notice */}
        {isExtended && (
          <View style={styles.extendedNoticeCard}>
            <View style={styles.extendedNoticeIconBg}>
              <MaterialCommunityIcons
                name="clock-alert-outline"
                size={22}
                color="#B45309"
              />
            </View>
            <View style={styles.extendedNoticeTextCol}>
              <Text style={styles.extendedNoticeTitle}>
                You will not be charged until the seller confirms.
              </Text>
              <Text style={styles.extendedNoticeSubtitle}>
                This address is beyond our usual 50 km delivery range. The seller will check if delivery is possible. Cash on Delivery (COD) will only be collected upon delivery.
              </Text>
            </View>
          </View>
        )}

        {/* Payment Modes Accordion */}
        <View style={styles.modesContainer}>
          {!isExtended && (
            <>
              {/* 1. UPI Payment */}
              <Card
                style={[
                  styles.modeCard,
                  paymentMode === 'upi' && styles.modeCardActive,
                ]}>
            <Pressable
              onPress={() => setPaymentMode('upi')}
              style={styles.modeHeader}>
              <View style={styles.modeIconCircle}>
                <MaterialCommunityIcons
                  name="qrcode-scan"
                  size={22}
                  color={colors.primary}
                />
              </View>
              <View style={styles.modeTextGroup}>
                <Text style={styles.modeTitle}>
                  UPI (GPay / PhonePe / Paytm / BHIM)
                </Text>
                <Text style={styles.modeSub}>
                  Zero transaction fee • Instant settlement
                </Text>
              </View>
              <MaterialCommunityIcons
                name={paymentMode === 'upi' ? 'radiobox-marked' : 'radiobox-blank'}
                size={22}
                color={paymentMode === 'upi' ? colors.primary : colors.textMuted}
              />
            </Pressable>

            {paymentMode === 'upi' && (
              <View style={styles.modeExpandedContent}>
                <View style={styles.upiAppsRow}>
                  {['GPay', 'PhonePe', 'Paytm', 'BHIM'].map((app) => (
                    <Pressable
                      key={app}
                      onPress={() => setUpiId(`${app.toLowerCase()}@upi`)}
                      style={styles.upiAppPill}>
                      <Text style={styles.upiAppPillText}>{app}</Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={styles.inputSubLabel}>Or Enter UPI ID</Text>
                <View style={styles.upiInputRow}>
                  <TextInput
                    style={styles.textInput}
                    placeholder="mobileNumber@upi or yourname@okaxis"
                    placeholderTextColor={colors.textMuted}
                    value={upiId}
                    onChangeText={setUpiId}
                    autoCapitalize="none"
                  />
                  <Pressable
                    onPress={() => Alert.alert('Verified', 'UPI ID is verified!')}
                    style={styles.verifyUpiBtn}>
                    <Text style={styles.verifyUpiBtnText}>Verify</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </Card>

          {/* 2. Credit / Debit Card */}
          <Card
            style={[
              styles.modeCard,
              paymentMode === 'card' && styles.modeCardActive,
            ]}>
            <Pressable
              onPress={() => setPaymentMode('card')}
              style={styles.modeHeader}>
              <View style={styles.modeIconCircle}>
                <MaterialCommunityIcons
                  name="credit-card-outline"
                  size={22}
                  color={colors.accent}
                />
              </View>
              <View style={styles.modeTextGroup}>
                <Text style={styles.modeTitle}>Credit / Debit Card</Text>
                <Text style={styles.modeSub}>
                  RuPay, Visa, Mastercard, Maestro
                </Text>
              </View>
              <MaterialCommunityIcons
                name={paymentMode === 'card' ? 'radiobox-marked' : 'radiobox-blank'}
                size={22}
                color={paymentMode === 'card' ? colors.primary : colors.textMuted}
              />
            </Pressable>

            {paymentMode === 'card' && (
              <View style={styles.modeExpandedContent}>
                <TextInput
                  style={styles.textInput}
                  placeholder="Card Number (XXXX XXXX XXXX XXXX)"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  maxLength={19}
                  value={cardNumber}
                  onChangeText={setCardNumber}
                />
                <View style={styles.cardTwoColRow}>
                  <TextInput
                    style={[styles.textInput, { flex: 1 }]}
                    placeholder="MM / YY"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                    maxLength={5}
                    value={cardExpiry}
                    onChangeText={setCardExpiry}
                  />
                  <TextInput
                    style={[styles.textInput, { flex: 1 }]}
                    placeholder="CVV"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                    secureTextEntry
                    maxLength={4}
                    value={cardCvv}
                    onChangeText={setCardCvv}
                  />
                </View>
                <TextInput
                  style={styles.textInput}
                  placeholder="Cardholder Name as on card"
                  placeholderTextColor={colors.textMuted}
                  value={cardName}
                  onChangeText={setCardName}
                />
              </View>
            )}
          </Card>

          {/* 3. Net Banking */}
          <Card
            style={[
              styles.modeCard,
              paymentMode === 'netbanking' && styles.modeCardActive,
            ]}>
            <Pressable
              onPress={() => setPaymentMode('netbanking')}
              style={styles.modeHeader}>
              <View style={styles.modeIconCircle}>
                <MaterialCommunityIcons
                  name="bank-outline"
                  size={22}
                  color="#1565C0"
                />
              </View>
              <View style={styles.modeTextGroup}>
                <Text style={styles.modeTitle}>Net Banking</Text>
                <Text style={styles.modeSub}>All major Indian & TN banks</Text>
              </View>
              <MaterialCommunityIcons
                name={
                  paymentMode === 'netbanking'
                    ? 'radiobox-marked'
                    : 'radiobox-blank'
                }
                size={22}
                color={
                  paymentMode === 'netbanking'
                    ? colors.primary
                    : colors.textMuted
                }
              />
            </Pressable>

            {paymentMode === 'netbanking' && (
              <View style={styles.modeExpandedContent}>
                <Text style={styles.inputSubLabel}>Select Your Bank</Text>
                <View style={styles.banksGrid}>
                  {BANKS.map((b) => {
                    const isSelected = selectedBank === b.id;
                    return (
                      <Pressable
                        key={b.id}
                        onPress={() => setSelectedBank(b.id)}
                        style={[
                          styles.bankPill,
                          isSelected && styles.bankPillSelected,
                        ]}>
                        <Text
                          style={[
                            styles.bankPillText,
                            isSelected && styles.bankPillTextSelected,
                          ]}>
                          {b.short}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}
          </Card>

          {/* 4. Digital Wallets */}
          <Card
            style={[
              styles.modeCard,
              paymentMode === 'wallet' && styles.modeCardActive,
            ]}>
            <Pressable
              onPress={() => setPaymentMode('wallet')}
              style={styles.modeHeader}>
              <View style={styles.modeIconCircle}>
                <MaterialCommunityIcons
                  name="wallet-outline"
                  size={22}
                  color="#6A1B9A"
                />
              </View>
              <View style={styles.modeTextGroup}>
                <Text style={styles.modeTitle}>Digital Wallets</Text>
                <Text style={styles.modeSub}>Amazon Pay, Paytm, MobiKwik</Text>
              </View>
              <MaterialCommunityIcons
                name={
                  paymentMode === 'wallet'
                    ? 'radiobox-marked'
                    : 'radiobox-blank'
                }
                size={22}
                color={
                  paymentMode === 'wallet'
                    ? colors.primary
                    : colors.textMuted
                }
              />
            </Pressable>

            {paymentMode === 'wallet' && (
              <View style={styles.modeExpandedContent}>
                {WALLETS.map((w) => {
                  const isSelected = selectedWallet === w.id;
                  return (
                    <Pressable
                      key={w.id}
                      onPress={() => setSelectedWallet(w.id)}
                      style={[
                        styles.walletItem,
                        isSelected && styles.walletItemSelected,
                      ]}>
                      <View style={styles.walletLeft}>
                        <MaterialCommunityIcons
                          name="wallet"
                          size={18}
                          color={isSelected ? colors.primary : colors.textSecondary}
                        />
                        <Text
                          style={[
                            styles.walletName,
                            isSelected && styles.walletNameSelected,
                          ]}>
                          {w.name}
                        </Text>
                      </View>
                      <Text style={styles.walletBalance}>Bal: {w.balance}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </Card>
        </>
      )}

          {/* 5. Cash on Delivery (COD) */}
          <Card
            style={[
              styles.modeCard,
              paymentMode === 'cod' && styles.modeCardActive,
            ]}>
            <Pressable
              onPress={() => setPaymentMode('cod')}
              style={styles.modeHeader}>
              <View style={styles.modeIconCircle}>
                <MaterialCommunityIcons
                  name="cash-multiple"
                  size={22}
                  color="#2E7D32"
                />
              </View>
              <View style={styles.modeTextGroup}>
                <Text style={styles.modeTitle}>
                  {language === 'ta'
                    ? 'நேரடி பணப் பட்டுவாடா (COD)'
                    : 'Cash on Farm Delivery (COD)'}
                </Text>
                <Text style={styles.modeSub}>
                  Pay upon doorstep delivery of fresh harvest
                </Text>
              </View>
              <MaterialCommunityIcons
                name={paymentMode === 'cod' ? 'radiobox-marked' : 'radiobox-blank'}
                size={22}
                color={paymentMode === 'cod' ? colors.primary : colors.textMuted}
              />
            </Pressable>

            {paymentMode === 'cod' && (
              <View style={styles.modeExpandedContent}>
                <View style={styles.codFeeNoticeBox}>
                  <MaterialCommunityIcons
                    name="information-outline"
                    size={16}
                    color={colors.accent}
                  />
                  <Text style={styles.codFeeNoticeText}>
                    Note: A small convenience fee of ₹20 applies for cash collection and driver cash deposit.
                  </Text>
                </View>
              </View>
            )}
          </Card>
        </View>
      </ScrollView>

      {/* Bottom Sticky Action Bar */}
      <View style={styles.bottomBar}>
        <View style={styles.bottomSubtotalCol}>
          <Text style={styles.bottomLabel}>Final Amount</Text>
          <Text style={styles.bottomAmount}>₹{finalPayable}</Text>
        </View>

        <PrimaryButton
          title={
            isExtended
              ? language === 'ta'
                ? 'விநியோகக் கோரிக்கை அனுப்புக'
                : 'Request Delivery (COD)'
              : paymentMode === 'cod'
              ? language === 'ta'
                ? 'ஆர்டரை உறுதி செய்க'
                : 'Confirm COD Order'
              : `Pay ₹${finalPayable}`
          }
          icon={isExtended ? 'truck-delivery-outline' : paymentMode === 'cod' ? 'check-circle' : 'lock-check'}
          onPress={handlePayNow}
          style={[styles.payNowBtn, isExtended && { backgroundColor: '#D97706' }]}
        />
      </View>

      {/* Payment Processing Simulation Modal */}
      <Modal visible={isProcessing} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.processingCard}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.processingTitle}>Processing Payment</Text>
            <Text style={styles.processingSubtitle}>{processingStep}</Text>
            <Text style={styles.processingHint}>
              Please do not press back or close the app...
            </Text>
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
    paddingBottom: 110,
  },
  amountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: 'rgba(46, 125, 50, 0.25)',
  },
  amountLeft: {
    flex: 1,
  },
  amountLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  amountValue: {
    fontSize: fontSizes.title - 2,
    fontWeight: '900',
    color: colors.primaryDark,
    marginTop: 2,
  },
  codNoticeText: {
    fontSize: 10,
    color: colors.accent,
    fontWeight: '700',
    marginTop: 2,
  },
  escrowBadge: {
    alignItems: 'center',
    gap: 2,
    backgroundColor: colors.white,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(46, 125, 50, 0.2)',
  },
  escrowText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  modesContainer: {
    gap: spacing.sm,
  },
  modeCard: {
    padding: spacing.sm + 2,
    borderRadius: 12,
  },
  modeCardActive: {
    borderColor: colors.primary,
    borderWidth: 1.5,
  },
  modeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  modeIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeTextGroup: {
    flex: 1,
  },
  modeTitle: {
    fontSize: fontSizes.xs + 2,
    fontWeight: '700',
    color: colors.text,
  },
  modeSub: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  modeExpandedContent: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.xs + 4,
  },
  upiAppsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  upiAppPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  upiAppPillText: {
    fontSize: fontSizes.xs,
    fontWeight: '700',
    color: colors.text,
  },
  inputSubLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  upiInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: fontSizes.xs + 1,
    backgroundColor: colors.surfaceSecondary,
    color: colors.text,
    flex: 1,
  },
  verifyUpiBtn: {
    backgroundColor: colors.primaryDark,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyUpiBtnText: {
    color: colors.white,
    fontSize: fontSizes.xs,
    fontWeight: '700',
  },
  cardTwoColRow: {
    flexDirection: 'row',
    gap: 8,
  },
  banksGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  bankPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bankPillSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  bankPillText: {
    fontSize: fontSizes.xs,
    fontWeight: '700',
    color: colors.text,
  },
  bankPillTextSelected: {
    color: colors.white,
  },
  walletItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  walletItemSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  walletLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  walletName: {
    fontSize: fontSizes.xs + 1,
    fontWeight: '700',
    color: colors.text,
  },
  walletNameSelected: {
    color: colors.primaryDark,
  },
  walletBalance: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  codFeeNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8E1',
    borderWidth: 1,
    borderColor: '#FFE082',
    padding: spacing.sm,
    borderRadius: 8,
    gap: 8,
  },
  codFeeNoticeText: {
    fontSize: 11,
    color: '#8D6E63',
    lineHeight: 16,
    flex: 1,
  },
  extendedNoticeCard: {
    flexDirection: 'row',
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  extendedNoticeIconBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FDE68A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  extendedNoticeTextCol: {
    flex: 1,
  },
  extendedNoticeTitle: {
    fontSize: fontSizes.sm,
    fontWeight: '800',
    color: '#92400E',
    marginBottom: 4,
  },
  extendedNoticeSubtitle: {
    fontSize: fontSizes.xs,
    color: '#78350F',
    lineHeight: 16,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...shadows.medium,
  },
  bottomSubtotalCol: {
    justifyContent: 'center',
  },
  bottomLabel: {
    fontSize: 10,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  bottomAmount: {
    fontSize: fontSizes.lg,
    fontWeight: '900',
    color: colors.primaryDark,
  },
  payNowBtn: {
    minWidth: 200,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  processingCard: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  processingTitle: {
    fontSize: fontSizes.md + 2,
    fontWeight: '800',
    color: colors.primaryDark,
    marginTop: spacing.xs,
  },
  processingSubtitle: {
    fontSize: fontSizes.xs + 1,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  processingHint: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
});
