/**
 * Buyer Home Screen
 * Displays location bar ("Delivering within 50 km"), search bar, category chips,
 * offer banner carousel, and sections: "Fresh near you", "Best sellers", "Deals of the day".
 */

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { CategoryChip } from '@/components/CategoryChip';
import { ProductCard } from '@/components/ProductCard';
import { Product } from '@/data/products';
import { productService } from '@/services/productService';
import { useCartStore, useLanguageStore } from '@/store';
import { colors, fontSizes, shadows, spacing } from '@/theme';
import { getDistanceKm } from '@/utils/distance';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Default Buyer Reference Location (Madurai, Tamil Nadu)
export const BUYER_LOCATION = {
  lat: 9.9252,
  lng: 78.1198,
  city: 'Madurai Central',
  state: 'Tamil Nadu',
};

// Promotional Offer Banners for Carousel
const OFFER_BANNERS = [
  {
    id: 'b1',
    tag: 'FARM FRESH DIRECT',
    tagTa: 'நேரடி உழவர் சந்தை',
    title: 'Zero Middlemen, Direct From Farmers',
    titleTa: 'இடைத்தரகர்கள் இன்றி விவசாயிகளிடம் நேரடியாக வாங்குங்கள்',
    subtitle: 'Delivering within 50 km directly to your doorstep',
    subtitleTa: '50 கி.மீ சுற்றளவில் உங்கள் வீட்டு வாசலில் விநியோகம்',
    color: '#1B5E20',
    accentColor: '#4CAF50',
    icon: 'tractor' as const,
  },
  {
    id: 'b2',
    tag: 'HARVEST SPECIAL',
    tagTa: 'அறுவடை சிறப்பு',
    title: 'Heritage Paddy & Desi Millets',
    titleTa: 'பாரம்பரிய பொன்னி நெல் & சிறுதானியங்கள்',
    subtitle: 'Direct from Cauvery Delta & Madurai organic farms',
    subtitleTa: 'காவிரி டெல்டா & மதுரை இயற்கை பண்ணை விளைபொருட்கள்',
    color: '#BF360C',
    accentColor: '#FF7043',
    icon: 'rice' as const,
  },
  {
    id: 'b3',
    tag: 'SOIL HEALTH',
    tagTa: 'இயற்கை உரம்',
    title: 'Pure Cattle Manure & Fodder Bales',
    titleTa: 'மாட்டு எரு & வைக்கோல் கட்டுகள்',
    subtitle: 'Bulk tractor load & bundle delivery available',
    subtitleTa: 'டிராக்டர் லோடு மற்றும் கட்டுகளாக நேரடி விநியோகம்',
    color: '#3E2723',
    accentColor: '#8D6E63',
    icon: 'flower-tulip-outline' as const,
  },
];

