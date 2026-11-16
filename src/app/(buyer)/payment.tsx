/**
 * Buyer Payment Screen
 * Direct UPI (Peer-to-Peer without gateway/SDK) & Cash on Delivery (COD)
 *
 * Requirements:
 * - Server-computed amount from backend order total
 * - "Pay with UPI app" button (Linking.openURL with fallback)
 * - QR code (react-native-qrcode-svg) & copyable UPI ID
 * - Note: "Payment is sent directly to the farmer. Keep your payment screenshot until the seller confirms."
 * - 12-digit UTR entry and submission
 * - "Waiting for seller confirmation" polling state via React Query
 * - Seller confirmation / rejection / resubmission (up to 3 times)
 */

import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { AppHeader } from '@/components/AppHeader';
import { Card } from '@/components/Card';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useQueryClient } from '@tanstack/react-query';

import {
  invalidateOrderQueries,
  orderService,
  UpiLinkResponse,
  useOrder,
} from '@/services/orderService';
import { useCartStore, useLanguageStore, useLocationStore } from '@/store';
import { colors, fontSizes, shadows, spacing } from '@/theme';

type PaymentMode = 'upi' | 'cod';

export default function BuyerPaymentScreen() {
  const { language } = useLanguageStore();
  const { currentLocation } = useLocationStore();
  const { clearCart, items } = useCartStore();
  const queryClient = useQueryClient();

  const params = useLocalSearchParams<{
    orderId?: string;
    notes?: string;
    grandTotal?: string;
    isExtendedDelivery?: string;
    address?: string;
    lat?: string;
    lng?: string;
  }>();

  const isExtended = params.isExtendedDelivery === 'true';
  const estimatedTotal = params.grandTotal ? Number(params.grandTotal) : 0;

  const [paymentMode, setPaymentMode] = useState<PaymentMode>(isExtended ? 'cod' : 'upi');
  const [activeOrderId, setActiveOrderId] = useState<string | null>(params.orderId || null);

  // UPI Link Details state
  const [upiData, setUpiData] = useState<UpiLinkResponse | null>(null);
  const [isLoadingUpi, setIsLoadingUpi] = useState<boolean>(false);
  const [upiError, setUpiError] = useState<string | null>(null);

  // UTR submission state
  const [utr, setUtr] = useState<string>('');
  const [isSubmittingUtr, setIsSubmittingUtr] = useState<boolean>(false);
  const [copiedUpi, setCopiedUpi] = useState<boolean>(false);

  // React Query hook: polls order status every 5 seconds once activeOrderId exists
  const { data: polledOrder, refetch: refetchOrder } = useOrder(
    activeOrderId || undefined,
    activeOrderId ? 5000 : false
  );

  // The server-computed total is authoritative once the order exists
  const [createdTotal, setCreatedTotal] = useState<number | null>(null);
  const finalPayable = polledOrder?.grandTotal ?? createdTotal ?? estimatedTotal;

  // If order was already submitted or paid, reflect it
  const paymentStatus = polledOrder?.paymentStatus || 'pending';
  const isSubmitted = paymentStatus === 'submitted';
  const isPaid = paymentStatus === 'paid';
  const isRejected = paymentStatus === 'rejected';
  const isExpired = paymentStatus === 'expired';

  // Load or fetch UPI Link whenever activeOrderId is set and mode is UPI
  useEffect(() => {
    if (!activeOrderId || paymentMode !== 'upi') return;

    let isMounted = true;
    const loadUpiDetails = async () => {
      try {
        setIsLoadingUpi(true);
        setUpiError(null);
        const data = await orderService.getUpiLink(activeOrderId);
        if (isMounted) {
          setUpiData(data);
        }
      } catch (err: any) {
        if (isMounted) {
          const detail = err.response?.data?.detail || err.message || 'Could not load UPI payment details.';
          setUpiError(detail);
        }
      } finally {
        if (isMounted) {
          setIsLoadingUpi(false);
        }
      }
    };

    loadUpiDetails();

    return () => {
      isMounted = false;
    };
  }, [activeOrderId, paymentMode]);

  /**
   * Helper to ensure an order exists on the backend.
   */
  const ensureBackendOrder = async (mode: 'upi' | 'cod'): Promise<{ id: string; total: number }> => {
    if (activeOrderId) return { id: activeOrderId, total: finalPayable };

    const backendItems = items
      .map((item) => ({
        product_id: Number.parseInt(item.product.id, 10),
        quantity: item.quantity,
      }))
      .filter((item) => Number.isInteger(item.product_id) && item.product_id > 0 && item.quantity > 0);

    if (backendItems.length === 0) {
      throw new Error('Your cart is empty. Please add products before placing an order.');
    }

    const targetAddress = (params.address || currentLocation.address || '').trim();
    if (!targetAddress) {
      throw new Error('Please choose a delivery address before placing your order.');
    }
    const parsedLat = params.lat ? Number(params.lat) : currentLocation.lat;
    const parsedLng = params.lng ? Number(params.lng) : currentLocation.lng;

    const orderRes = await orderService.createOrder({
      items: backendItems,
      address: targetAddress,
      lat: Number.isFinite(parsedLat) ? parsedLat : undefined,
      lng: Number.isFinite(parsedLng) ? parsedLng : undefined,
      payment_method: mode,
      delivery_notes: params.notes?.trim() || undefined,
    });

    const newId = String(orderRes.id);
    setCreatedTotal(orderRes.total);
    setActiveOrderId(newId);
    clearCart();
    invalidateOrderQueries(queryClient, newId);
    return { id: newId, total: orderRes.total };
  };

  /**
   * Cash on Delivery Placement
   */
  const handlePlaceCodOrder = async () => {
    try {
      setIsSubmittingUtr(true);
      const { id: orderId, total } = await ensureBackendOrder('cod');
      setIsSubmittingUtr(false);
      router.replace({
        pathname: '/(buyer)/order-confirmation',
        params: {
          orderId,
          amount: String(total),
          paymentMode: 'cod',
          address: params.address || currentLocation.address,
        },
      });
    } catch (err: any) {
      setIsSubmittingUtr(false);
      Alert.alert('Order Failed', err.message || 'Could not place COD order.');
    }
  };

  /**
   * Initialize UPI mode & create order if needed
   */
  const handleInitUpiOrder = async () => {
    try {
      setIsLoadingUpi(true);
      setUpiError(null);
      await ensureBackendOrder('upi');
    } catch (err: any) {
      setIsLoadingUpi(false);
      Alert.alert('Error', err.message || 'Could not create order for UPI payment.');
    }
  };

  /**
   * Launch UPI intent via Linking.openURL with friendly fallback
   */
  const handlePayWithUpiApp = async () => {
    if (!upiData?.upi_url) return;

    try {
      await Linking.openURL(upiData.upi_url);
    } catch (err) {
      console.warn('Linking.openURL failed:', err);
      Alert.alert(
        language === 'ta' ? 'UPI செயலியை திறக்க முடியவில்லை' : 'Could Not Open UPI App',
        language === 'ta'
          ? 'உங்கள் சாதனத்தில் UPI செயலியை தானாகத் திறக்க முடியவில்லை. கீழே உள்ள QR குறியீட்டை ஸ்கேன் செய்யவும் அல்லது UPI முகவரியை நகலெடுத்து GPay, PhonePe, Paytm மூலம் செலுத்தவும்.'
          : 'Could not open UPI app automatically. Please scan the QR code below or copy the UPI ID to pay using GPay, PhonePe, Paytm, or BHIM.'
      );
    }
  };

  /**
   * Copy UPI ID to device clipboard
   */
  const handleCopyUpiId = async () => {
    if (!upiData?.payee_vpa) return;
    await Clipboard.setStringAsync(upiData.payee_vpa);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2500);
  };

  /**
   * Submit 12-digit UTR
   */
  const handleSubmitUtr = async () => {
    const cleanUtr = utr.trim().replace(/\D/g, '');
    if (cleanUtr.length !== 12) {
      Alert.alert(
        language === 'ta' ? 'தவறான UTR' : 'Invalid UTR',
        language === 'ta'
          ? 'தயவுசெய்து சரியான 12 இலக்க UTR எண்ணை உள்ளிடவும்.'
          : 'Please enter a valid 12-digit numeric UTR / transaction ID.'
      );
      return;
    }

    if (!activeOrderId) {
      Alert.alert('Error', 'Order reference is missing.');
      return;
    }

    setIsSubmittingUtr(true);
    try {
      await orderService.submitUtr(activeOrderId, cleanUtr);
      await refetchOrder();
      Alert.alert(
        language === 'ta' ? 'வெற்றி' : 'UTR Submitted',
        language === 'ta'
          ? 'உங்கள் 12 இலக்க UTR சமர்ப்பிக்கப்பட்டது. விவசாயி தனது கணக்கில் சரிபார்த்து உறுதி செய்வார்.'
          : 'Your 12-digit UTR has been submitted. The farmer will verify and confirm your order.'
      );
    } catch (err: any) {
      const status = err.response?.status;
      const detail = err.response?.data?.detail || err.message;
      if (status === 409) {
        Alert.alert(
          language === 'ta' ? 'ஏற்கனவே பயன்படுத்தப்பட்ட UTR' : 'Duplicate UTR',
          language === 'ta'
            ? 'இந்த UTR எண் ஏற்கனவே மற்றொரு ஆர்டருக்கு சமர்ப்பிக்கப்பட்டுள்ளது. சரியான புதிய UTR-ஐ உள்ளிடவும்.'
            : 'This UTR has already been submitted for an order. Please check and enter the correct transaction UTR.'
        );
      } else {
        Alert.alert('Error', detail || 'Could not submit UTR. Please try again.');
      }
    } finally {
      setIsSubmittingUtr(false);
    }
  };

  return (
    <View style={styles.screen}>
      <AppHeader
        isSeller={false}
        showBack
        title={language === 'ta' ? 'பணம் செலுத்துதல்' : 'Direct Payment'}
        showSearch={false}
        showCart={false}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Payable Header Card */}
        <Card style={styles.amountCard}>
          <View style={styles.amountLeft}>
            <Text style={styles.amountLabel}>
              {language === 'ta' ? 'செலுத்த வேண்டிய தொகை' : 'Total Amount to Pay'}
            </Text>
            <Text style={styles.amountValue}>
              ₹{upiData ? upiData.amount.toFixed(2) : finalPayable.toFixed(2)}
            </Text>
            {paymentMode === 'cod' && (
              <Text style={styles.codNoticeText}>
                {language === 'ta'
                  ? 'பொருளைப் பெறும்போது விவசாயியிடம் பணமாக செலுத்தவும்'
                  : 'Pay the farmer in cash when your order arrives'}
              </Text>
            )}
          </View>
          <View style={styles.escrowBadge}>
            <MaterialCommunityIcons name="shield-check" size={18} color={colors.primaryDark} />
            <Text style={styles.escrowText}>100% Direct to Farmer</Text>
          </View>
        </Card>

        {/* Prominent Direct Payment Notice (Requirement 13) */}
        <View style={styles.directNoticeBanner}>
          <MaterialCommunityIcons name="information" size={20} color="#1565C0" />
          <Text style={styles.directNoticeText}>
            Payment is sent directly to the farmer. Keep your payment screenshot until the seller confirms.
          </Text>
        </View>

        {/* Payment Method Selector */}
        <View style={styles.modesContainer}>
          {/* Mode 1: Direct UPI */}
          <Card
            style={[styles.modeCard, paymentMode === 'upi' && styles.modeCardActive]}>
            <Pressable
              onPress={() => {
                setPaymentMode('upi');
                if (!activeOrderId) {
                  handleInitUpiOrder();
                }
              }}
              style={styles.modeHeader}>
              <View style={[styles.modeIconCircle, { backgroundColor: '#E8F5E9' }]}>
                <MaterialCommunityIcons name="qrcode-scan" size={22} color={colors.primaryDark} />
              </View>
              <View style={styles.modeTextGroup}>
                <Text style={styles.modeTitle}>
                  {language === 'ta' ? 'நேரடி UPI (கட்டணம் இல்லை)' : 'Direct UPI (Zero Fee)'}
                </Text>
                <Text style={styles.modeSub}>
                  GPay • PhonePe • Paytm • BHIM • Net Banking
                </Text>
              </View>
              <MaterialCommunityIcons
                name={paymentMode === 'upi' ? 'radiobox-marked' : 'radiobox-blank'}
                size={22}
                color={paymentMode === 'upi' ? colors.primaryDark : colors.textMuted}
              />
            </Pressable>

            {/* Expanded UPI Details */}
            {paymentMode === 'upi' && (
              <View style={styles.upiExpandedContent}>
                {isLoadingUpi ? (
                  <View style={styles.upiLoadingBox}>
                    <ActivityIndicator size="small" color={colors.primaryDark} />
                    <Text style={styles.upiLoadingText}>
                      {language === 'ta'
                        ? 'விவசாயியின் நேரடி UPI விவரங்கள் பெறப்படுகின்றன...'
                        : 'Fetching farmer UPI payment details...'}
                    </Text>
                  </View>
                ) : upiError ? (
                  <View style={styles.upiErrorBox}>
                    <MaterialCommunityIcons name="alert-circle-outline" size={22} color={colors.error} />
                    <Text style={styles.upiErrorText}>{upiError}</Text>
                    <Pressable
                      style={styles.switchCodBtn}
                      onPress={() => setPaymentMode('cod')}>
                      <Text style={styles.switchCodBtnText}>
                        {language === 'ta' ? 'COD-க்கு மாற்றவும்' : 'Switch to Cash on Delivery'}
                      </Text>
                    </Pressable>
                  </View>
                ) : upiData ? (
                  <>
                    {/* Payee Info Card */}
                    <View style={styles.payeeInfoRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.payeeLabel}>
                          {language === 'ta' ? 'பெறுநர் (விவசாயி):' : 'Payee (Farmer):'}
                        </Text>
                        <Text style={styles.payeeName}>{upiData.payee_name}</Text>
                        <Text style={styles.payeeVpa}>{upiData.payee_vpa}</Text>
                      </View>
                      <Pressable style={styles.copyBtn} onPress={handleCopyUpiId}>
                        <MaterialCommunityIcons
                          name={copiedUpi ? 'check' : 'content-copy'}
                          size={16}
                          color={copiedUpi ? colors.success : colors.primaryDark}
                        />
                        <Text style={[styles.copyBtnText, copiedUpi && { color: colors.success }]}>
                          {copiedUpi
                            ? language === 'ta'
                              ? 'நகலெடுக்கப்பட்டது!'
                              : 'Copied!'
                            : language === 'ta'
                            ? 'நகலெடு'
                            : 'Copy UPI ID'}
                        </Text>
                      </Pressable>
                    </View>

                    {/* Pay with UPI App Button (Calls Linking.openURL) */}
                    <Pressable style={styles.payUpiAppBtn} onPress={handlePayWithUpiApp}>
                      <MaterialCommunityIcons name="cellphone-arrow-down" size={20} color={colors.white} />
                      <Text style={styles.payUpiAppBtnText}>
                        {language === 'ta' ? 'UPI செயலியில் செலுத்தவும்' : 'Pay with UPI app'} (₹
                        {upiData.amount.toFixed(2)})
                      </Text>
                    </Pressable>

                    {/* QR Code Section */}
                    <View style={styles.qrSectionCard}>
                      <Text style={styles.qrSectionTitle}>
                        {language === 'ta'
                          ? 'அல்லது QR குறியீட்டை ஸ்கேன் செய்யவும்'
                          : 'Or Scan QR Code with any UPI App'}
                      </Text>
                      <View style={styles.qrBox}>
                        <QRCode value={upiData.qr_payload} size={180} />
                      </View>
                      <Text style={styles.qrAppsHint}>
                        Google Pay • PhonePe • Paytm • BHIM • Any Bank App
                      </Text>
                    </View>

                    {/* State: Waiting for Seller Confirmation */}
                    {isSubmitted && !isPaid && (
                      <View style={styles.waitingStateCard}>
                        <ActivityIndicator size="small" color="#1E40AF" />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.waitingStateTitle}>
                            {language === 'ta'
                              ? 'விவசாயியின் உறுதிப்படுத்தலுக்காக காத்திருக்கிறது'
                              : 'Waiting for seller confirmation'}
                          </Text>
                          <Text style={styles.waitingStateDesc}>
                            {language === 'ta'
                              ? `UTR ${polledOrder?.upiUtr || utr} சமர்ப்பிக்கப்பட்டது. விவசாயி தனது கணக்கை சரிபார்த்து விரைவில் உறுதி செய்வார்.`
                              : `UTR ${polledOrder?.upiUtr || utr} submitted. The farmer will verify receipt in their bank account and confirm shortly.`}
                          </Text>
                        </View>
                      </View>
                    )}

                    {/* State: Paid & Confirmed */}
                    {isPaid && (
                      <View style={styles.paidStateCard}>
                        <MaterialCommunityIcons name="check-circle" size={28} color={colors.success} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.paidStateTitle}>
                            {language === 'ta' ? 'கட்டணம் உறுதி செய்யப்பட்டது!' : 'Payment Confirmed by Farmer!'}
                          </Text>
                          <Text style={styles.paidStateDesc}>
                            {language === 'ta'
                              ? 'உங்கள் ஆர்டர் உறுதி செய்யப்பட்டு தயாரிப்பில் உள்ளது.'
                              : 'Your order is confirmed and will be harvested and packed.'}
                          </Text>
                        </View>
                        <PrimaryButton
                          title="View Order"
                          onPress={() =>
                            router.replace({
                              pathname: '/(buyer)/order-confirmation',
                              params: { orderId: activeOrderId! },
                            })
                          }
                        />
                      </View>
                    )}

                    {/* State: Rejected & Resubmit Limit */}
                    {isRejected && (
                      <View style={styles.rejectedStateCard}>
                        <MaterialCommunityIcons name="alert-circle" size={24} color={colors.error} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.rejectedStateTitle}>
                            {language === 'ta' ? 'கட்டணம் நிராகரிக்கப்பட்டது' : 'Payment Rejected by Farmer'}
                          </Text>
                          <Text style={styles.rejectedStateReason}>
                            Reason: {polledOrder?.paymentRejectedReason || 'UTR did not match received payment.'}
                          </Text>
                          <Text style={styles.rejectedStateAttempts}>
                            Attempts remaining: {Math.max(0, 3 - (polledOrder?.paymentResubmitCount || 0))} of 3
                          </Text>
                        </View>
                      </View>
                    )}

                    {/* State: Expired */}
                    {isExpired && (
                      <View style={styles.expiredStateCard}>
                        <MaterialCommunityIcons name="clock-alert-outline" size={24} color={colors.error} />
                        <Text style={styles.expiredStateTitle}>
                          {language === 'ta' ? 'கட்டண நேரம் காலாவதியானது' : 'Payment Window Expired'}
                        </Text>
                        <Text style={styles.expiredStateDesc}>
                          {language === 'ta'
                            ? '30 நிமிடங்களில் பணம் பெறப்படாததால் ஆர்டர் ரத்து செய்யப்பட்டு இருப்பு மீட்டமைக்கப்பட்டது.'
                            : 'Order auto-expired after 30 minutes without confirmed payment. Farm stock was safely restored.'}
                        </Text>
                      </View>
                    )}

                    {/* Step: Enter 12-digit UTR (Visible when pending or rejected and attempts < 3) */}
                    {(!isSubmitted || isRejected) && !isPaid && !isExpired && (
                      <View style={styles.utrInputCard}>
                        <Text style={styles.utrPromptTitle}>
                          {language === 'ta'
                            ? 'பணம் செலுத்திய பிறகு 12 இலக்க UTR-ஐ உள்ளிடவும்:'
                            : 'Enter 12-digit UTR / transaction ID after paying:'}
                        </Text>
                        <TextInput
                          style={styles.utrInputField}
                          placeholder="e.g. 123456789012"
                          placeholderTextColor={colors.textMuted}
                          keyboardType="numeric"
                          maxLength={12}
                          value={utr}
                          onChangeText={(val) => setUtr(val.replace(/\D/g, ''))}
                        />
                        <PrimaryButton
                          title={
                            isSubmittingUtr
                              ? 'Submitting UTR...'
                              : isRejected
                              ? 'Resubmit Corrected UTR'
                              : 'Submit UTR / Transaction ID'
                          }
                          onPress={handleSubmitUtr}
                          disabled={utr.length !== 12 || isSubmittingUtr}
                        />
                      </View>
                    )}
                  </>
                ) : (
                  <View style={{ paddingVertical: spacing.md }}>
                    <PrimaryButton
                      title="Generate Direct UPI Payment Link"
                      onPress={handleInitUpiOrder}
                    />
                  </View>
                )}
              </View>
            )}
          </Card>

          {/* Mode 2: Cash on Delivery (COD) */}
          <Card
            style={[styles.modeCard, paymentMode === 'cod' && styles.modeCardActive]}>
            <Pressable
              onPress={() => setPaymentMode('cod')}
              style={styles.modeHeader}>
              <View style={[styles.modeIconCircle, { backgroundColor: '#FFF3E0' }]}>
                <MaterialCommunityIcons name="cash-multiple" size={22} color="#E65100" />
              </View>
              <View style={styles.modeTextGroup}>
                <Text style={styles.modeTitle}>
                  {language === 'ta' ? 'பொருளைப் பெற்றதும் பணம் (COD)' : 'Cash on Delivery (COD)'}
                </Text>
                <Text style={styles.modeSub}>
                  {language === 'ta'
                    ? 'விளைபொருட்களைப் பெறும்போது நேரடியாக பணம் செலுத்தவும்'
                    : 'Pay cash directly upon harvest delivery'}
                </Text>
              </View>
              <MaterialCommunityIcons
                name={paymentMode === 'cod' ? 'radiobox-marked' : 'radiobox-blank'}
                size={22}
                color={paymentMode === 'cod' ? colors.primaryDark : colors.textMuted}
              />
            </Pressable>

            {paymentMode === 'cod' && (
              <View style={styles.codExpandedContent}>
                <Text style={styles.codDescText}>
                  {language === 'ta'
                    ? 'உங்கள் வீட்டு வாசலில் புதிய விளைபொருட்களை பெற்றுசரிபார்த்த பின் பணமாக செலுத்தவும். டெலிவரி நேரத்தில் OTP சரிபார்ப்பு தேவைப்படும்.'
                    : 'Pay cash to the delivery partner once your farm produce arrives. 6-digit delivery OTP verification will be required upon handoff.'}
                </Text>
                <PrimaryButton
                  title={`Place Order with Cash on Delivery (₹${finalPayable})`}
                  onPress={handlePlaceCodOrder}
                  disabled={isSubmittingUtr}
                />
              </View>
            )}
          </Card>
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
    paddingBottom: spacing.xxl,
  },
  amountCard: {
    padding: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.white,
    ...shadows.soft,
  },
  amountLeft: {
    flex: 1,
  },
  amountLabel: {
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  amountValue: {
    fontSize: fontSizes.xxl,
    fontWeight: '800',
    color: colors.primaryDark,
    marginTop: 2,
  },
  codNoticeText: {
    fontSize: 10,
    color: '#D97706',
    marginTop: 2,
    fontWeight: '600',
  },
  escrowBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E8F5E9',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: 8,
  },
  escrowText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  directNoticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: '#E3F2FD',
    borderWidth: 1,
    borderColor: '#90CAF9',
    padding: spacing.sm + 2,
    borderRadius: 10,
  },
  directNoticeText: {
    flex: 1,
    fontSize: fontSizes.xs + 1,
    fontWeight: '600',
    color: '#1565C0',
    lineHeight: 18,
  },
  modesContainer: {
    gap: spacing.md,
  },
  modeCard: {
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  modeCardActive: {
    borderColor: colors.primaryDark,
    backgroundColor: '#FAFDF9',
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  modeTextGroup: {
    flex: 1,
  },
  modeTitle: {
    fontSize: fontSizes.sm + 1,
    fontWeight: '700',
    color: colors.text,
  },
  modeSub: {
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  upiExpandedContent: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.md,
  },
  upiLoadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  upiLoadingText: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
  },
  upiErrorBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 8,
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.xs,
  },
  upiErrorText: {
    fontSize: fontSizes.xs + 1,
    color: colors.error,
    textAlign: 'center',
    fontWeight: '600',
  },
  switchCodBtn: {
    marginTop: spacing.xs,
    backgroundColor: '#B45309',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: 8,
  },
  switchCodBtnText: {
    color: colors.white,
    fontSize: fontSizes.xs,
    fontWeight: '700',
  },
  payeeInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    borderRadius: 8,
    gap: spacing.sm,
  },
  payeeLabel: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  payeeName: {
    fontSize: fontSizes.sm,
    fontWeight: '700',
    color: colors.text,
  },
  payeeVpa: {
    fontSize: fontSizes.xs,
    color: colors.primaryDark,
    fontWeight: '600',
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E8F5E9',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: 6,
  },
  copyBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  payUpiAppBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primaryDark,
    paddingVertical: spacing.md,
    borderRadius: 10,
    ...shadows.soft,
  },
  payUpiAppBtnText: {
    color: colors.white,
    fontSize: fontSizes.sm + 1,
    fontWeight: '800',
  },
  qrSectionCard: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    borderRadius: 10,
    gap: spacing.sm,
  },
  qrSectionTitle: {
    fontSize: fontSizes.xs + 1,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  qrBox: {
    padding: spacing.sm,
    backgroundColor: colors.white,
    borderRadius: 8,
    ...shadows.soft,
  },
  qrAppsHint: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '500',
  },
  utrInputCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    borderRadius: 10,
    gap: spacing.sm,
  },
  utrPromptTitle: {
    fontSize: fontSizes.xs + 1,
    fontWeight: '700',
    color: colors.text,
  },
  utrInputField: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: fontSizes.md,
    fontWeight: '700',
    letterSpacing: 2,
    color: colors.text,
    backgroundColor: '#FAFAFA',
  },
  waitingStateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    padding: spacing.md,
    borderRadius: 10,
  },
  waitingStateTitle: {
    fontSize: fontSizes.sm,
    fontWeight: '700',
    color: '#1E40AF',
  },
  waitingStateDesc: {
    fontSize: fontSizes.xs,
    color: '#1E3A8A',
    marginTop: 2,
    lineHeight: 16,
  },
  paidStateCard: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
    padding: spacing.md,
    borderRadius: 10,
    gap: spacing.sm,
  },
  paidStateTitle: {
    fontSize: fontSizes.md,
    fontWeight: '800',
    color: '#166534',
  },
  paidStateDesc: {
    fontSize: fontSizes.xs + 1,
    color: '#14532D',
  },
  rejectedStateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    padding: spacing.md,
    borderRadius: 10,
  },
  rejectedStateTitle: {
    fontSize: fontSizes.sm,
    fontWeight: '700',
    color: colors.error,
  },
  rejectedStateReason: {
    fontSize: fontSizes.xs,
    color: '#7F1D1D',
    marginTop: 2,
  },
  rejectedStateAttempts: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
    fontWeight: '600',
  },
  expiredStateCard: {
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    padding: spacing.md,
    borderRadius: 10,
    gap: spacing.xs,
  },
  expiredStateTitle: {
    fontSize: fontSizes.sm,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  expiredStateDesc: {
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    textAlign: 'center',
  },
  codExpandedContent: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.md,
  },
  codDescText: {
    fontSize: fontSizes.xs + 1,
    color: colors.textSecondary,
    lineHeight: 18,
  },
});
