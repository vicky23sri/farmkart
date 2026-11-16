/**
 * Privacy Policy Screen
 * Explains FarmKart's data collection, mobile OTP verification, 50 km geolocation policy,
 * push notification tokens, and user account deletion rights.
 * Contains editable placeholder text.
 */

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SUPPORT_EMAIL } from '@/constants/contact';
import { Card } from '@/components/Card';
import { useLanguageStore } from '@/store';
import { colors, fontSizes, spacing } from '@/theme';

export default function PrivacyPolicyScreen() {
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
          {language === 'ta' ? 'தனியுரிமைக் கொள்கை' : 'Privacy Policy'}
        </Text>
        <View style={styles.headerRightPlaceholder} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* Intro Banner */}
        <Card style={styles.introCard}>
          <MaterialCommunityIcons
            name="shield-check"
            size={36}
            color={colors.primaryDark}
          />
          <Text style={styles.introTitle}>
            {language === 'ta'
              ? 'உங்கள் தனியுரிமை எங்கள் உறுதிமொழி'
              : 'Your Privacy & Farm Data Rights'}
          </Text>
          <Text style={styles.introSubtitle}>
            Last updated: October 29, 2026 • FarmKart Direct Marketplace
          </Text>
        </Card>

        {/* Section 1: Information We Collect */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionHeading}>1. Information We Collect</Text>
          <Text style={styles.paragraph}>
            When you create an account or transact on FarmKart, we collect:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletItem}>
              • <Text style={styles.bold}>Mobile Number:</Text> Used solely for secure OTP authentication. We do not store plaintext passwords.
            </Text>
            <Text style={styles.bulletItem}>
              • <Text style={styles.bold}>Location Coordinates (GPS):</Text> Used to enforce our 50 km direct farm-to-door delivery boundary and calculate accurate transport distances.
            </Text>
            <Text style={styles.bulletItem}>
              • <Text style={styles.bold}>Device Push Tokens:</Text> Used via the Expo Push API to send real-time order updates (placed, confirmed, packed, shipped, out for delivery, delivered).
            </Text>
            <Text style={styles.bulletItem}>
              • <Text style={styles.bold}>Delivery Address:</Text> Used by local delivery drivers and farmers to fulfill orders.
            </Text>
          </View>
        </Card>

        {/* Section 2: How We Use Your Data */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionHeading}>2. How We Use Your Data</Text>
          <Text style={styles.paragraph}>
            Your information is used exclusively to operate the FarmKart marketplace:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletItem}>
              • Connecting buyers with nearby farmers within Tamil Nadu farming regions.
            </Text>
            <Text style={styles.bulletItem}>
              • Dispatching automated status notifications as your farm produce moves from the field to your doorstep.
            </Text>
            <Text style={styles.bulletItem}>
              • Fraud prevention, rate limiting on OTP attempts, and platform security.
            </Text>
          </View>
        </Card>

        {/* Section 3: Data Sharing & Third Parties */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionHeading}>3. Data Sharing & Third Parties</Text>
          <Text style={styles.paragraph}>
            We do <Text style={styles.bold}>not</Text> sell your personal information. Data is shared strictly as necessary:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletItem}>
              • <Text style={styles.bold}>With the Farmer / Seller:</Text> Only the buyer&apos;s delivery name, contact number, and address are provided to fulfill the order.
            </Text>
            <Text style={styles.bulletItem}>
              • <Text style={styles.bold}>With Push Notification Providers:</Text> Anonymous Expo push notification tokens are processed through Expo&apos;s secure push servers.
            </Text>
            <Text style={styles.bulletItem}>
              • <Text style={styles.bold}>With Error Monitoring:</Text> Crash reports sent to Sentry have all mobile numbers and tokens automatically scrubbed.
            </Text>
          </View>
        </Card>

        {/* Section 4: Right to Erasure & Account Deletion */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionHeading}>4. Right to Erasure & Account Deletion</Text>
          <Text style={styles.paragraph}>
            You have the absolute right to delete your FarmKart account at any time. When you trigger &quot;Delete My Account&quot; in your profile:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletItem}>
              • Your name, phone number, email, password, profile photo, address, GPS coordinates and (for farmers) UPI ID are permanently erased, and the saved addresses on your device are cleared.
            </Text>
            <Text style={styles.bulletItem}>
              • Farmers&apos; product listings are taken off the marketplace.
            </Text>
            <Text style={styles.bulletItem}>
              • All registered device push tokens, OTP attempts, and in-app notifications are purged.
            </Text>
            <Text style={styles.bulletItem}>
              • Orders the farmer has not accepted yet are cancelled. Orders that are already confirmed, packed or out for delivery, or that have a UPI payment awaiting verification, must be completed first.
            </Text>
            <Text style={styles.bulletItem}>
              • Order items, amounts and dates are retained without your name, contact details or delivery address, solely for accounting, tax, and GST compliance records. Reviews you wrote remain, shown as &quot;Deleted User&quot;.
            </Text>
          </View>
          <Text style={styles.paragraph}>
            Can&apos;t access the app? Email us at the address below and we will delete your account within 30 days.
          </Text>
        </Card>

        {/* Section 5: Grievance Officer & Contact */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionHeading}>5. Contact & Grievance Redressal</Text>
          <Text style={styles.paragraph}>
            If you have questions about this policy or your personal data:
          </Text>
          <Text style={styles.contactText}>
            Email:{' '}
            <Text
              style={styles.linkText}
              accessibilityRole="link"
              onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}>
              {SUPPORT_EMAIL}
            </Text>
          </Text>
          <Text style={styles.contactText}>
            Address: FarmKart Agro Tech Pvt. Ltd., Madurai, Tamil Nadu, India.
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
  contactText: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  linkText: {
    color: colors.primaryDark,
    fontWeight: '700',
  },
});
