/**
 * Buyer Wishlist Screen
 * Features:
 * - AppHeader on top with Back button, cart count badge, and title
 * - Saved farm crops list from useWishlistStore
 * - Real-time distance calculation via useLocationStore
 * - Feasibility enforcement: Warning if seller > 50 km away
 * - "Move to Cart" with automated fee computation and removal from wishlist
 * - Empty state with direct route to fresh crops
 */

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import {
  Alert,
  Image,
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
  useCartStore,
  useLanguageStore,
  useLocationStore,
  useWishlistStore,
  WishlistItem,
} from '@/store';
import { colors, fontSizes, spacing } from '@/theme';
import { getDistanceKm } from '@/utils/distance';

export default function WishlistScreen() {
  const { language } = useLanguageStore();
  const { items, removeFromWishlist, clearWishlist } = useWishlistStore();
  const { addItem, getTotalCount } = useCartStore();
  const { currentLocation } = useLocationStore();

  const handleClearAll = () => {
    Alert.alert(
      language === 'ta' ? 'விருப்பப்பட்டியலை அழிக்கவா?' : 'Clear Wishlist?',
      language === 'ta'
        ? 'அனைத்து சேமிக்கப்பட்ட விளைபொருட்களையும் நீக்க விரும்புகிறீர்களா?'
        : 'Are you sure you want to remove all saved items from your wishlist?',
      [
        { text: language === 'ta' ? 'ரத்து' : 'Cancel', style: 'cancel' },
        {
          text: language === 'ta' ? 'அழி' : 'Clear All',
          style: 'destructive',
          onPress: () => clearWishlist(),
        },
      ]
    );
  };

  const handleMoveToCart = (item: WishlistItem) => {
    // Check 50 km feasibility
    const distanceKm = currentLocation
      ? getDistanceKm(currentLocation.lat, currentLocation.lng, item.lat, item.lng)
      : 12;

    if (distanceKm > 50) {
      Alert.alert(
        language === 'ta' ? 'விநியோக தூரம் அதிகம்' : 'Delivery Not Feasible (>50 km)',
        language === 'ta'
          ? `இந்த விளைபொருள் பண்ணை (${item.sellerFarm}) உங்களிடமிருந்து ${distanceKm.toFixed(1)} கி.மீ தொலைவில் உள்ளது. 50 கி.மீ விநியோக எல்லைக்குள் இல்லை.`
          : `This farm (${item.sellerFarm}) is located ${distanceKm.toFixed(1)} km away. FarmKart mandi logistics strictly deliver within a 50 km radius to preserve farm freshness.`
      );
      return;
    }

    // Add to cart store
    addItem(
      {
        id: item.productId,
        name: item.name,
        nameTamil: item.nameTamil,
        category: item.category as any,
        price: item.price,
        unit: item.unit as any,
        stock: item.stock,
        minOrder: item.minOrder,
        isOrganic: item.isOrganic,
        harvestDate: 'Fresh harvest',
        sellerId: item.sellerId,
        sellerName: item.sellerName,
        village: item.village,
        lat: item.lat,
        lng: item.lng,
        images: [item.image],
        rating: item.rating,
        reviewCount: 42,
        description: '',
        vehicleType: item.vehicleType || 'two_wheeler',
      },
      item.minOrder || 1,
      item.unit
    );

    // Remove from wishlist
    removeFromWishlist(item.productId);

    Alert.alert(
      language === 'ta' ? 'கூடையில் சேர்க்கப்பட்டது' : 'Moved to Cart',
      language === 'ta'
        ? `${item.nameTamil || item.name} உங்கள் கூடையில் சேர்க்கப்பட்டது.`
        : `${item.name} has been added to your cart!`
    );
  };

  return (
    <View style={styles.screen}>
      <AppHeader
        showBack={true}
        title={language === 'ta' ? 'என் விருப்பப்பட்டியல்' : 'My Wishlist'}
        cartCount={getTotalCount()}
        onCartPress={() => router.push('/(buyer)/(tabs)/cart')}
        onSearchPress={() => router.push('/(buyer)/products')}
      />

      {items.length === 0 ? (
        <EmptyState
          icon="heart-broken-outline"
          title={language === 'ta' ? 'விருப்பப்பட்டியல் காலியாக உள்ளது' : 'Your Wishlist is Empty'}
          description={
            language === 'ta'
              ? 'உங்களுக்கு பிடித்தமான புதிய காய்கறிகள், உரங்கள் மற்றும் தானியங்களை இதயக்குறியை அழுத்தி சேமிக்கவும்.'
              : 'Save fresh farm harvests, organic manure, and pulses by tapping the heart icon.'
          }
          actionLabel={
            language === 'ta' ? 'விளைபொருட்களை உலாவவும்' : 'Explore Fresh Harvests'
          }
          onAction={() => router.push('/(buyer)/products')}
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}>
          {/* Header Bar */}
          <View style={styles.listHeaderRow}>
            <Text style={styles.itemsCountText}>
              {items.length}{' '}
              {items.length === 1
                ? language === 'ta'
                  ? 'பொருள்'
                  : 'item'
                : language === 'ta'
                ? 'பொருட்கள்'
                : 'items'}
            </Text>
            <Pressable onPress={handleClearAll} hitSlop={6} style={styles.clearBtn}>
              <MaterialCommunityIcons
                name="trash-can-outline"
                size={16}
                color={colors.error}
              />
              <Text style={styles.clearBtnText}>
                {language === 'ta' ? 'அனைத்தையும் நீக்கு' : 'Clear All'}
              </Text>
            </Pressable>
          </View>

          {/* Items List */}
          {items.map((item) => {
            const distanceKm = currentLocation
              ? getDistanceKm(currentLocation.lat, currentLocation.lng, item.lat, item.lng)
              : 12;
            const isOutOfRange = distanceKm > 50;

            return (
              <Card key={item.productId} style={styles.wishlistCard}>
                <View style={styles.cardContentRow}>
                  {/* Thumbnail with Organic Tag */}
                  <View style={styles.thumbContainer}>
                    <Image
                      source={{ uri: item.image }}
                      style={styles.thumb}
                      resizeMode="cover"
                    />
                    {item.isOrganic && (
                      <View style={styles.organicTag}>
                        <MaterialCommunityIcons name="leaf" size={10} color={colors.white} />
                        <Text style={styles.organicTagText}>இயற்கை</Text>
                      </View>
                    )}
                  </View>

                  {/* Info Column */}
                  <View style={styles.infoCol}>
                    <View style={styles.titleRow}>
                      <Text style={styles.productName} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Pressable
                        onPress={() => removeFromWishlist(item.productId)}
                        hitSlop={8}
                        style={styles.removeBtn}>
                        <MaterialCommunityIcons
                          name="heart"
                          size={22}
                          color="#E53935"
                        />
                      </Pressable>
                    </View>

                    {item.nameTamil ? (
                      <Text style={styles.productNameTamil} numberOfLines={1}>
                        {item.nameTamil}
                      </Text>
                    ) : null}

                    {/* Farmer / Village */}
                    <View style={styles.farmerRow}>
                      <MaterialCommunityIcons
                        name="tractor"
                        size={14}
                        color={colors.primary}
                      />
                      <Text style={styles.farmerText} numberOfLines={1}>
                        {item.sellerName} • {item.village}
                      </Text>
                    </View>

                    {/* Distance Pill */}
                    <View style={styles.distanceRow}>
                      <View
                        style={[
                          styles.distancePill,
                          isOutOfRange ? styles.distancePillOut : styles.distancePillIn,
                        ]}>
                        <MaterialCommunityIcons
                          name={isOutOfRange ? 'alert-circle' : 'map-marker-distance'}
                          size={12}
                          color={isOutOfRange ? colors.error : colors.primaryDark}
                        />
                        <Text
                          style={[
                            styles.distancePillText,
                            isOutOfRange
                              ? styles.distancePillTextOut
                              : styles.distancePillTextIn,
                          ]}>
                          {distanceKm.toFixed(1)} km{' '}
                          {isOutOfRange
                            ? language === 'ta'
                              ? '(50 கி.மீ தாண்டி)'
                              : '(>50 km)'
                            : language === 'ta'
                            ? '(கிடைக்கும்)'
                            : '(Deliverable)'}
                        </Text>
                      </View>
                    </View>

                    {/* Price & Move to Cart Button */}
                    <View style={styles.bottomRow}>
                      <View style={styles.priceRow}>
                        <Text style={styles.currencySymbol}>₹</Text>
                        <Text style={styles.priceAmount}>{item.price}</Text>
                        <Text style={styles.unitText}>/{item.unit}</Text>
                      </View>

                      <Pressable
                        onPress={() => handleMoveToCart(item)}
                        style={[
                          styles.moveToCartBtn,
                          isOutOfRange && styles.moveToCartBtnDisabled,
                        ]}>
                        <MaterialCommunityIcons
                          name="cart-plus"
                          size={16}
                          color={colors.white}
                        />
                        <Text style={styles.moveToCartBtnText}>
                          {language === 'ta' ? 'கூடைக்கு மாற்று' : 'Move to Cart'}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              </Card>
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
  container: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xxl + 20,
  },
  listHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  itemsCountText: {
    fontSize: fontSizes.sm,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  clearBtnText: {
    fontSize: fontSizes.xs + 1,
    fontWeight: '700',
    color: colors.error,
  },
  wishlistCard: {
    padding: spacing.sm + 2,
    borderRadius: 14,
  },
  cardContentRow: {
    flexDirection: 'row',
    gap: spacing.sm + 2,
  },
  thumbContainer: {
    width: 96,
    height: 96,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: colors.primaryLight,
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  organicTag: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
  },
  organicTagText: {
    color: colors.white,
    fontSize: 9,
    fontWeight: '700',
  },
  infoCol: {
    flex: 1,
    justifyContent: 'space-between',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  productName: {
    fontSize: fontSizes.sm + 2,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
    marginRight: 6,
  },
  removeBtn: {
    padding: 2,
  },
  productNameTamil: {
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
    marginTop: -1,
  },
  farmerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  farmerText: {
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  distanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  distancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  distancePillIn: {
    backgroundColor: colors.primaryLight,
  },
  distancePillOut: {
    backgroundColor: '#FFEBEE',
  },
  distancePillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  distancePillTextIn: {
    color: colors.primaryDark,
  },
  distancePillTextOut: {
    color: colors.error,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  currencySymbol: {
    fontSize: fontSizes.xs,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  priceAmount: {
    fontSize: fontSizes.md + 1,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  unitText: {
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
    marginLeft: 1,
  },
  moveToCartBtn: {
    backgroundColor: colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  moveToCartBtnDisabled: {
    backgroundColor: '#CCC',
  },
  moveToCartBtnText: {
    color: colors.white,
    fontSize: fontSizes.xs,
    fontWeight: '700',
  },
});