export default function BuyerHomeScreen() {
  const { language } = useLanguageStore();
  const { items, addItem, updateQuantity, getTotalCount } = useCartStore();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeBannerIndex, setActiveBannerIndex] = useState(0);

  const bannerListRef = useRef<FlatList>(null);
  const totalCartCount = getTotalCount();

  const loadData = async () => {
    try {
      const products = await productService.getProducts();
      setAllProducts(products);
    } catch (error) {
      console.error('Failed to load products:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const products = await productService.getProducts();
        if (isMounted) {
          setAllProducts(products);
        }
      } catch (error) {
        console.error('Failed to load products:', error);
      } finally {
        if (isMounted) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // Categories list with Tamil translations
  const CATEGORIES = useMemo(
    () => [
      { id: 'all', label: language === 'ta' ? 'அனைத்தும்' : 'All', icon: 'view-grid-outline' as const },
      { id: 'vegetables', label: language === 'ta' ? 'காய்கறிகள்' : 'Vegetables', icon: 'carrot' as const },
      { id: 'grains', label: language === 'ta' ? 'நெல் & அரிசி' : 'Paddy & Rice', icon: 'rice' as const },
      { id: 'millets', label: language === 'ta' ? 'சிறுதானியங்கள்' : 'Millets', icon: 'barley' as const },
      { id: 'manure', label: language === 'ta' ? 'மாட்டு எரு' : 'Manure', icon: 'flower-tulip-outline' as const },
      { id: 'fodder', label: language === 'ta' ? 'வைக்கோல் & புல்' : 'Fodder', icon: 'grass' as const },
      { id: 'pulses', label: language === 'ta' ? 'பருப்பு' : 'Pulses', icon: 'seed-outline' as const },
      { id: 'spices', label: language === 'ta' ? 'மசாலா' : 'Spices', icon: 'chili-mild' as const },
      { id: 'dairy', label: language === 'ta' ? 'நாட்டு நெய்/பால்' : 'Dairy', icon: 'cup-water' as const },
    ],
    [language]
  );

  // Products with calculated distance from buyer
  const productsWithDistance = useMemo(() => {
    return allProducts.map((p) => ({
      ...p,
      distanceKm: getDistanceKm(BUYER_LOCATION.lat, BUYER_LOCATION.lng, p.lat, p.lng),
    }));
  }, [allProducts]);

  // Section 1: "Fresh near you" - deliverable items sorted by distance (< 50 km)
  const freshNearYou = useMemo(() => {
    return productsWithDistance
      .filter((p) => p.distanceKm <= 50)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 6);
  }, [productsWithDistance]);

  // Section 2: "Best sellers" - high rating and review counts
  const bestSellers = useMemo(() => {
    return [...productsWithDistance]
      .sort((a, b) => b.rating * b.reviewCount - a.rating * a.reviewCount)
      .slice(0, 6);
  }, [productsWithDistance]);

  // Section 3: "Deals of the day" - organic produce and direct-farm deals
  const dealsOfTheDay = useMemo(() => {
    return productsWithDistance
      .filter((p) => p.isOrganic || p.price <= 50)
      .sort((a, b) => a.price - b.price)
      .slice(0, 6);
  }, [productsWithDistance]);

  const handleSearchSubmit = () => {
    if (searchQuery.trim()) {
      router.push({
        pathname: '/(buyer)/products',
        params: { search: searchQuery.trim() },
      });
    } else {
      router.push('/(buyer)/products');
    }
  };

  const handleCategoryPress = (catId: string) => {
    setActiveCategory(catId);
    if (catId === 'all') {
      router.push('/(buyer)/products');
    } else {
      router.push({
        pathname: '/(buyer)/products',
        params: { category: catId },
      });
    }
  };

  const getItemCartQty = (productId: string) => {
    const found = items.find((i) => i.id === productId);
    return found ? found.quantity : 0;
  };

  const renderProductItem = (product: Product & { distanceKm: number }) => {
    const qty = getItemCartQty(product.id);
    return (
      <View key={product.id} style={styles.horizontalCardWrapper}>
        <ProductCard
          name={product.name}
          subtitle={product.nameTamil}
          farmerName={`${product.sellerName} • ${product.village}`}
          distanceKm={product.distanceKm}
          price={product.price}
          unit={product.unit}
          rating={product.rating}
          imageUri={product.images[0]}
          quantity={qty}
          onAdd={() => addItem(product, 1)}
          onQuantityChange={(newQty) => updateQuantity(product.id, newQty)}
          onPress={() =>
            router.push({
              pathname: '/(buyer)/product-detail',
              params: { id: product.id },
            })
          }
        />
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      {/* Universal AppHeader on every screen */}
      <AppHeader
        isSeller={false}
        title="FarmKart"
        cartCount={totalCartCount}
        onSearchPress={() => router.push('/(buyer)/products')}
        onNotificationPress={() =>
          Alert.alert(
            language === 'ta' ? 'அறிவிப்புகள்' : 'Notifications',
            language === 'ta'
              ? 'உங்கள் பகுதிக்கு புதிய அறுவடை வந்துள்ளது!'
              : 'New fresh harvest just arrived near your area!'
          )
        }
        onCartPress={() => router.push('/(buyer)/(tabs)/cart')}
      />

      {/* Location Bar: "Delivering within 50 km" */}
      <View style={styles.locationBar}>
        <View style={styles.locationLeft}>
          <View style={styles.locationPinBg}>
            <MaterialCommunityIcons
              name="map-marker-radius"
              size={18}
              color={colors.primary}
            />
          </View>
          <View style={styles.locationTexts}>
            <View style={styles.locationHeadlineRow}>
              <Text style={styles.locationCity}>{BUYER_LOCATION.city}</Text>
              <View style={styles.radiusPill}>
                <Text style={styles.radiusPillText}>
                  {language === 'ta' ? '50 கி.மீ எல்லை' : 'Delivering within 50 km'}
                </Text>
              </View>
            </View>
            <Text style={styles.locationSub}>
              {language === 'ta'
                ? 'உங்கள் வீட்டைச் சுற்றியுள்ள பண்ணை விளைபொருட்கள்'
                : 'Direct from regional farmers to your doorstep'}
            </Text>
          </View>
        </View>

        <Pressable
          hitSlop={8}
          onPress={() =>
            Alert.alert(
              language === 'ta' ? 'விநியோக இடம்' : 'Delivery Location',
              language === 'ta'
                ? `தற்போதைய இடம்: ${BUYER_LOCATION.city}. அனைத்து தயாரிப்புகளும் 50 கி.மீ சுற்றளவுக்குள் கணக்கிடப்படுகின்றன.`
                : `Current hub: ${BUYER_LOCATION.city}. Doorstep delivery is available for farms within 50 km.`
            )
          }
          style={styles.locationChangeBtn}>
          <Text style={styles.locationChangeText}>
            {language === 'ta' ? 'மாற்று' : 'Change'}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
          />
        }>
        {/* Search Bar */}
        <View style={styles.searchBarWrapper}>
          <Pressable
            style={styles.searchContainer}
            onPress={() => router.push('/(buyer)/products')}>
            <MaterialCommunityIcons
              name="magnify"
              size={22}
              color={colors.textSecondary}
              style={styles.searchIcon}
            />
            <TextInput
              style={styles.searchInput}
              placeholder={
                language === 'ta'
                  ? 'நெல், காய்கறி, மாட்டு எரு, வைக்கோல் தேடுக...'
                  : 'Search Nellu, Veg, Mattu Eruvu, Fodder...'
              }
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearchSubmit}
              returnKeyType="search"
            />
            {searchQuery.length > 0 ? (
              <Pressable onPress={() => setSearchQuery('')} hitSlop={6}>
                <MaterialCommunityIcons
                  name="close-circle"
                  size={18}
                  color={colors.textMuted}
                />
              </Pressable>
            ) : (
              <Pressable
                onPress={() =>
                  Alert.alert(
                    language === 'ta' ? 'குரல் தேடல்' : 'Voice Search',
                    language === 'ta'
                      ? 'குரல் தேடல் விரைவில் வரவுள்ளது.'
                      : 'Voice search in Tamil & English is activating soon.'
                  )
                }
                hitSlop={6}>
                <MaterialCommunityIcons
                  name="microphone-outline"
                  size={20}
                  color={colors.primary}
                />
              </Pressable>
            )}
          </Pressable>
        </View>

        {/* Category Chips Horizontal Row */}
        <View style={styles.categorySection}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryScroll}>
            {CATEGORIES.map((cat) => (
              <CategoryChip
                key={cat.id}
                label={cat.label}
                icon={cat.icon}
                selected={activeCategory === cat.id}
                onPress={() => handleCategoryPress(cat.id)}
              />
            ))}
          </ScrollView>
        </View>

        {/* Offer Banner Carousel */}
        <View style={styles.carouselContainer}>
          <FlatList
            ref={bannerListRef}
            data={OFFER_BANNERS}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item.id}
            onMomentumScrollEnd={(e) => {
              const newIndex = Math.round(
                e.nativeEvent.contentOffset.x / (SCREEN_WIDTH - spacing.md * 2)
              );
              setActiveBannerIndex(newIndex);
            }}
            renderItem={({ item }) => (
              <View
                style={[
                  styles.bannerCard,
                  { backgroundColor: item.color, width: SCREEN_WIDTH - spacing.md * 2 },
                ]}>
                <View style={styles.bannerContent}>
                  <View
                    style={[
                      styles.bannerTagBadge,
                      { backgroundColor: item.accentColor },
                    ]}>
                    <Text style={styles.bannerTagText}>
                      {language === 'ta' ? item.tagTa : item.tag}
                    </Text>
                  </View>
                  <Text style={styles.bannerTitle}>
                    {language === 'ta' ? item.titleTa : item.title}
                  </Text>
                  <Text style={styles.bannerSub}>
                    {language === 'ta' ? item.subtitleTa : item.subtitle}
                  </Text>
                </View>
                <View style={styles.bannerIconWrapper}>
                  <MaterialCommunityIcons
                    name={item.icon}
                    size={48}
                    color="rgba(255, 255, 255, 0.28)"
                  />
                </View>
              </View>
            )}
          />
          {/* Carousel Pagination Dots */}
          <View style={styles.paginationDots}>
            {OFFER_BANNERS.map((_, idx) => (
              <View
                key={idx}
                style={[
                  styles.dot,
                  activeBannerIndex === idx ? styles.dotActive : styles.dotInactive,
                ]}
              />
            ))}
          </View>
        </View>

        {loading ? (
          <View style={styles.loaderArea}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loaderText}>
              {language === 'ta'
                ? 'பண்ணை விளைபொருட்கள் ஏற்றப்படுகின்றன...'
                : 'Connecting to nearby farms...'}
            </Text>
          </View>
        ) : (
          <>
            {/* Section 1: Fresh near you (<= 50 km) */}
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionTitleBlock}>
                <View style={styles.sectionBadgeRow}>
                  <MaterialCommunityIcons
                    name="map-marker-check"
                    size={18}
                    color={colors.primary}
                  />
                  <Text style={styles.sectionTitle}>
                    {language === 'ta' ? 'அருகிலுள்ள புதிய அறுவடை' : 'Fresh near you'}
                  </Text>
                </View>
                <Text style={styles.sectionSub}>
                  {language === 'ta'
                    ? '50 கி.மீ சுற்றளவில் உள்ள நேரடி பண்ணைகள்'
                    : 'Within 50 km • Fast doorstep farm delivery'}
                </Text>
              </View>
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: '/(buyer)/products',
                    params: { maxDistance: '50', sort: 'distance' },
                  })
                }
                style={styles.seeAllBtn}>
                <Text style={styles.seeAllText}>
                  {language === 'ta' ? 'அனைத்தும்' : 'See all'}
                </Text>
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={16}
                  color={colors.primary}
                />
              </Pressable>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalProductsList}>
              {freshNearYou.map(renderProductItem)}
            </ScrollView>

            {/* Section 2: Best sellers */}
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionTitleBlock}>
                <View style={styles.sectionBadgeRow}>
                  <MaterialCommunityIcons
                    name="star-circle"
                    size={18}
                    color={colors.accent}
                  />
                  <Text style={styles.sectionTitle}>
                    {language === 'ta' ? 'அதிகம் விற்கப்படும் பயிர்கள்' : 'Best sellers'}
                  </Text>
                </View>
                <Text style={styles.sectionSub}>
                  {language === 'ta'
                    ? 'வாடிக்கையாளர்களால் அதிகம் விரும்பப்பட்டவை'
                    : 'Highest rated direct from certified farmers'}
                </Text>
              </View>
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: '/(buyer)/products',
                    params: { sort: 'rating' },
                  })
                }
                style={styles.seeAllBtn}>
                <Text style={styles.seeAllText}>
                  {language === 'ta' ? 'அனைத்தும்' : 'See all'}
                </Text>
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={16}
                  color={colors.primary}
                />
              </Pressable>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalProductsList}>
              {bestSellers.map(renderProductItem)}
            </ScrollView>

            {/* Section 3: Deals of the day */}
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionTitleBlock}>
                <View style={styles.sectionBadgeRow}>
                  <MaterialCommunityIcons
                    name="tag-heart"
                    size={18}
                    color="#D32F2F"
                  />
                  <Text style={styles.sectionTitle}>
                    {language === 'ta' ? 'இன்றைய சிறப்பு விலை' : 'Deals of the day'}
                  </Text>
                </View>
                <Text style={styles.sectionSub}>
                  {language === 'ta'
                    ? 'சிறப்பு தள்ளுபடியில் இயற்கை விளைபொருட்கள்'
                    : 'Direct farm gate pricing on organic essentials'}
                </Text>
              </View>
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: '/(buyer)/products',
                    params: { organicOnly: 'true' },
                  })
                }
                style={styles.seeAllBtn}>
                <Text style={styles.seeAllText}>
                  {language === 'ta' ? 'அனைத்தும்' : 'See all'}
                </Text>
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={16}
                  color={colors.primary}
                />
              </Pressable>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalProductsList}>
              {dealsOfTheDay.map(renderProductItem)}
            </ScrollView>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  locationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F1F8E9',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#DCEDC8',
  },
  locationLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.xs + 2,
  },
  locationPinBg: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationTexts: {
    flex: 1,
  },
  locationHeadlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  locationCity: {
    fontSize: fontSizes.sm,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  radiusPill: {
    backgroundColor: colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  radiusPillText: {
    color: colors.white,
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  locationSub: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  locationChangeBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  locationChangeText: {
    fontSize: fontSizes.xs,
    fontWeight: '700',
    color: colors.primary,
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
  },
  searchBarWrapper: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm + 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm + 2,
    height: 46,
    ...shadows.soft,
  },
  searchIcon: {
    marginRight: spacing.xs,
  },
  searchInput: {
    flex: 1,
    fontSize: fontSizes.sm,
    color: colors.text,
    height: '100%',
  },
  categorySection: {
    marginTop: spacing.sm + 4,
  },
  categoryScroll: {
    paddingHorizontal: spacing.md,
    gap: spacing.xs + 2,
  },
  carouselContainer: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
  },
  bannerCard: {
    borderRadius: 14,
    padding: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 125,
    overflow: 'hidden',
  },
  bannerContent: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  bannerTagBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 6,
  },
  bannerTagText: {
    color: colors.white,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  bannerTitle: {
    color: colors.white,
    fontSize: fontSizes.md + 1,
    fontWeight: '800',
    lineHeight: 20,
    marginBottom: 4,
  },
  bannerSub: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: fontSizes.xs,
    lineHeight: 15,
  },
  bannerIconWrapper: {
    opacity: 0.8,
  },
  paginationDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    width: 20,
    backgroundColor: colors.primary,
  },
  dotInactive: {
    width: 6,
    backgroundColor: colors.border,
  },
  loaderArea: {
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  loaderText: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  sectionTitleBlock: {
    flex: 1,
  },
  sectionBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontSize: fontSizes.md + 1,
    fontWeight: '800',
    color: colors.text,
  },
  sectionSub: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 4,
  },
  seeAllText: {
    fontSize: fontSizes.xs,
    fontWeight: '700',
    color: colors.primary,
  },
  horizontalProductsList: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    gap: spacing.sm,
  },
  horizontalCardWrapper: {
    width: 220,
  },
});
