/**
 * Role Selection Screen
 * Features two large interactive cards: "I want to Buy" and "I want to Sell",
 * plus a "Remember my choice" checkbox.
 * Saves selected role to useAuthStore and routes to the appropriate dashboard group.
 */

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { Card } from '@/components/Card';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useAuthStore, useLanguageStore, UserRole } from '@/store';
import { colors, fontSizes, spacing } from '@/theme';
import { storage } from '@/utils/storage';

const REMEMBER_CHOICE_KEY = 'farmkart_remember_role_choice';

export default function RoleSelectScreen() {
  const { setRole, role: currentRole } = useAuthStore();
  const { language } = useLanguageStore();

  const [selectedRole, setSelectedRole] = useState<UserRole>(
    currentRole === 'seller' ? 'seller' : 'buyer'
  );
  const [rememberChoice, setRememberChoice] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Submit selected role and route to destination group
  const handleContinue = async () => {
    setSubmitting(true);

    try {
      // 1. Save role in Auth Store (persisted in secure store)
      await setRole(selectedRole);

      // 2. Save "Remember my choice" preference
      await storage.setItem(REMEMBER_CHOICE_KEY, rememberChoice ? 'true' : 'false');

      setSubmitting(false);

      // 3. Route to the respective group
      if (selectedRole === 'seller') {
        router.replace('/(seller)/(tabs)');
      } else {
        router.replace('/(buyer)/(tabs)');
      }
    } catch {
      setSubmitting(false);
      // Fallback navigation
      if (selectedRole === 'seller') {
        router.replace('/(seller)/(tabs)');
      } else {
        router.replace('/(buyer)/(tabs)');
      }
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* AppHeader with Back and Language Switcher */}
      <AppHeader
        showBack
        title="FarmKart"
        showSearch={false}
        showCart={false}
        showNotifications={false}
        showLanguageToggle
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* Header Section */}
        <View style={styles.headerSection}>
          <Text style={styles.title}>
            {language === 'ta' ? 'உங்கள் பங்கைத் தேர்ந்தெடுக்கவும்' : 'Choose Your Account Mode'}
          </Text>
          <Text style={styles.subtitle}>
            {language === 'ta'
              ? 'நீங்கள் எந்த முறையில் FarmKart-ஐ பயன்படுத்த விரும்புகிறீர்கள்? கணக்கு சுயவிவரத்தில் எந்த நேரத்திலும் மாற்றிக்கொள்ளலாம்.'
              : 'Select how you want to use FarmKart today. You can switch between Buyer and Seller anytime in your profile.'}
          </Text>
        </View>

        {/* Large Role Cards */}
        <View style={styles.cardsContainer}>
          {/* Card 1: "I want to Buy" */}
          <Pressable onPress={() => setSelectedRole('buyer')}>
            <Card
              style={[
                styles.roleCard,
                selectedRole === 'buyer' ? styles.buyerCardActive : null,
              ]}>
              <View style={styles.cardTopRow}>
                <View
                  style={[
                    styles.iconCircle,
                    { backgroundColor: colors.accentLight },
                  ]}>
                  <MaterialCommunityIcons
                    name="basket"
                    size={36}
                    color={colors.accent}
                  />
                </View>

                <View style={styles.titleCol}>
                  <Text style={styles.cardTitle}>
                    {language === 'ta' ? 'நான் வாங்க விரும்புகிறேன்' : 'I want to Buy'}
                  </Text>
                  <Text style={styles.cardTamilSubtitle}>
                    {language === 'ta'
                      ? 'விளைபொருட்களை வாங்க'
                      : 'Consumer / Bulk Buyer'}
                  </Text>
                </View>

                {/* Selection Radio Icon */}
                <MaterialCommunityIcons
                  name={
                    selectedRole === 'buyer'
                      ? 'radiobox-marked'
                      : 'radiobox-blank'
                  }
                  size={26}
                  color={selectedRole === 'buyer' ? colors.accent : colors.textMuted}
                />
              </View>

              {/* Bullet Features */}
              <View style={styles.featuresList}>
                <View style={styles.featureRow}>
                  <MaterialCommunityIcons
                    name="check-circle"
                    size={16}
                    color={colors.accent}
                  />
                  <Text style={styles.featureText}>
                    {language === 'ta'
                      ? '100% இயற்கை & புதிய விளைபொருட்கள்'
                      : '100% fresh, organically grown farm produce'}
                  </Text>
                </View>

                <View style={styles.featureRow}>
                  <MaterialCommunityIcons
                    name="check-circle"
                    size={16}
                    color={colors.accent}
                  />
                  <Text style={styles.featureText}>
                    {language === 'ta'
                      ? '50 கி.மீ சுற்றளவுக்குள் விரைவு விநியோகம்'
                      : 'Express delivery within 50 km of local farms'}
                  </Text>
                </View>

                <View style={styles.featureRow}>
                  <MaterialCommunityIcons
                    name="check-circle"
                    size={16}
                    color={colors.accent}
                  />
                  <Text style={styles.featureText}>
                    {language === 'ta'
                      ? 'நேரடி மண்டி மொத்த விலை (Zero Middlemen)'
                      : 'Wholesale mandi rates with zero middleman markup'}
                  </Text>
                </View>
              </View>
            </Card>
          </Pressable>

          {/* Card 2: "I want to Sell" */}
          <Pressable onPress={() => setSelectedRole('seller')}>
            <Card
              style={[
                styles.roleCard,
                selectedRole === 'seller' ? styles.sellerCardActive : null,
              ]}>
              <View style={styles.cardTopRow}>
                <View
                  style={[
                    styles.iconCircle,
                    { backgroundColor: colors.primaryLight },
                  ]}>
                  <MaterialCommunityIcons
                    name="tractor"
                    size={36}
                    color={colors.primaryDark}
                  />
                </View>

                <View style={styles.titleCol}>
                  <Text style={styles.cardTitle}>
                    {language === 'ta' ? 'நான் விற்க விரும்புகிறேன்' : 'I want to Sell'}
                  </Text>
                  <Text style={styles.cardTamilSubtitle}>
                    {language === 'ta'
                      ? 'அறுவடையை விற்க'
                      : 'Farmer / Produce Seller'}
                  </Text>
                </View>

                {/* Selection Radio Icon */}
                <MaterialCommunityIcons
                  name={
                    selectedRole === 'seller'
                      ? 'radiobox-marked'
                      : 'radiobox-blank'
                  }
                  size={26}
                  color={
                    selectedRole === 'seller'
                      ? colors.primaryDark
                      : colors.textMuted
                  }
                />
              </View>

              {/* Bullet Features */}
              <View style={styles.featuresList}>
                <View style={styles.featureRow}>
                  <MaterialCommunityIcons
                    name="check-circle"
                    size={16}
                    color={colors.primaryDark}
                  />
                  <Text style={styles.featureText}>
                    {language === 'ta'
                      ? 'இடைத்தரகர்கள் இன்றி சொந்த விலையை நிர்ணயிக்கும் உரிமை'
                      : 'Set your own fair prices without broker commission'}
                  </Text>
                </View>

                <View style={styles.featureRow}>
                  <MaterialCommunityIcons
                    name="check-circle"
                    size={16}
                    color={colors.primaryDark}
                  />
                  <Text style={styles.featureText}>
                    {language === 'ta'
                      ? 'நேரடி மண்டி விலை ஒப்பீடு மற்றும் அறிவிப்புகள்'
                      : 'Real-time Mandi benchmark rates & buyer leads'}
                  </Text>
                </View>

                <View style={styles.featureRow}>
                  <MaterialCommunityIcons
                    name="check-circle"
                    size={16}
                    color={colors.primaryDark}
                  />
                  <Text style={styles.featureText}>
                    {language === 'ta'
                      ? 'நேரடி UPI & வங்கி கணக்கில் உடனடி பணப்பரிவர்த்தனை'
                      : 'Guaranteed direct payouts straight to your bank account'}
                  </Text>
                </View>
              </View>
            </Card>
          </Pressable>
        </View>

        {/* "Remember my choice" Checkbox */}
        <Pressable
          style={styles.checkboxRow}
          onPress={() => setRememberChoice(!rememberChoice)}>
          <View
            style={[
              styles.checkboxBox,
              rememberChoice ? styles.checkboxBoxActive : null,
            ]}>
            {rememberChoice && (
              <MaterialCommunityIcons
                name="check"
                size={16}
                color={colors.white}
              />
            )}
          </View>

          <View style={styles.checkboxTextCol}>
            <Text style={styles.checkboxLabel}>
              {language === 'ta' ? 'எனது தேர்வை நினைவில் கொள்க' : 'Remember my choice'}
            </Text>
            <Text style={styles.checkboxSubtext}>
              {language === 'ta'
                ? 'அடுத்த முறை திறக்கும் போது நேரடியாக இந்த தளத்திற்கு செல்லவும்'
                : 'Automatically open this mode every time you open FarmKart'}
            </Text>
          </View>
        </Pressable>

        {/* Action Button */}
        <PrimaryButton
          title={
            selectedRole === 'seller'
              ? language === 'ta'
                ? 'விவசாயி தளத்திற்கு செல்லவும்'
                : 'Continue as Farmer (Seller)'
              : language === 'ta'
              ? 'வாங்குபவர் தளத்திற்கு செல்லவும்'
              : 'Continue as Buyer'
          }
          icon="arrow-right"
          loading={submitting}
          onPress={handleContinue}
          style={styles.continueBtn}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  headerSection: {
    gap: 4,
    marginVertical: spacing.xs,
  },
  title: {
    fontSize: fontSizes.xl + 2,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  subtitle: {
    fontSize: fontSizes.xs + 1,
    color: colors.textSecondary,
    lineHeight: 19,
  },
  cardsContainer: {
    gap: spacing.md,
  },
  roleCard: {
    borderWidth: 2,
    borderColor: 'transparent',
    padding: spacing.md,
    gap: spacing.md,
  },
  buyerCardActive: {
    borderColor: colors.accent,
    backgroundColor: '#FFFAF2',
  },
  sellerCardActive: {
    borderColor: colors.primaryDark,
    backgroundColor: '#F3FBF2',
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleCol: {
    flex: 1,
  },
  cardTitle: {
    fontSize: fontSizes.lg,
    fontWeight: '800',
    color: colors.text,
  },
  cardTamilSubtitle: {
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  featuresList: {
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
    paddingTop: spacing.sm,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureText: {
    fontSize: fontSizes.xs + 1,
    color: colors.text,
    flex: 1,
    lineHeight: 18,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.xs,
  },
  checkboxBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxBoxActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkboxTextCol: {
    flex: 1,
  },
  checkboxLabel: {
    fontSize: fontSizes.sm,
    fontWeight: '700',
    color: colors.text,
  },
  checkboxSubtext: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  continueBtn: {
    marginTop: spacing.xs,
  },
});
