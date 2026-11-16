/**
 * Terms of Service Screen
 * Outlines rules of engagement, 50 km radius limit, order fulfillment, payments,
 * cancellation policy, and user obligations on the FarmKart direct farm marketplace.
 * Contains editable placeholder text.
 */

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '@/components/Card';
import { useLanguageStore } from '@/store';
import { colors, fontSizes, spacing } from '@/theme';

export default function TermsOfServiceScreen() {
  const { language } = useLanguageStore();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      {/* Top Header */}
      <View style={styles.header}>
        <Pressable
          style={styles.backBtn}
          onPress={() => router.back()}
          hitSlop={8}>
          <MaterialCommunityIcons
            name="arrow-left"
            size={24}
            color={colors.text}
          />
        </Pressable>
        <Text style={styles.headerTitle}>
          {language === 'ta' ? 'விதிமுறைகள் மற்றும் நிபந்தனைகள்' : 'Terms of Service'}
        </Text>
        <View style={styles.headerRightPlaceholder} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* Intro Card */}
        <Card style={styles.introCard}>
          <MaterialCommunityIcons
            name="file-document-outline"
            size={36}
            color={colors.primaryDark}
          />
          <Text style={styles.introTitle}>
            {language === 'ta'
              ? 'பயன்பாட்டு விதிமுறைகள்'
              : 'Terms & Conditions of Use'}
          </Text>
          <Text style={styles.introSubtitle}>
            Effective date: October 29, 2026 • FarmKart Agro Tech
          </Text>
        </Card>

        {/* Section 1: Marketplace Platform Role */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionHeading}>1. Direct Farm Marketplace</Text>
          <Text style={styles.paragraph}>
            FarmKart is a technology platform connecting agricultural producers (farmers) in Tamil Nadu directly with consumers, restaurants, and retail buyers. We eliminate middlemen to offer farm-gate prices.
          </Text>
        </Card>

        {/* Section 2: 50 km Delivery Radius Constraint */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionHeading}>2. 50 km Delivery Radius Rule</Text>
          <Text style={styles.paragraph}>
            To preserve harvest freshness and ensure viable farm-gate logistics:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletItem}>
              • Orders can only be placed if the buyer&apos;s delivery destination is within <Text style={styles.bold}>50 km</Text> of the seller&apos;s farm.
            </Text>
            <Text style={styles.bulletItem}>
              • Orders exceeding this boundary are automatically restricted by our geo-routing engine.
            </Text>
            <Text style={styles.bulletItem}>
              • Delivery charges are calculated based on vehicle type (auto, mini truck, tractor) and actual travel distance.
            </Text>
          </View>
        </Card>

        {/* Section 3: Orders, Payments & Fulfillment */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionHeading}>3. Orders & Payment Terms</Text>
          <Text style={styles.paragraph}>
            We support both Cash on Delivery (COD) and Online Payments (UPI / Cards):
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletItem}>
              • Farmers approve orders after confirming fresh harvest availability.
            </Text>
            <Text style={styles.bulletItem}>
              • Real-time push notifications are dispatched at each stage: Placed, Confirmed, Packed, Shipped, Out for Delivery, and Delivered.
            </Text>
            <Text style={styles.bulletItem}>
              • For COD orders, full payment must be handed to the delivery driver upon inspection of produce.
            </Text>
          </View>
        </Card>

        {/* Section 4: Cancellation & Quality Guarantee */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionHeading}>4. Cancellations & Returns</Text>
          <Text style={styles.paragraph}>
            Due to the perishable nature of farm produce:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletItem}>
              • Orders may be cancelled by the buyer before the seller marks them as &apos;Shipped&apos;.
            </Text>
            <Text style={styles.bulletItem}>
              • If produce arrives damaged or spoiled, report within 2 hours of delivery with photographic evidence for an immediate replacement or full refund.
            </Text>
          </View>
        </Card>

        {/* Section 5: Account Termination & Deletion */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionHeading}>5. Account Termination & Deletion</Text>
          <Text style={styles.paragraph}>
            Users may terminate their account at any time via the in-app &apos;Delete My Account&apos; option. Upon deletion, your personal information is anonymized. Past financial transactions are retained strictly for accounting and tax records.
          </Text>
        </Card>

        {/* Section 6: Jurisdiction */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionHeading}>6. Governing Law & Dispute Resolution</Text>
          <Text style={styles.paragraph}>
            These terms are governed by the laws of India and subject to the exclusive jurisdiction of courts in Madurai, Tamil Nadu.
          </Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    padding: 6,
  },
  headerTitle: {
    fontSize: fontSizes.md + 1,
    fontWeight: '700',
    color: colors.text,
  },
  headerRightPlaceholder: {
    width: 36,
  },
  scrollContent: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xxl + 20,
  },
  introCard: {
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: '#F7FCF6',
    borderColor: colors.primaryLight,
    borderWidth: 1,
    borderRadius: 16,
    gap: 8,
  },
  introTitle: {
    fontSize: fontSizes.md + 2,
    fontWeight: '800',
    color: colors.primaryDark,
    textAlign: 'center',
  },
  introSubtitle: {
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  sectionCard: {
    padding: spacing.md,
    borderRadius: 14,
    gap: 8,
  },
  sectionHeading: {
    fontSize: fontSizes.md,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  paragraph: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  bulletList: {
    marginTop: 4,
    gap: 6,
  },
  bulletItem: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  bold: {
    fontWeight: '700',
    color: colors.text,
  },
});
