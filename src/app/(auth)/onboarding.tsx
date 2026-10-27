/**
 * Onboarding Screen
 * 3 swipeable slides highlighting FarmKart's value pillars:
 * 1. Fresh from farm
 * 2. Buy local
 * 3. Delivery within 50 km
 * Includes pagination dots, Skip, and Get Started buttons with AppHeader.
 */

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
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
import { useLanguageStore } from '@/store';
import { colors, fontSizes, spacing } from '@/theme';

const { width } = Dimensions.get('window');

const SLIDES = [
  {
    id: '1',
    icon: 'sprout' as const,
    iconColor: colors.primary,
    iconBg: colors.primaryLight,
    titleEn: 'Fresh from Farm',
    titleTa: 'புதிய பண்ணை அறுவடை',
    subtitleEn: 'Naturally Ripened • Harvested on Demand',
    subtitleTa: 'இயற்கை முறையில் விளைந்த காய்கறிகள்',
    descriptionEn:
      'Produce is harvested from the fields only after your order is confirmed. Experience 100% natural freshness with zero storage chemicals.',
    descriptionTa:
      'நீங்கள் ஆர்டர் செய்த பின்னரே பண்ணையில் அறுவடை செய்யப்படுகிறது. இடைக்கால சேமிப்பு ரசாயனங்கள் அற்ற 100% இயற்கை சுவை.',
  },
  {
    id: '2',
    icon: 'tractor' as const,
    iconColor: colors.primaryDark,
    iconBg: '#E8F5E9',
    titleEn: 'Buy Local',
    titleTa: 'உள்ளூர் விவசாயிகளிடம் வாங்குங்கள்',
    subtitleEn: 'Wholesale Mandi Rates • Zero Middlemen',
    subtitleTa: 'நேரடி மண்டி விலை • இடைத்தரகர்கள் இல்லை',
    descriptionEn:
      'Connect directly with hardworking farmers in your district. Fair, transparent wholesale prices ensure more profit for growers and bigger savings for you.',
    descriptionTa:
      'உங்கள் மாவட்ட விவசாயிகளுடன் நேரடியாக இணையுங்கள். நியாயமான மண்டி விலையில் பொருட்கள் பெற்று விவசாயிகளின் வாழ்வாதாரத்தை உயர்த்துங்கள்.',
  },
  {
    id: '3',
    icon: 'truck-fast' as const,
    iconColor: colors.accent,
    iconBg: colors.accentLight,
    titleEn: 'Delivery within 50 km',
    titleTa: '50 கி.மீ நேரடி விநியோகம்',
    subtitleEn: 'Same-Day Dispatch • Doorstep Delivery',
    subtitleTa: 'ஒரே நாளில் வீட்டு வாசலில் விநியோகம்',
    descriptionEn:
      'Super-fast farm delivery within a 50 km radius. Transparent distance calculation ensures produce reaches your kitchen fresh from the soil.',
    descriptionTa:
      'பண்ணையிலிருந்து 50 கி.மீ சுற்றளவுக்குள் ஒரே நாளில் அதிவேக விநியோகம். அறுவடை செய்த சில மணிநேரங்களில் உங்கள் வீட்டு வாசலுக்கு வந்து சேரும்.',
  },
];

export default function OnboardingScreen() {
  const { language } = useLanguageStore();
  const scrollRef = useRef<any>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const slideIndex = Math.round(event.nativeEvent.contentOffset.x / width);
    if (slideIndex !== activeIndex) {
      setActiveIndex(slideIndex);
    }
  };

  const handleNext = () => {
    if (activeIndex < SLIDES.length - 1) {
      scrollRef.current?.scrollTo({
        x: (activeIndex + 1) * width,
        animated: true,
      });
    } else {
      router.replace('/(auth)/login');
    }
  };

  const handleSkip = () => {
    router.replace('/(auth)/login');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Header with Language Toggle */}
      <AppHeader
        showBack={false}
        showSearch={false}
        showCart={false}
        showNotifications={false}
        showLanguageToggle
      />

      <View style={styles.container}>
        {/* Swipeable Carousel */}
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          style={styles.carousel}>
          {SLIDES.map((slide) => (
            <View key={slide.id} style={styles.slideContainer}>
              <Card style={styles.slideCard}>
                {/* Illustration Icon */}
                <View
                  style={[
                    styles.iconCircle,
                    { backgroundColor: slide.iconBg },
                  ]}>
                  <MaterialCommunityIcons
                    name={slide.icon}
                    size={72}
                    color={slide.iconColor}
                  />
                </View>

                {/* Subtitle Badge */}
                <View style={styles.subtitleBadge}>
                  <Text style={styles.subtitleBadgeText}>
                    {language === 'ta' ? slide.subtitleTa : slide.subtitleEn}
                  </Text>
                </View>

                {/* Main Slide Title */}
                <Text style={styles.slideTitle}>
                  {language === 'ta' ? slide.titleTa : slide.titleEn}
                </Text>

                {/* Description */}
                <Text style={styles.slideDescription}>
                  {language === 'ta' ? slide.descriptionTa : slide.descriptionEn}
                </Text>
              </Card>
            </View>
          ))}
        </ScrollView>

        {/* Bottom Navigation: Pagination Dots + Actions */}
        <View style={styles.bottomSection}>
          {/* Pagination Dots */}
          <View style={styles.paginationRow}>
            {SLIDES.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.dot,
                  activeIndex === index && styles.activeDot,
                ]}
              />
            ))}
          </View>

          {/* Action Buttons Row */}
          <View style={styles.actionsRow}>
            {/* Skip Button */}
            {activeIndex < SLIDES.length - 1 ? (
              <Pressable
                onPress={handleSkip}
                hitSlop={8}
                style={styles.skipButton}>
                <Text style={styles.skipText}>
                  {language === 'ta' ? 'தவிர்' : 'Skip'}
                </Text>
              </Pressable>
            ) : (
              <View style={styles.skipButton} />
            )}

            {/* Next or Get Started Button */}
            <PrimaryButton
              title={
                activeIndex === SLIDES.length - 1
                  ? language === 'ta'
                    ? 'தொடங்குங்கள்'
                    : 'Get Started'
                  : language === 'ta'
                  ? 'அடுத்து'
                  : 'Next'
              }
              icon={
                activeIndex === SLIDES.length - 1
                  ? 'rocket-launch-outline'
                  : 'arrow-right'
              }
              onPress={handleNext}
              style={styles.nextBtn}
            />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    justifyContent: 'space-between',
  },
  carousel: {
    flex: 1,
  },
  slideContainer: {
    width,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  slideCard: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm + 2,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  subtitleBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 14,
  },
  subtitleBadgeText: {
    fontSize: fontSizes.xs,
    fontWeight: '700',
    color: colors.primaryDark,
    textAlign: 'center',
  },
  slideTitle: {
    fontSize: fontSizes.xl + 2,
    fontWeight: '800',
    color: colors.primaryDark,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  slideDescription: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 300,
  },
  bottomSection: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  paginationRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  activeDot: {
    width: 24,
    backgroundColor: colors.primary,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  skipButton: {
    minWidth: 70,
    paddingVertical: 12,
    alignItems: 'center',
  },
  skipText: {
    fontSize: fontSizes.md,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  nextBtn: {
    flex: 1,
  },
});
