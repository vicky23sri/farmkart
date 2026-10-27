/**
 * Seller Profile Screen
 * Farmer profile with farm verification badge, role switcher to buyer mode, and logout.
 */

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { Card } from '@/components/Card';
import { useAuthStore, useLanguageStore } from '@/store';
import { colors, fontSizes, spacing } from '@/theme';

export default function SellerProfileScreen() {
  const { logout } = useAuthStore();
  const { language, setLanguage } = useLanguageStore();

  const handleLogout = () => {
    Alert.alert(
      language === 'ta' ? 'வெளியேறு' : 'Logout',
      language === 'ta'
        ? 'விவசாயி கணக்கிலிருந்து நிச்சயமாக வெளியேற விரும்புகிறீர்களா?'
        : 'Are you sure you want to log out of your farmer account?',
      [
        { text: language === 'ta' ? 'ரத்து' : 'Cancel', style: 'cancel' },
        {
          text: language === 'ta' ? 'வெளியேறு' : 'Logout',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/(auth)/login');
          },
        },
      ]
    );
  };

  const handleSwitchRole = () => {
    // Navigates to role-select screen as requested
    router.push('/(auth)/role-select');
  };

  return (
    <View style={styles.screen}>
      <AppHeader
        isSeller={true}
        title={language === 'ta' ? 'விவசாயி சுயவிவரம்' : 'Farmer Profile'}
        showSearch={false}
        showCart={false}
      />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
      {/* Farmer Account Card */}
      <Card style={styles.farmerCard}>
        <View style={styles.avatarCircle}>
          <MaterialCommunityIcons
            name="tractor"
            size={36}
            color={colors.primaryDark}
          />
        </View>

        <View style={styles.farmerInfo}>
          <Text style={styles.farmerName}>Ramasamy Gounder</Text>
          <Text style={styles.farmDetails}>
            Vadipatti, Madurai • Reg ID: TN-AGRI-8492
          </Text>
          <View style={styles.verifiedTag}>
            <MaterialCommunityIcons
              name="check-decagram"
              size={13}
              color={colors.primaryDark}
            />
            <Text style={styles.verifiedText}>
              {language === 'ta' ? 'சரிபார்க்கப்பட்ட விவசாயி' : 'Verified Organic Farmer'}
            </Text>
          </View>
        </View>
      </Card>

      {/* Account Menu */}
      <Card style={styles.menuCard}>
        {/* Switch to Buyer Mode */}
        <Pressable style={styles.menuItem} onPress={handleSwitchRole}>
          <View style={[styles.menuIconBg, { backgroundColor: colors.accentLight }]}>
            <MaterialCommunityIcons
              name="basket"
              size={22}
              color={colors.accent}
            />
          </View>
          <View style={styles.menuTextCol}>
            <Text style={styles.menuTitle}>
              {language === 'ta' ? 'வாங்குபவர் கணக்கிற்கு மாற்றவும்' : 'Switch to Consumer / Buyer Mode'}
            </Text>
            <Text style={styles.menuDesc}>
              {language === 'ta'
                ? 'பிற பண்ணைகளிலிருந்து விளைபொருட்களை வாங்க'
                : 'Browse and purchase produce from other farms'}
            </Text>
          </View>
          <MaterialCommunityIcons
            name="chevron-right"
            size={22}
            color={colors.textSecondary}
          />
        </Pressable>

        <View style={styles.divider} />

        {/* Bank & Mandi Payouts */}
        <Pressable
          style={styles.menuItem}
          onPress={() => Alert.alert('Bank Account', 'Primary SBI Account verified')}>
          <View style={[styles.menuIconBg, { backgroundColor: colors.primaryLight }]}>
            <MaterialCommunityIcons
              name="bank"
              size={22}
              color={colors.primaryDark}
            />
          </View>
          <View style={styles.menuTextCol}>
            <Text style={styles.menuTitle}>
              {language === 'ta' ? 'நேரடி வங்கி கணக்கு (Payouts)' : 'Direct Bank & UPI Account'}
            </Text>
            <Text style={styles.menuDesc}>State Bank of India (***4012)</Text>
          </View>
          <MaterialCommunityIcons
            name="chevron-right"
            size={22}
            color={colors.textSecondary}
          />
        </Pressable>

        <View style={styles.divider} />

        {/* Language Switch */}
        <Pressable
          style={styles.menuItem}
          onPress={() => setLanguage(language === 'en' ? 'ta' : 'en')}>
          <View style={[styles.menuIconBg, { backgroundColor: '#E3F2FD' }]}>
            <MaterialCommunityIcons
              name="translate"
              size={22}
              color="#1976D2"
            />
          </View>
          <View style={styles.menuTextCol}>
            <Text style={styles.menuTitle}>
              {language === 'ta' ? 'பயன்பாட்டு மொழி (Language)' : 'App Language'}
            </Text>
            <Text style={styles.menuDesc}>
              {language === 'ta' ? 'தற்போது: தமிழ்' : 'Currently: English'}
            </Text>
          </View>
          <Text style={styles.langBadge}>
            {language === 'en' ? 'தமிழ்' : 'EN'}
          </Text>
        </Pressable>
      </Card>

      {/* Logout Card */}
      <Card style={styles.logoutCard}>
        <Pressable style={styles.logoutBtn} onPress={handleLogout}>
          <MaterialCommunityIcons
            name="logout"
            size={20}
            color={colors.error}
          />
          <Text style={styles.logoutBtnText}>
            {language === 'ta' ? 'கணக்கிலிருந்து வெளியேறு' : 'Logout of Farmer Account'}
          </Text>
        </Pressable>
      </Card>
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
  farmerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  farmerInfo: {
    flex: 1,
  },
  farmerName: {
    fontSize: fontSizes.lg,
    fontWeight: '700',
    color: colors.text,
  },
  farmDetails: {
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  verifiedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginTop: 6,
    gap: 4,
  },
  verifiedText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  menuCard: {
    paddingVertical: spacing.xs,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    gap: spacing.sm,
  },
  menuIconBg: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuTextCol: {
    flex: 1,
  },
  menuTitle: {
    fontSize: fontSizes.sm + 1,
    fontWeight: '700',
    color: colors.text,
  },
  menuDesc: {
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  langBadge: {
    fontSize: fontSizes.xs,
    fontWeight: '700',
    color: colors.accent,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: colors.accentLight,
    borderRadius: 8,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  logoutCard: {
    padding: 0,
    overflow: 'hidden',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    gap: spacing.xs,
    backgroundColor: '#FFEBEE',
  },
  logoutBtnText: {
    fontSize: fontSizes.sm + 1,
    fontWeight: '700',
    color: colors.error,
  },
});
