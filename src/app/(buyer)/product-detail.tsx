/**
 * Buyer Product Detail Screen
 * Detailed agricultural product page featuring:
 * - AppHeader
 * - Image gallery with pagination
 * - Organic badge & harvest date
 * - Unit dropdown selector & quantity selector
 * - Farmer card with verified credentials
 * - DeliveryBanner (feasibility check for 50 km radius)
 * - Ratings breakdown & verified reviews
 * - Sticky bottom bar with Add to Cart and Buy Now (strictly disabled if > 50 km)
 */

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { Card } from '@/components/Card';
import { DeliveryBanner } from '@/components/DeliveryBanner';
import { QuantitySelector } from '@/components/QuantitySelector';
import { RatingStars } from '@/components/RatingStars';
import { StatusChip } from '@/components/StatusChip';
import { Product, ProductUnit, Review, Seller } from '@/data/products';
import { productService } from '@/services/productService';
import { useCartStore, useLanguageStore, useWishlistStore } from '@/store';
import { colors, fontSizes, shadows, spacing } from '@/theme';
import { getDistanceKm } from '@/utils/distance';
import { BUYER_LOCATION } from './(tabs)/index';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function BuyerProductDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const { language } = useLanguageStore();
  const { addItem, getTotalCount } = useCartStore();
  const { toggleWishlist, isInWishlist } = useWishlistStore();

  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState<Product | null>(null);
  const [seller, setSeller] = useState<Seller | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);

  // Selection states
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [selectedUnit, setSelectedUnit] = useState<string>('kg');
  const [quantity, setQuantity] = useState(1);
  const [unitModalVisible, setUnitModalVisible] = useState(false);

  const totalCartCount = getTotalCount();
  const isFavorited = product ? isInWishlist(product.id) : false;

  useEffect(() => {
    async function fetchDetail() {
      setLoading(true);
      try {
        let currentProd: Product | null = null;
        if (params.id) {
          currentProd = await productService.getProductById(params.id);
        }
        if (!currentProd) {
          const all = await productService.getProducts();
          currentProd = all[0];
        }

        setProduct(currentProd);
        setSelectedUnit(currentProd.unit);
        setQuantity(currentProd.minOrder || 1);

        if (currentProd) {
          const [sellerData, reviewsData] = await Promise.all([
            productService.getSellerById(currentProd.sellerId),
            productService.getReviews(currentProd.id),
          ]);
          setSeller(sellerData);
          setReviews(reviewsData);
        }
      } catch (err) {
        console.error('Failed to load product detail:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchDetail();
  }, [params.id]);

  // Distance from Buyer to Farmer
  const distanceKm = useMemo(() => {
    if (!product) return 0;
    return getDistanceKm(BUYER_LOCATION.lat, BUYER_LOCATION.lng, product.lat, product.lng);
  }, [product]);

  // Crucial Rule: Deliverable only if within 50 km
  const isWithinDeliveryRadius = distanceKm <= 50;

  // Available units based on category
  const availableUnits: { unit: ProductUnit | string; labelEn: string; labelTa: string; multiplier: number }[] = useMemo(() => {
    if (!product) return [];
    const base = product.unit;

    if (base === 'quintal') {
      return [
        { unit: 'quintal', labelEn: 'Quintal (100 kg)', labelTa: 'குவின்டால் (100 கிலோ)', multiplier: 1 },
        { unit: 'bag', labelEn: 'Bag (50 kg)', labelTa: 'மூட்டை (50 கிலோ)', multiplier: 0.52 },
        { unit: 'ton', labelEn: 'Ton (1,000 kg)', labelTa: 'டன் (1,000 கிலோ)', multiplier: 9.8 },
      ];
    }
    if (base === 'tractor load') {
      return [
        { unit: 'tractor load', labelEn: 'Tractor Tipper Load (3 Ton)', labelTa: 'டிராக்டர் லோடு (3 டன்)', multiplier: 1 },
        { unit: 'bag', labelEn: 'Jumbo Bag (500 kg)', labelTa: 'ஜம்போ பை (500 கிலோ)', multiplier: 0.2 },
      ];
    }
    if (base === 'bundle') {
      return [
        { unit: 'bundle', labelEn: 'Standard Bundle', labelTa: 'நிலையான கட்டு', multiplier: 1 },
        { unit: 'truck load', labelEn: 'Mini Truck Load (50 Bundles)', labelTa: 'மினி லாரி லோடு (50 கட்டு)', multiplier: 48 },
      ];
    }
    if (base === 'bag') {
      return [
        { unit: 'bag', labelEn: 'Bag (40 kg)', labelTa: 'மூட்டை (40 கிலோ)', multiplier: 1 },
        { unit: 'kg', labelEn: 'Per kg loose', labelTa: 'ஒரு கிலோ உதிரி', multiplier: 0.03 },
      ];
    }
    // Default kg
    return [
      { unit: 'kg', labelEn: 'Kilogram (kg)', labelTa: 'கிலோ (kg)', multiplier: 1 },
      { unit: 'bag', labelEn: 'Bulk Bag (25 kg)', labelTa: 'மொத்த பை (25 கிலோ)', multiplier: 24 },
    ];
  }, [product]);

  const currentUnitConfig = availableUnits.find((u) => u.unit === selectedUnit) || {
    unit: selectedUnit,
    labelEn: selectedUnit,
    labelTa: selectedUnit,
    multiplier: 1,
  };

  const calculatedUnitPrice = Math.round((product?.price || 0) * currentUnitConfig.multiplier);
  const totalPrice = calculatedUnitPrice * quantity;

  // Add to cart handler
  const handleAddToCart = () => {
    if (!isWithinDeliveryRadius) {
      Alert.alert(
        language === 'ta' ? 'விநியோகம் கிடைக்கவில்லை' : 'Delivery Not Available',
        language === 'ta'
          ? 'இந்த பண்ணை 50 கி.மீ தூரத்திற்கு அப்பால் உள்ளது. நீங்கள் நேரடியாக பண்ணைக்கு சென்று பெற்றுக்கொள்ளலாம்.'
          : 'This farm is beyond the 50 km delivery limit. Direct farm pickup is required.'
      );
      return;
    }

    if (!product) return;
    addItem(product, quantity, selectedUnit);
    Alert.alert(
      language === 'ta' ? 'கூடையில் சேர்க்கப்பட்டது' : 'Added to Cart',
      language === 'ta'
        ? `${quantity} ${selectedUnit} ${product.nameTamil || product.name} கூடையில் வெற்றிகரமாக சேர்க்கப்பட்டது.`
        : `${quantity} ${selectedUnit} of ${product.name} added to your basket.`
    );
  };

  // Buy now handler
  const handleBuyNow = () => {
    if (!isWithinDeliveryRadius) {
      Alert.alert(
        language === 'ta' ? 'விநியோகம் கிடைக்கவில்லை' : 'Delivery Not Available',
        language === 'ta'
          ? '50 கி.மீ தொலைவிற்கு அப்பால் உள்ளதால் ஆன்லைன் விநியோகம் இயலாது.'
          : 'Online doorstep delivery is restricted beyond 50 km from the farm.'
      );
      return;
    }

    if (!product) return;
    addItem(product, quantity, selectedUnit);
    router.push('/(buyer)/checkout');
  };

  if (loading || !product) {
    return (
      <View style={styles.loaderScreen}>
        <AppHeader showBack={true} isSeller={false} cartCount={totalCartCount} />
        <View style={styles.loaderCenter}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>
            {language === 'ta'
              ? 'விளைபொருள் விபரங்கள் ஏற்றப்படுகின்றன...'
              : 'Loading crop information...'}
          </Text>
        </View>
      </View>
    );
  }

  // Multi-image list (fallback to product.images with placeholders)
  const galleryImages =
    product.images && product.images.length > 0
      ? product.images
      : ['https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=600'];

  return (
    <View style={styles.screen}>
      {/* AppHeader on Product Detail */}
      <AppHeader
        showBack={true}
        title={product.name}
        cartCount={totalCartCount}
        onSearchPress={() => router.push('/(buyer)/products')}
        onCartPress={() => router.push('/(buyer)/(tabs)/cart')}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}>
        {/* Image Gallery */}
        <View style={styles.galleryContainer}>
          <FlatList
            data={galleryImages}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(_, index) => String(index)}
            onMomentumScrollEnd={(e) => {
              const newIdx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
              setActiveImageIndex(newIdx);
            }}
            renderItem={({ item }) => (
              <View style={styles.imageSlide}>
                <Image
                  source={{ uri: item }}
                  style={styles.galleryImage}
                  resizeMode="cover"
                />
              </View>
            )}
          />

          {/* Overlays on Image */}
          <View style={styles.overlayTopRow}>
            <View style={styles.overlayBadgesGroup}>
              {product.isOrganic && (
                <View style={styles.organicBadge}>
                  <MaterialCommunityIcons name="leaf" size={14} color={colors.white} />
                  <Text style={styles.organicBadgeText}>
                    {language === 'ta' ? '100% இயற்கை' : '100% ORGANIC'}
                  </Text>
                </View>
              )}

              <View style={styles.distanceBadge}>
                <MaterialCommunityIcons
                  name="map-marker-distance"
                  size={14}
                  color={colors.white}
                />
                <Text style={styles.distanceBadgeText}>
                  {distanceKm.toFixed(1)} km
                </Text>
              </View>
            </View>

            {/* Wishlist Heart Toggle */}
            <Pressable
              onPress={() => {
                if (product) {
                  const added = toggleWishlist({
                    productId: product.id,
                    name: product.name,
                    nameTamil: product.nameTamil,
                    category: product.category,
                    price: product.price,
                    unit: product.unit,
                    image: product.images[0] || 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=600',
                    sellerId: product.sellerId,
                    sellerName: product.sellerName,
                    sellerFarm: seller?.farmName || product.sellerName,
                    village: product.village,
                    lat: product.lat,
                    lng: product.lng,
                    rating: product.rating,
                    isOrganic: product.isOrganic,
                    stock: product.stock,
                    minOrder: product.minOrder,
                    vehicleType: String(product.vehicleType || 'two_wheeler'),
                  });
                  Alert.alert(
                    added
                      ? language === 'ta'
                        ? 'விருப்பப்பட்டியலில் சேர்க்கப்பட்டது'
                        : 'Added to Wishlist'
                      : language === 'ta'
                      ? 'விருப்பப்பட்டியலில் இருந்து நீக்கப்பட்டது'
                      : 'Removed from Wishlist',
                    added
                      ? language === 'ta'
                        ? `${product.nameTamil || product.name} உங்கள் விருப்பப்பட்டியலில் சேர்க்கப்பட்டது.`
                        : `${product.name} saved to your wishlist!`
                      : language === 'ta'
                      ? `${product.nameTamil || product.name} விருப்பப்பட்டியலில் இருந்து நீக்கப்பட்டது.`
                      : `${product.name} removed from your wishlist.`
                  );
                }
              }}
              hitSlop={8}
              style={styles.wishlistOverlayBtn}>
              <MaterialCommunityIcons
                name={isFavorited ? 'heart' : 'heart-outline'}
                size={22}
                color={isFavorited ? '#E53935' : colors.white}
              />
            </Pressable>
          </View>

          {/* Gallery Pagination Dots */}
          {galleryImages.length > 1 && (
            <View style={styles.galleryDots}>
              {galleryImages.map((_, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.galleryDot,
                    activeImageIndex === idx && styles.galleryDotActive,
                  ]}
                />
              ))}
            </View>
          )}
        </View>

        {/* Product Basic Info Card */}
        <Card style={styles.infoCard}>
          <View style={styles.titlePriceRow}>
            <View style={styles.titlesCol}>
              <Text style={styles.productTitle}>{product.name}</Text>
              <Text style={styles.productTitleTamil}>{product.nameTamil}</Text>
            </View>

            <View style={styles.priceContainer}>
              <View style={styles.priceRow}>
                <Text style={styles.priceSymbol}>₹</Text>
                <Text style={styles.priceAmount}>{calculatedUnitPrice}</Text>
              </View>
              <Text style={styles.priceUnitText}>
                per {currentUnitConfig.labelEn.split(' ')[0]}
              </Text>
            </View>
          </View>

          {/* Rating Stars & Stock Status */}
          <View style={styles.ratingStockRow}>
            <RatingStars rating={product.rating} reviewsCount={product.reviewCount} />
            <StatusChip
              label={product.stock > 0 ? `In Stock (${product.stock} left)` : 'Out of Stock'}
              variant={product.stock > 0 ? 'success' : 'error'}
            />
          </View>

          {/* Fresh Harvest Date Notice */}
          <View style={styles.harvestDateBox}>
            <View style={styles.harvestIconBg}>
              <MaterialCommunityIcons
                name="calendar-clock"
                size={20}
                color={colors.primary}
              />
            </View>
            <View style={styles.harvestDateTexts}>
              <Text style={styles.harvestDateTitle}>
                {language === 'ta' ? 'அறுவடை தேதி:' : 'Harvested Date:'}{' '}
                <Text style={styles.harvestDateValue}>{product.harvestDate}</Text>
              </Text>
              <Text style={styles.harvestDateSub}>
                {language === 'ta'
                  ? 'புதிய பயிர் • அதிக ஊட்டச்சத்து மற்றும் இயற்கை சுவை'
                  : 'Fresh regional harvest • Zero chemical preservatives'}
              </Text>
            </View>
          </View>

          <Text style={styles.descriptionText}>{product.description}</Text>
        </Card>

        {/* Unit Dropdown Selector & Quantity Stepper */}
        <Card style={styles.selectorsCard}>
          <View style={styles.unitDropdownSection}>
            <Text style={styles.selectorLabel}>
              {language === 'ta' ? 'அளவீட்டு அலகு (Unit):' : 'Select Packaging Unit:'}
            </Text>
            <Pressable
              style={styles.unitDropdownBtn}
              onPress={() => setUnitModalVisible(true)}>
              <View style={styles.unitSelectedInfo}>
                <MaterialCommunityIcons
                  name="package-variant-closed"
                  size={18}
                  color={colors.primary}
                />
                <Text style={styles.unitDropdownBtnText}>
                  {language === 'ta'
                    ? currentUnitConfig.labelTa
                    : currentUnitConfig.labelEn}
                </Text>
              </View>
              <MaterialCommunityIcons
                name="chevron-down"
                size={20}
                color={colors.textSecondary}
              />
            </Pressable>
          </View>

          <View style={styles.divider} />

          <View style={styles.qtyRow}>
            <View>
              <Text style={styles.selectorLabel}>
                {language === 'ta' ? 'தேவையான அளவு:' : 'Select Quantity:'}
              </Text>
              <Text style={styles.minOrderHint}>
                {language === 'ta'
                  ? `குறைந்தபட்ச ஆர்டர்: ${product.minOrder || 1} ${selectedUnit}`
                  : `Min order: ${product.minOrder || 1} ${selectedUnit}`}
              </Text>
            </View>

            <QuantitySelector
              value={quantity}
              onChange={setQuantity}
              unit={selectedUnit}
              min={product.minOrder || 1}
              max={product.stock || 50}
            />
          </View>
        </Card>

        {/* Delivery Feasibility Banner (50 km enforcement) */}
        <View style={styles.deliveryBannerContainer}>
          <DeliveryBanner
            distanceKm={distanceKm}
            maxDeliverableKm={50}
            locationName={BUYER_LOCATION.city}
            deliveryTime="Today before 6:30 PM"
          />
        </View>

        {/* Farmer Card */}
        <Card style={styles.farmerCard}>
          <View style={styles.farmerCardHeader}>
            <View style={styles.farmerAvatarBg}>
              <MaterialCommunityIcons
                name="tractor"
                size={28}
                color={colors.primaryDark}
              />
            </View>
            <View style={styles.farmerMeta}>
              <View style={styles.farmerNameRow}>
                <Text style={styles.farmerName}>
                  {seller?.name || product.sellerName}
                </Text>
                {seller?.isVerified && (
                  <View style={styles.verifiedBadge}>
                    <MaterialCommunityIcons
                      name="check-decagram"
                      size={14}
                      color={colors.primary}
                    />
                    <Text style={styles.verifiedText}>
                      {language === 'ta' ? 'சரிபார்க்கப்பட்டது' : 'Verified Farmer'}
                    </Text>
                  </View>
                )}
              </View>

              <Text style={styles.farmName}>
                {seller?.farmName || `${product.village} Organic Farms`}
              </Text>
              <Text style={styles.farmerLocation}>
                <MaterialCommunityIcons
                  name="map-marker-outline"
                  size={12}
                  color={colors.textSecondary}
                />{' '}
                {seller?.village || product.village},{' '}
                {seller?.district || 'Tamil Nadu'} • ({distanceKm.toFixed(1)} km away)
              </Text>
            </View>
          </View>

          <View style={styles.farmerStatsRow}>
            <View style={styles.farmerStat}>
              <Text style={styles.farmerStatValue}>
                {seller?.rating || product.rating} ★
              </Text>
              <Text style={styles.farmerStatLabel}>
                {language === 'ta' ? 'விவசாயி மதிப்பீடு' : 'Farmer Rating'}
              </Text>
            </View>
            <View style={styles.farmerStatDivider} />
            <View style={styles.farmerStat}>
              <Text style={styles.farmerStatValue}>
                {seller?.totalOrders || 240}+
              </Text>
              <Text style={styles.farmerStatLabel}>
                {language === 'ta' ? 'நிறைவு செய்த ஆர்டர்கள்' : 'Orders Shipped'}
              </Text>
            </View>
            <View style={styles.farmerStatDivider} />
            <View style={styles.farmerStat}>
              <Text style={styles.farmerStatValue}>
                {product.vehicleType.replace('_', ' ')}
              </Text>
              <Text style={styles.farmerStatLabel}>
                {language === 'ta' ? 'போக்குவரத்து' : 'Fleet Type'}
              </Text>
            </View>
          </View>

          {seller?.mandiLicenseNo && (
            <View style={styles.licenseRow}>
              <MaterialCommunityIcons
                name="certificate-outline"
                size={14}
                color={colors.primary}
              />
              <Text style={styles.licenseText}>
                APMC Mandi License: {seller.mandiLicenseNo}
              </Text>
            </View>
          )}
        </Card>

        {/* Ratings Breakdown & Customer Reviews */}
        <Card style={styles.reviewsCard}>
          <Text style={styles.reviewsTitle}>
            {language === 'ta' ? 'மதிப்பீடுகள் & விமர்சனங்கள்' : 'Ratings & Customer Reviews'}
          </Text>

          <View style={styles.ratingsBreakdownRow}>
            <View style={styles.scoreCol}>
              <Text style={styles.overallScore}>{product.rating.toFixed(1)}</Text>
              <RatingStars rating={product.rating} size={14} />
              <Text style={styles.totalReviewsCount}>
                {product.reviewCount} {language === 'ta' ? 'மதிப்பீடுகள்' : 'ratings'}
              </Text>
            </View>

            {/* Star Distribution Bars */}
            <View style={styles.barsCol}>
              {[
                { stars: 5, pct: '82%' },
                { stars: 4, pct: '12%' },
                { stars: 3, pct: '4%' },
                { stars: 2, pct: '1%' },
                { stars: 1, pct: '1%' },
              ].map((b) => (
                <View key={b.stars} style={styles.barRow}>
                  <Text style={styles.barStarText}>{b.stars} ★</Text>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, { width: b.pct }]} />
                  </View>
                  <Text style={styles.barPctText}>{b.pct}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Review comments list */}
          <View style={styles.reviewsList}>
            {reviews.map((rev) => (
              <View key={rev.id} style={styles.reviewItem}>
                <View style={styles.reviewTopRow}>
                  <Text style={styles.buyerName}>{rev.buyerName}</Text>
                  <Text style={styles.reviewDate}>{rev.date}</Text>
                </View>
                <RatingStars rating={rev.rating} size={12} />
                <Text style={styles.reviewComment}>{rev.comment}</Text>
              </View>
            ))}
          </View>
        </Card>
      </ScrollView>

      {/* Sticky Bottom Bar with Add to Cart and Buy Now (Disabled if > 50 km) */}
      <View style={styles.stickyBottomBar}>
        <View style={styles.bottomPriceCol}>
          <Text style={styles.bottomSubtotalLabel}>
            {language === 'ta' ? 'மொத்த தொகை' : 'Subtotal'}
          </Text>
          <Text style={styles.bottomTotalPrice}>₹{totalPrice}</Text>
          <Text style={styles.bottomQtyDetail}>
            {quantity} {selectedUnit}
          </Text>
        </View>

        <View style={styles.bottomActionsCol}>
          <View style={styles.activeButtonsRow}>
            <Pressable
              style={styles.addToCartBtn}
              onPress={handleAddToCart}>
              <MaterialCommunityIcons
                name="cart-plus"
                size={18}
                color={colors.primary}
              />
              <Text style={styles.addToCartBtnText}>
                {language === 'ta' ? 'கூடையில் சேர்க்க' : 'Add to Cart'}
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.buyNowBtn,
                !isWithinDeliveryRadius && styles.requestDeliveryBtn,
              ]}
              onPress={handleBuyNow}>
              <Text style={styles.buyNowBtnText}>
                {isWithinDeliveryRadius
                  ? language === 'ta'
                    ? 'இப்போதே வாங்கு'
                    : 'Buy Now'
                  : language === 'ta'
                  ? 'விநியோகக் கோரிக்கை'
                  : 'Request Delivery'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* Unit Dropdown Selector Modal */}
      <Modal
        visible={unitModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setUnitModalVisible(false)}>
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setUnitModalVisible(false)}>
          <View style={styles.modalSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.modalTitle}>
              {language === 'ta' ? 'அளவீட்டு அலகைத் தேர்ந்தெடுக்கவும்' : 'Choose Package Unit'}
            </Text>

            {availableUnits.map((u) => {
              const unitPrice = Math.round(product.price * u.multiplier);
              const isSelected = selectedUnit === u.unit;
              return (
                <Pressable
                  key={u.unit}
                  style={[
                    styles.unitModalItem,
                    isSelected && styles.unitModalItemSelected,
                  ]}
                  onPress={() => {
                    setSelectedUnit(u.unit);
                    setUnitModalVisible(false);
                  }}>
                  <View style={styles.unitItemTextCol}>
                    <Text
                      style={[
                        styles.unitItemTitle,
                        isSelected && styles.unitItemTitleSelected,
                      ]}>
                      {language === 'ta' ? u.labelTa : u.labelEn}
                    </Text>
                    <Text style={styles.unitItemPrice}>₹{unitPrice} / unit</Text>
                  </View>
                  {isSelected && (
                    <MaterialCommunityIcons
                      name="check-circle"
                      size={22}
                      color={colors.primary}
                    />
                  )}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loaderScreen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loaderCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  loadingText: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
  },
  scrollContent: {
    paddingBottom: 110,
    gap: spacing.md,
  },
  galleryContainer: {
    width: '100%',
    height: 250,
    backgroundColor: '#EDF5EC',
    position: 'relative',
  },
  imageSlide: {
    width: SCREEN_WIDTH,
    height: 250,
  },
  galleryImage: {
    width: '100%',
    height: '100%',
  },
  overlayTopRow: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    right: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  overlayBadgesGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  wishlistOverlayBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  organicBadge: {
    backgroundColor: 'rgba(46, 125, 50, 0.92)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    gap: 4,
  },
  organicBadgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  distanceBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    gap: 4,
  },
  distanceBadgeText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '700',
  },
  galleryDots: {
    position: 'absolute',
    bottom: 8,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  galleryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
  },
  galleryDotActive: {
    width: 18,
    backgroundColor: colors.white,
  },
  infoCard: {
    marginHorizontal: spacing.md,
    gap: spacing.sm,
  },
  titlePriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  titlesCol: {
    flex: 1,
    marginRight: spacing.sm,
  },
  productTitle: {
    fontSize: fontSizes.lg,
    fontWeight: '800',
    color: colors.text,
  },
  productTitleTamil: {
    fontSize: fontSizes.xs + 1,
    color: colors.primaryDark,
    fontWeight: '600',
    marginTop: 2,
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  priceSymbol: {
    fontSize: fontSizes.sm,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  priceAmount: {
    fontSize: fontSizes.xxl,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  priceUnitText: {
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
    marginTop: -2,
  },
  ratingStockRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  harvestDateBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    padding: spacing.sm,
    borderRadius: 8,
    gap: spacing.xs + 2,
  },
  harvestIconBg: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  harvestDateTexts: {
    flex: 1,
  },
  harvestDateTitle: {
    fontSize: fontSizes.xs,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  harvestDateValue: {
    fontWeight: '800',
    color: colors.text,
  },
  harvestDateSub: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 1,
  },
  descriptionText: {
    fontSize: fontSizes.xs + 1,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  selectorsCard: {
    marginHorizontal: spacing.md,
    gap: spacing.sm,
  },
  unitDropdownSection: {
    gap: 6,
  },
  selectorLabel: {
    fontSize: fontSizes.xs + 1,
    fontWeight: '700',
    color: colors.text,
  },
  minOrderHint: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 2,
  },
  unitDropdownBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.background,
  },
  unitSelectedInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  unitDropdownBtnText: {
    fontSize: fontSizes.sm,
    fontWeight: '700',
    color: colors.text,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  qtyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deliveryBannerContainer: {
    marginHorizontal: spacing.md,
  },
  farmerCard: {
    marginHorizontal: spacing.md,
    gap: spacing.sm + 2,
  },
  farmerCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  farmerAvatarBg: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  farmerMeta: {
    flex: 1,
  },
  farmerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  farmerName: {
    fontSize: fontSizes.sm + 1,
    fontWeight: '800',
    color: colors.text,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 2,
  },
  verifiedText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  farmName: {
    fontSize: fontSizes.xs,
    fontWeight: '600',
    color: colors.primaryDark,
  },
  farmerLocation: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  farmerStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: colors.background,
    paddingVertical: 8,
    borderRadius: 8,
  },
  farmerStat: {
    alignItems: 'center',
  },
  farmerStatValue: {
    fontSize: fontSizes.sm,
    fontWeight: '800',
    color: colors.primaryDark,
    textTransform: 'capitalize',
  },
  farmerStatLabel: {
    fontSize: 9,
    color: colors.textSecondary,
    marginTop: 2,
  },
  farmerStatDivider: {
    width: 1,
    height: 20,
    backgroundColor: colors.border,
  },
  licenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 6,
  },
  licenseText: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  reviewsCard: {
    marginHorizontal: spacing.md,
    gap: spacing.sm,
  },
  reviewsTitle: {
    fontSize: fontSizes.md,
    fontWeight: '800',
    color: colors.text,
  },
  ratingsBreakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  scoreCol: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
  },
  overallScore: {
    fontSize: 34,
    fontWeight: '900',
    color: colors.primaryDark,
    lineHeight: 38,
  },
  totalReviewsCount: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  barsCol: {
    flex: 1,
    gap: 3,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  barStarText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
    width: 22,
  },
  barTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: '#FBC02D',
  },
  barPctText: {
    fontSize: 9,
    color: colors.textSecondary,
    width: 26,
    textAlign: 'right',
  },
  reviewsList: {
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  reviewItem: {
    gap: 3,
  },
  reviewTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  buyerName: {
    fontSize: fontSizes.xs + 1,
    fontWeight: '700',
    color: colors.text,
  },
  reviewDate: {
    fontSize: 10,
    color: colors.textMuted,
  },
  reviewComment: {
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
    lineHeight: 16,
    marginTop: 2,
  },
  stickyBottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...shadows.medium,
  },
  bottomPriceCol: {
    justifyContent: 'center',
  },
  bottomSubtotalLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  bottomTotalPrice: {
    fontSize: fontSizes.xl,
    fontWeight: '900',
    color: colors.primaryDark,
  },
  bottomQtyDetail: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  bottomActionsCol: {
    flex: 1,
    alignItems: 'flex-end',
    marginLeft: spacing.sm,
  },
  activeButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
  addToCartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  addToCartBtnText: {
    color: colors.primaryDark,
    fontSize: fontSizes.xs,
    fontWeight: '800',
  },
  buyNowBtn: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  requestDeliveryBtn: {
    backgroundColor: '#D97706',
  },
  buyNowBtnText: {
    color: colors.white,
    fontSize: fontSizes.xs + 1,
    fontWeight: '800',
  },
  disabledContainer: {
    alignItems: 'flex-end',
    gap: 2,
  },
  disabledAdvisoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  disabledAdvisoryText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.error,
  },
  disabledButton: {
    backgroundColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  disabledButtonText: {
    color: '#9E9E9E',
    fontSize: fontSizes.xs,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: 6,
  },
  modalTitle: {
    fontSize: fontSizes.md + 1,
    fontWeight: '800',
    color: colors.text,
  },
  unitModalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  unitModalItemSelected: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  unitItemTextCol: {
    gap: 2,
  },
  unitItemTitle: {
    fontSize: fontSizes.sm,
    fontWeight: '700',
    color: colors.text,
  },
  unitItemTitleSelected: {
    color: colors.primaryDark,
    fontWeight: '800',
  },
  unitItemPrice: {
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
  },
});
