/**
 * Buyer Order Confirmation Screen
 * Features:
 * - Order ID display
 * - Successful payment badge & receipt summary
 * - Farmer harvest advisory note
 * - Direct "Track Order" button -> /(buyer)/tracking
 * - "Continue Shopping" button -> /(buyer)
 */

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { Card } from '@/components/Card';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useLanguageStore } from '@/store';
import { colors, fontSizes, shadows, spacing } from '@/theme';

export default function BuyerOrderConfirmationScreen() {
  const { language } = useLanguageStore();
  const params = useLocalSearchParams<{
    orderId?: string;
    amount?: string;
    paymentMode?: string;
    slotId?: string;
    address?: string;
  }>();

  const orderId = params.orderId || 'FK-948210';
  const amount = params.amount || '350';
  const paymentMode = (params.paymentMode || 'upi').toUpperCase();

  const handleTrackOrder = () => {
    router.replace({
      pathname: '/(buyer)/tracking',
    });
  };

  const handleGoHome = () => {
    router.replace('/(buyer)/(tabs)');
  };

  return (
    <View style={styles.screen}>
      <AppHeader
        isSeller={false}
        title={language === 'ta' ? 'ஆர்டர் உறுதி' : 'Order Confirmed'}
        showBack={false}
        showSearch={false}
        showCart={false}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* Success Icon & Celebration Card */}
        <View style={styles.celebrationCard}>
          <View style={styles.successIconCircle}>
            <MaterialCommunityIcons
              name="check"
              size={48}
              color={colors.white}
            />
          </View>
          <Text style={styles.celebrationTitle}>
            {language === 'ta'
              ? 'உங்கள் ஆர்டர் உறுதி செய்யப்பட்டது!'
              : 'Farm Order Placed Successfully!'}
          </Text>
          <Text style={styles.celebrationSub}>
            {language === 'ta'
              ? 'விவசாயி நேரடியாக உங்கள் விளைபொருட்களை அறுவடை செய்ய தொடங்குகிறார்.'
              : 'Thank you for supporting local Tamil Nadu farmers directly.'}
          </Text>

          {/* Order ID Pill */}
          <View style={styles.orderIdPill}>
            <Text style={styles.orderIdLabel}>Order ID:</Text>
            <Text style={styles.orderIdValue}>{orderId}</Text>
          </View>
        </View>

        {/* Order Details Card */}
        <Card style={styles.detailsCard}>
          <Text style={styles.cardHeading}>Receipt & Delivery Details</Text>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Amount Paid / Payable</Text>
            <Text style={styles.detailValue}>₹{amount}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Payment Mode</Text>
            <Text style={styles.detailValue}>
              {paymentMode === 'COD' ? 'Cash on Farm Delivery' : paymentMode}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Delivery Slot</Text>
            <Text style={styles.detailValue}>
              Today Morning (Harvest Fresh)
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Delivery Destination</Text>
            <Text style={styles.detailValue} numberOfLines={2}>
              {params.address || 'Madurai North, Tamil Nadu'}
            </Text>
          </View>
        </Card>

        {/* Farmer Direct Assurance Box */}
        <View style={styles.farmerAssuranceCard}>
          <MaterialCommunityIcons
            name="sprout"
            size={24}
            color={colors.primary}
          />
          <View style={styles.assuranceTextCol}>
            <Text style={styles.assuranceTitle}>
              Fresh Farm-to-Door Process
            </Text>
            <Text style={styles.assuranceBody}>
              Your produce is harvested fresh from the fields after order confirmation.
              You will receive live driver & tractor updates via WhatsApp / SMS.
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          <PrimaryButton
            title={language === 'ta' ? 'ஆர்டரைக் கண்காணிக்க' : 'Track Order Status'}
            icon="truck-fast"
            onPress={handleTrackOrder}
            style={styles.trackBtn}
          />

          <Pressable onPress={handleGoHome} style={styles.continueBtn}>
            <Text style={styles.continueBtnText}>
              {language === 'ta' ? 'முகப்புக்குச் செல்' : 'Continue Shopping'}
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
    paddingBottom: spacing.xxl,
  },
  celebrationCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.xs + 2,
    ...shadows.soft,
  },
  successIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
    ...shadows.medium,
  },
  celebrationTitle: {
    fontSize: fontSizes.lg + 2,
    fontWeight: '900',
    color: colors.primaryDark,
    textAlign: 'center',
  },
  celebrationSub: {
    fontSize: fontSizes.xs + 1,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  orderIdPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
    marginTop: spacing.sm,
  },
  orderIdLabel: {
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  orderIdValue: {
    fontSize: fontSizes.sm,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  detailsCard: {
    gap: spacing.sm,
  },
  cardHeading: {
    fontSize: fontSizes.sm + 1,
    fontWeight: '800',
    color: colors.text,
    paddingBottom: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  detailLabel: {
    fontSize: fontSizes.xs + 1,
    color: colors.textSecondary,
    flex: 1,
  },
  detailValue: {
    fontSize: fontSizes.xs + 1,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'right',
    flex: 1.5,
  },
  farmerAssuranceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(46, 125, 50, 0.25)',
  },
  assuranceTextCol: {
    flex: 1,
  },
  assuranceTitle: {
    fontSize: fontSizes.xs + 1,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  assuranceBody: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  actionsContainer: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  trackBtn: {
    width: '100%',
  },
  continueBtn: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  continueBtnText: {
    fontSize: fontSizes.sm,
    fontWeight: '700',
    color: colors.primaryDark,
  },
});
