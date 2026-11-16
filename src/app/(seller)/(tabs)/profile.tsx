/**
 * Seller Profile Screen
 * Farmer profile with farm verification badge, role switcher to buyer mode, and logout.
 */

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
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

import { AppHeader } from '@/components/AppHeader';
import { Card } from '@/components/Card';
import { authService, UserProfile } from '@/services/authService';
import { useAuthStore, useLanguageStore, useLocationStore } from '@/store';
import { colors, fontSizes, spacing } from '@/theme';

export default function SellerProfileScreen() {
  const { logout } = useAuthStore();
  const { language, setLanguage } = useLanguageStore();

  const queryClient = useQueryClient();
  const { requestAndFetchCurrentLocation } = useLocationStore();
  const [upiId, setUpiId] = useState('');
  const [isSavingUpi, setIsSavingUpi] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isSavingLocation, setIsSavingLocation] = useState(false);

  // Farm location: used for product distances and delivery-radius checks
  const handleSetFarmLocation = async () => {
    setIsSavingLocation(true);
    try {
      const res = await requestAndFetchCurrentLocation();
      if (!res.success || !res.location) {
        Alert.alert('Location unavailable', res.error || 'Please enable location services and try again.');
        return;
      }
      const updated = await authService.updateProfile({
        lat: res.location.lat,
        lng: res.location.lng,
        address: res.location.address?.slice(0, 255),
      });
      setProfile(updated);
      queryClient.setQueryData(['me'], updated);
      Alert.alert('Farm location saved', updated.address || 'Your farm location has been updated.');
    } catch (err: any) {
      Alert.alert('Could not save location', err?.message || 'Please try again.');
    } finally {
      setIsSavingLocation(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    authService
      .getProfile()
      .then((loaded) => {
        if (!mounted) return;
        setProfile(loaded);
        if (loaded?.upi_id) {
          setUpiId(loaded.upi_id);
        }
      })
      .catch((err) => {
        console.warn('Could not load profile upi_id:', err.message);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const handleSaveUpiId = async () => {
    const clean = upiId.trim();
    if (!clean) {
      Alert.alert(
        language === 'ta' ? 'தேவைப்படுகிறது' : 'UPI ID Required',
        language === 'ta'
          ? 'வாங்குபவர்களிடமிருந்து நேரடி கட்டணம் பெற உங்கள் UPI முகவரியை உள்ளிடவும்.'
          : 'Please enter your UPI ID to receive direct payments from buyers.'
      );
      return;
    }

    if (!authService.isValidUpiId(clean)) {
      Alert.alert(
        language === 'ta' ? 'தவறான UPI முகவரி' : 'Invalid UPI ID',
        language === 'ta'
          ? 'தயவுசெய்து சரியான UPI முகவரியை உள்ளிடவும் (எ.கா. farmer@oksbi, name@okhdfc).'
          : 'Please enter a valid UPI ID (e.g., farmer@oksbi, name@okhdfcbank).'
      );
      return;
    }

    setIsSavingUpi(true);
    try {
      await authService.updateProfile({ upi_id: clean });
      Alert.alert(
        language === 'ta' ? 'வெற்றி' : 'Success',
        language === 'ta'
          ? 'உங்கள் UPI முகவரி சேமிக்கப்பட்டது. வாங்குபவர்கள் நேரடியாக இந்த முகவரிக்கு பணம் செலுத்துவார்கள்.'
          : 'Your UPI ID has been saved. Buyers will make direct payments to this account with zero fees!'
      );
    } catch (err: any) {
      Alert.alert(
        language === 'ta' ? 'பிழை' : 'Error',
        err.message || 'Could not save UPI ID. Please try again.'
      );
    } finally {
      setIsSavingUpi(false);
    }
  };

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

  const handleDeleteAccount = () => {
    Alert.alert(
      language === 'ta' ? 'கணக்கை நீக்கவா?' : 'Delete Farmer Account?',
      language === 'ta'
        ? 'இந்த நடவடிக்கை மாற்ற முடியாதது. உங்கள் பண்ணை விவரங்கள், பெயர், தொலைபேசி எண் அனைத்தும் நிரந்தரமாக அழிக்கப்படும் அல்லது பெயரற்றதாக்கப்படும். கணக்கியல் பதிவுகளுக்காக முந்தைய ஆர்டர் வரலாறுகள் பெயரற்றதாக பாதுகாக்கப்படும். நிச்சயமாக உங்கள் கணக்கை நீக்க விரும்புகிறீர்களா?'
        : 'This action cannot be undone. All your farm listings, personal profile details, and contact numbers will be permanently deleted or anonymized. Past order records are retained anonymously for accounting. Are you sure you want to delete your account?',
      [
        { text: language === 'ta' ? 'ரத்து' : 'Cancel', style: 'cancel' },
        {
          text: language === 'ta' ? 'ஆம், நீக்கு' : 'Yes, Delete Account',
          style: 'destructive',
          onPress: async () => {
            const res = await authService.deleteAccount();
            if (res.success) {
              await logout();
              Alert.alert(
                language === 'ta' ? 'கணக்கு நீக்கப்பட்டது' : 'Account Deleted',
                language === 'ta'
                  ? 'உங்கள் கணக்கு வெற்றிகரமாக நீக்கப்பட்டது.'
                  : 'Your account has been permanently deleted.'
              );
              router.replace('/(auth)/login');
            } else {
              Alert.alert('Error', res.message);
            }
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
          <Text style={styles.farmerName}>{profile?.name || (language === 'ta' ? 'விவசாயி' : 'Farmer')}</Text>
          <Text style={styles.farmDetails}>
            {profile?.address ||
              (language === 'ta' ? 'பண்ணை இருப்பிடம் அமைக்கப்படவில்லை' : 'Farm location not set')}
          </Text>
          {profile?.mobile || profile?.email ? (
            <Text style={styles.farmDetails}>{profile?.mobile ? `+91 ${profile.mobile}` : profile?.email}</Text>
          ) : null}
        </View>
      </Card>

      {/* Direct UPI ID Configuration Card */}
      <Card style={styles.upiCard}>
        <View style={styles.upiCardHeader}>
          <View style={[styles.menuIconBg, { backgroundColor: '#E8F5E9' }]}>
            <MaterialCommunityIcons
              name="qrcode-scan"
              size={22}
              color={colors.primaryDark}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.upiCardTitle}>
              {language === 'ta' ? 'நேரடி UPI கட்டண அமைப்பு' : 'Direct UPI Payment Setup'}
            </Text>
            <Text style={styles.upiCardSub}>
              {language === 'ta'
                ? 'வாங்குபவர்கள் நேரடியாக உங்கள் UPI முகவரிக்கு பணம் செலுத்துவார்கள்.'
                : 'Buyers send direct peer-to-peer payments to your bank account with 0% platform fee.'}
            </Text>
          </View>
        </View>

        <Text style={styles.upiInputLabel}>
          {language === 'ta' ? 'உங்கள் UPI முகவரி (VPA)' : 'Your UPI ID (VPA)'}
        </Text>
        <View style={styles.upiInputRow}>
          <TextInput
            style={styles.upiInput}
            placeholder="e.g. farmer@oksbi, name@okhdfc"
            placeholderTextColor={colors.textMuted}
            value={upiId}
            onChangeText={setUpiId}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Pressable
            style={[styles.upiSaveBtn, isSavingUpi && { opacity: 0.7 }]}
            onPress={handleSaveUpiId}
            disabled={isSavingUpi}>
            {isSavingUpi ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={styles.upiSaveBtnText}>
                {language === 'ta' ? 'சேமி' : 'Save'}
              </Text>
            )}
          </Pressable>
        </View>

        {upiId.length > 0 && !authService.isValidUpiId(upiId) ? (
          <Text style={styles.upiWarningText}>
            {language === 'ta'
              ? '⚠ சரியான UPI முகவரியை உள்ளிடவும் (எ.கா. name@oksbi)'
              : '⚠ Valid UPI format required: username@bank (e.g. farmer@oksbi)'}
          </Text>
        ) : upiId.length > 0 ? (
          <View style={styles.upiValidRow}>
            <MaterialCommunityIcons name="check-circle" size={14} color={colors.success} />
            <Text style={styles.upiValidText}>
              {language === 'ta' ? 'சரியான வடிவம்' : 'Valid format'}
            </Text>
          </View>
        ) : null}
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

        {/* Farm location */}
        <Pressable style={styles.menuItem} onPress={handleSetFarmLocation} disabled={isSavingLocation}>
          <View style={[styles.menuIconBg, { backgroundColor: colors.primaryLight }]}>
            {isSavingLocation ? (
              <ActivityIndicator size="small" color={colors.primaryDark} />
            ) : (
              <MaterialCommunityIcons name="map-marker-radius" size={22} color={colors.primaryDark} />
            )}
          </View>
          <View style={styles.menuTextCol}>
            <Text style={styles.menuTitle}>
              {language === 'ta' ? 'பண்ணை இருப்பிடத்தை அமை' : 'Set Farm Location (GPS)'}
            </Text>
            <Text style={styles.menuDesc}>
              {profile?.lat != null
                ? language === 'ta'
                  ? 'புதுப்பிக்க தட்டவும்'
                  : 'Tap while at your farm to update'
                : language === 'ta'
                ? 'வாங்குபவர்களுக்கான தூரத்தை கணக்கிட தேவை'
                : 'Needed to show buyers how far your farm is'}
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textSecondary} />
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

      {/* Legal & Policies Card */}
      <Card style={styles.legalMenuCard}>
        <Pressable
          style={styles.legalMenuItem}
          onPress={() => router.push('/privacy')}>
          <View style={[styles.menuIconBg, { backgroundColor: '#E8F5E9' }]}>
            <MaterialCommunityIcons
              name="shield-lock-outline"
              size={22}
              color={colors.primaryDark}
            />
          </View>
          <View style={styles.menuTextCol}>
            <Text style={styles.menuTitle}>
              {language === 'ta' ? 'தனியுரிமைக் கொள்கை' : 'Privacy Policy'}
            </Text>
            <Text style={styles.menuDesc}>
              {language === 'ta' ? 'தரவு பாதுகாப்பு மற்றும் உரிமைகள்' : 'Data protection & privacy rights'}
            </Text>
          </View>
          <MaterialCommunityIcons
            name="chevron-right"
            size={22}
            color={colors.textSecondary}
          />
        </Pressable>

        <View style={styles.menuDivider} />

        <Pressable
          style={styles.legalMenuItem}
          onPress={() => router.push('/terms')}>
          <View style={[styles.menuIconBg, { backgroundColor: '#FFF3E0' }]}>
            <MaterialCommunityIcons
              name="file-document-outline"
              size={22}
              color={colors.accent}
            />
          </View>
          <View style={styles.menuTextCol}>
            <Text style={styles.menuTitle}>
              {language === 'ta' ? 'விதிமுறைகள் & நிபந்தனைகள்' : 'Terms of Service'}
            </Text>
            <Text style={styles.menuDesc}>
              {language === 'ta' ? 'பயன்பாட்டு விதிகள் மற்றும் கொள்கை' : 'Marketplace rules & fulfillment'}
            </Text>
          </View>
          <MaterialCommunityIcons
            name="chevron-right"
            size={22}
            color={colors.textSecondary}
          />
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

      {/* Delete Farmer Account */}
      <Card style={styles.deleteCard}>
        <Pressable style={styles.deleteBtn} onPress={handleDeleteAccount}>
          <MaterialCommunityIcons
            name="trash-can-outline"
            size={20}
            color="#C62828"
          />
          <Text style={styles.deleteBtnText}>
            {language === 'ta' ? 'என் கணக்கை நிரந்தரமாக நீக்கு' : 'Delete Farmer Account'}
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
  legalMenuCard: {
    paddingVertical: spacing.xs,
  },
  legalMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    gap: spacing.sm,
  },
  menuDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 4,
  },
  deleteCard: {
    padding: 0,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(211, 47, 47, 0.2)',
    marginBottom: spacing.lg,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    gap: spacing.xs,
    backgroundColor: '#FFF5F5',
  },
  deleteBtnText: {
    fontSize: fontSizes.sm,
    fontWeight: '700',
    color: '#C62828',
  },
  upiCard: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  upiCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  upiCardTitle: {
    fontSize: fontSizes.md,
    fontWeight: '700',
    color: colors.text,
  },
  upiCardSub: {
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  upiInputLabel: {
    fontSize: fontSizes.xs + 1,
    fontWeight: '600',
    color: colors.text,
    marginTop: spacing.xs,
  },
  upiInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  upiInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: fontSizes.sm,
    color: colors.text,
    backgroundColor: '#FAFAFA',
  },
  upiSaveBtn: {
    backgroundColor: colors.primaryDark,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 3,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  upiSaveBtnText: {
    color: colors.white,
    fontSize: fontSizes.sm,
    fontWeight: '700',
  },
  upiWarningText: {
    fontSize: fontSizes.xs,
    color: colors.error,
    fontWeight: '500',
  },
  upiValidRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  upiValidText: {
    fontSize: fontSizes.xs,
    color: colors.success,
    fontWeight: '600',
  },
});
