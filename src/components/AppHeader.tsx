/**
 * AppHeader Component
 * Standard FarmKart top navigation bar with consistent logo position and height.
 * Supports Buyer mode (white/clean) and Seller mode (dark green with Seller pill).
 */

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import {
  Image,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLanguageStore, useNotificationStore } from '@/store';
import { colors, fontSizes, shadows, spacing } from '@/theme';

export interface AppHeaderProps {
  /** If true, changes header to dark green with a "Seller Mode" pill badge */
  isSeller?: boolean;
  /** If true, displays a back arrow that navigates back */
  showBack?: boolean;
  /** Optional screen title (e.g. for sub-screens) */
  title?: string;
  /** Number of items in cart to display in badge */
  cartCount?: number;
  /** Optional callbacks */
  onSearchPress?: () => void;
  onCartPress?: () => void;
  onNotificationPress?: () => void;
  /** Toggle visibility of action buttons */
  showSearch?: boolean;
  showCart?: boolean;
  showNotifications?: boolean;
  showLanguageToggle?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function AppHeader({
  isSeller = false,
  showBack = false,
  title,
  cartCount = 0,
  onSearchPress,
  onCartPress,
  onNotificationPress,
  showSearch = true,
  showCart = true,
  showNotifications = true,
  showLanguageToggle = true,
  style,
}: AppHeaderProps) {
  const insets = useSafeAreaInsets();
  const { language, setLanguage } = useLanguageStore();
  const { getUnreadCount } = useNotificationStore();
  const unreadCount = getUnreadCount();

  const isDark = isSeller;
  const textColor = isDark ? colors.white : colors.text;
  const iconColor = isDark ? colors.white : colors.primaryDark;

  return (
    <View
      style={[
        styles.wrapper,
        isDark ? styles.sellerWrapper : styles.buyerWrapper,
        { paddingTop: insets.top },
        style,
      ]}>
      <View style={styles.contentRow}>
        {/* Left Section: Back Button or Logo + App Title */}
        <View style={styles.leftSection}>
          {showBack && (
            <Pressable
              onPress={() => router.back()}
              hitSlop={8}
              style={styles.backButton}>
              <MaterialCommunityIcons
                name="arrow-left"
                size={24}
                color={textColor}
              />
            </Pressable>
          )}

          {/* Logo image with fixed dimensions on every screen */}
          <Image
            source={require('@/assets/logo.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />

          <View style={styles.titleColumn}>
            <View style={styles.titleRow}>
              <Text style={[styles.appName, { color: textColor }]}>
                {title || 'FarmKart'}
              </Text>
              {isSeller && (
                <View style={styles.sellerPill}>
                  <Text style={styles.sellerPillText}>
                    {language === 'ta' ? 'விற்பனையாளர்' : 'Seller Mode'}
                  </Text>
                </View>
              )}
            </View>
            <Text
              style={[
                styles.tamilTagline,
                { color: isDark ? colors.primaryLight : colors.textSecondary },
              ]}>
              உழவன் சந்தை
            </Text>
          </View>
        </View>

        {/* Right Section: Actions (Search, Notifications, Cart, Language) */}
        <View style={styles.rightSection}>
          {showSearch && (
            <Pressable
              onPress={onSearchPress}
              hitSlop={6}
              style={styles.actionBtn}>
              <MaterialCommunityIcons
                name="magnify"
                size={22}
                color={iconColor}
              />
            </Pressable>
          )}

          {showNotifications && (
            <Pressable
              onPress={() => {
                if (onNotificationPress) {
                  onNotificationPress();
                } else if (!isSeller) {
                  router.push('/(buyer)/notifications');
                }
              }}
              hitSlop={6}
              style={styles.actionBtn}>
              <MaterialCommunityIcons
                name="bell-outline"
                size={22}
                color={iconColor}
              />
              {unreadCount > 0 && (
                <View style={styles.notifBadge}>
                  <Text style={styles.notifBadgeText}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </Text>
                </View>
              )}
            </Pressable>
          )}

          {showCart && (
            <Pressable
              onPress={onCartPress}
              hitSlop={6}
              style={styles.actionBtn}>
              <MaterialCommunityIcons
                name="cart-outline"
                size={22}
                color={iconColor}
              />
              {cartCount > 0 && (
                <View style={styles.cartBadge}>
                  <Text style={styles.cartBadgeText}>
                    {cartCount > 99 ? '99+' : cartCount}
                  </Text>
                </View>
              )}
            </Pressable>
          )}

          {showLanguageToggle && (
            <Pressable
              onPress={() => setLanguage(language === 'en' ? 'ta' : 'en')}
              hitSlop={6}
              style={[
                styles.langToggle,
                isDark ? styles.langToggleDark : styles.langToggleLight,
              ]}>
              <Text
                style={[
                  styles.langToggleText,
                  { color: isDark ? colors.white : colors.primaryDark },
                ]}>
                {language === 'en' ? 'தமிழ்' : 'EN'}
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    ...shadows.soft,
  },
  buyerWrapper: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sellerWrapper: {
    backgroundColor: colors.primaryDark,
  },
  contentRow: {
    height: 56, // Consistent fixed height across screens
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backButton: {
    marginRight: spacing.xs,
    padding: 4,
  },
  logoImage: {
    width: 36,
    height: 36,
    borderRadius: 8,
    marginRight: spacing.sm,
  },
  titleColumn: {
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  appName: {
    fontSize: fontSizes.lg,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  sellerPill: {
    backgroundColor: colors.accent,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  sellerPillText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  tamilTagline: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: -1,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  actionBtn: {
    padding: 4,
    position: 'relative',
  },
  cartBadge: {
    position: 'absolute',
    top: -2,
    right: -4,
    backgroundColor: colors.accent,
    borderRadius: 10,
    minWidth: 17,
    height: 17,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  cartBadgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '700',
  },
  notifBadge: {
    position: 'absolute',
    top: -2,
    right: -4,
    backgroundColor: '#E53935',
    borderRadius: 10,
    minWidth: 17,
    height: 17,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  notifBadgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '700',
  },
  langToggle: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  langToggleLight: {
    borderColor: colors.border,
    backgroundColor: colors.primaryLight,
  },
  langToggleDark: {
    borderColor: 'rgba(255,255,255,0.3)',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  langToggleText: {
    fontSize: 11,
    fontWeight: '700',
  },
});

export default AppHeader;
