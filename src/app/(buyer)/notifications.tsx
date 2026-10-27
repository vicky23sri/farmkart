/**
 * Buyer Notifications Screen
 * Features:
 * - AppHeader on top with Back button, cart count badge, and title
 * - Filter tabs: All, Orders, Harvests & Offers
 * - Actions: "Mark All as Read", "Clear All"
 * - Clickable notification cards with status badges and unread indicator
 * - Direct navigation to Order Tracking, Product Details, or Marketplace
 */

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
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
import { EmptyState } from '@/components/EmptyState';
import {
  FarmNotification,
  useCartStore,
  useLanguageStore,
  useNotificationStore,
} from '@/store';
import { colors, fontSizes, spacing } from '@/theme';

type NotificationFilter = 'all' | 'order' | 'harvest';

export default function NotificationsScreen() {
  const { language } = useLanguageStore();
  const { getTotalCount } = useCartStore();
  const {
    notifications,
    markAsRead,
    markAllAsRead,
    clearAll,
    getUnreadCount,
  } = useNotificationStore();

  const [filter, setFilter] = useState<NotificationFilter>('all');

  const unreadCount = getUnreadCount();

  const filteredList = notifications.filter((n) => {
    if (filter === 'all') return true;
    if (filter === 'order') return n.type === 'order';
    if (filter === 'harvest') return n.type === 'harvest' || n.type === 'offer' || n.type === 'farmer';
    return true;
  });

  const handleClearAll = () => {
    Alert.alert(
      language === 'ta' ? 'அறிவிப்புகளை அழிக்கவா?' : 'Clear All Notifications?',
      language === 'ta'
        ? 'அனைத்து அறிவிப்புகளையும் நீக்க விரும்புகிறீர்களா?'
        : 'Are you sure you want to clear your notification history?',
      [
        { text: language === 'ta' ? 'ரத்து' : 'Cancel', style: 'cancel' },
        {
          text: language === 'ta' ? 'அழி' : 'Clear',
          style: 'destructive',
          onPress: () => clearAll(),
        },
      ]
    );
  };

  const handleNotificationPress = (item: FarmNotification) => {
    markAsRead(item.id);

    if (item.type === 'order') {
      if (item.orderId) {
        router.push({
          pathname: '/(buyer)/tracking',
          params: { orderId: item.orderId },
        });
      } else {
        router.push('/(buyer)/(tabs)/orders');
      }
    } else if (item.productId) {
      router.push({
        pathname: '/(buyer)/product-detail',
        params: { id: item.productId },
      });
    } else {
      router.push('/(buyer)/products');
    }
  };

  const getTypeIcon = (type: FarmNotification['type']): {
    name: any;
    bg: string;
    color: string;
  } => {
    switch (type) {
      case 'order':
        return { name: 'truck-fast', bg: '#E3F2FD', color: '#1976D2' };
      case 'harvest':
        return { name: 'sprout', bg: '#E8F5E9', color: colors.primaryDark };
      case 'offer':
        return { name: 'percent', bg: '#FFF3E0', color: colors.accent };
      case 'farmer':
        return { name: 'account-cowboy-hat', bg: '#EDE7F6', color: '#5E35B1' };
      default:
        return { name: 'bell-ring', bg: '#ECEFF1', color: colors.textSecondary };
    }
  };

  return (
    <View style={styles.screen}>
      <AppHeader
        showBack={true}
        title={language === 'ta' ? 'அறிவிப்புகள்' : 'Notifications'}
        cartCount={getTotalCount()}
        onCartPress={() => router.push('/(buyer)/(tabs)/cart')}
        onSearchPress={() => router.push('/(buyer)/products')}
      />

      {/* Top Filter and Actions Bar */}
      <View style={styles.controlsRow}>
        <View style={styles.filterPills}>
          <Pressable
            onPress={() => setFilter('all')}
            style={[styles.filterPill, filter === 'all' && styles.filterPillActive]}>
            <Text
              style={[
                styles.filterPillText,
                filter === 'all' && styles.filterPillTextActive,
              ]}>
              {language === 'ta' ? 'அனைத்தும்' : 'All'}{' '}
              {unreadCount > 0 && `(${unreadCount})`}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setFilter('order')}
            style={[styles.filterPill, filter === 'order' && styles.filterPillActive]}>
            <Text
              style={[
                styles.filterPillText,
                filter === 'order' && styles.filterPillTextActive,
              ]}>
              {language === 'ta' ? 'ஆர்டர்கள்' : 'Orders'}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setFilter('harvest')}
            style={[styles.filterPill, filter === 'harvest' && styles.filterPillActive]}>
            <Text
              style={[
                styles.filterPillText,
                filter === 'harvest' && styles.filterPillTextActive,
              ]}>
              {language === 'ta' ? 'அறுவடை & சலுகை' : 'Harvests & Deals'}
            </Text>
          </Pressable>
        </View>

        {notifications.length > 0 && (
          <View style={styles.actionButtonsCol}>
            {unreadCount > 0 && (
              <Pressable onPress={markAllAsRead} hitSlop={6} style={styles.textActionBtn}>
                <Text style={styles.markReadText}>
                  {language === 'ta' ? 'படித்ததாக குறி' : 'Mark all read'}
                </Text>
              </Pressable>
            )}
            <Pressable onPress={handleClearAll} hitSlop={6} style={styles.textActionBtn}>
              <Text style={styles.clearAllText}>
                {language === 'ta' ? 'அழி' : 'Clear'}
              </Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* Notifications List */}
      {filteredList.length === 0 ? (
        <EmptyState
          icon="bell-sleep-outline"
          title={
            language === 'ta'
              ? 'அறிவிப்புகள் எதுவும் இல்லை'
              : 'No Notifications Found'
          }
          description={
            language === 'ta'
              ? 'உங்கள் ஆர்டர் விநியோக தகவல்கள் மற்றும் புதிய அறுவடை அறிவிப்புகள் இங்கே தோன்றும்.'
              : 'Order delivery updates and daily Mandi harvest alerts will appear here.'
          }
          actionLabel={
            language === 'ta' ? 'சந்தைக்குச் செல்லவும்' : 'Browse Farm Marketplace'
          }
          onAction={() => router.push('/(buyer)/products')}
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}>
          {filteredList.map((item) => {
            const iconConfig = getTypeIcon(item.type);

            return (
              <Pressable
                key={item.id}
                onPress={() => handleNotificationPress(item)}
                style={({ pressed }) => [pressed && styles.cardPressed]}>
                <Card
                  style={[
                    styles.notifCard,
                    !item.read && styles.notifCardUnread,
                  ]}>
                  <View style={styles.cardRow}>
                    {/* Icon Circle */}
                    <View
                      style={[
                        styles.iconCircle,
                        { backgroundColor: iconConfig.bg },
                      ]}>
                      <MaterialCommunityIcons
                        name={iconConfig.name}
                        size={22}
                        color={iconConfig.color}
                      />
                    </View>

                    {/* Content Col */}
                    <View style={styles.contentCol}>
                      <View style={styles.titleRow}>
                        <Text
                          style={[
                            styles.notifTitle,
                            !item.read && styles.notifTitleBold,
                          ]}
                          numberOfLines={1}>
                          {language === 'ta' ? item.titleTamil : item.title}
                        </Text>
                        <Text style={styles.timeAgoText}>{item.timeAgo}</Text>
                      </View>

                      <Text style={styles.messageText} numberOfLines={2}>
                        {language === 'ta' ? item.messageTamil : item.message}
                      </Text>

                      {/* Bottom action hint */}
                      <View style={styles.hintRow}>
                        <Text style={styles.viewLinkText}>
                          {item.type === 'order'
                            ? language === 'ta'
                              ? 'நேரலையில் கண்காணிக்க →'
                              : 'Track Live Status →'
                            : language === 'ta'
                            ? 'விளைபொருளைப் பார்க்க →'
                            : 'View Farm Produce →'}
                        </Text>
                        {!item.read && <View style={styles.unreadDot} />}
                      </View>
                    </View>
                  </View>
                </Card>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  controlsRow: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  filterPills: {
    flexDirection: 'row',
    gap: 6,
    flex: 1,
  },
  filterPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: '#F5F5F5',
  },
  filterPillActive: {
    backgroundColor: colors.primaryDark,
  },
  filterPillText: {
    fontSize: fontSizes.xs,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  filterPillTextActive: {
    color: colors.white,
    fontWeight: '700',
  },
  actionButtonsCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 6,
  },
  textActionBtn: {
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  markReadText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  clearAllText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.error,
  },
  container: {
    padding: spacing.md,
    gap: spacing.sm,
    paddingBottom: spacing.xxl + 20,
  },
  cardPressed: {
    opacity: 0.9,
  },
  notifCard: {
    padding: spacing.sm + 2,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  notifCardUnread: {
    backgroundColor: '#F7FCF6',
    borderColor: colors.primaryLight,
  },
  cardRow: {
    flexDirection: 'row',
    gap: spacing.sm + 2,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentCol: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  notifTitle: {
    fontSize: fontSizes.sm + 1,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
    marginRight: 6,
  },
  notifTitleBold: {
    fontWeight: '800',
    color: colors.primaryDark,
  },
  timeAgoText: {
    fontSize: 10,
    color: colors.textSecondary,
  },
  messageText: {
    fontSize: fontSizes.xs + 1,
    color: colors.textSecondary,
    lineHeight: 18,
    marginTop: 2,
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  viewLinkText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
});
