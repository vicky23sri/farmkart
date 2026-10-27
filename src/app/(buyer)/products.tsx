/**
 * Buyer Product Listing Screen
 * Displays 2-column product grid with comprehensive filters:
 * - Distance (10 km, 25 km, 50 km)
 * - Price ranges
 * - Rating (4.5+, 4.0+)
 * - Organic only toggle
 * - In-stock only toggle
 * - Sorting (Nearest, Price Low-High, Price High-Low, Rating)
 */

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { EmptyState } from '@/components/EmptyState';
import { ProductCard } from '@/components/ProductCard';
import { Product } from '@/data/products';
import { productService } from '@/services/productService';
import { useCartStore, useLanguageStore } from '@/store';
import { colors, fontSizes, spacing } from '@/theme';
import { getDistanceKm } from '@/utils/distance';
import { BUYER_LOCATION } from './(tabs)/index';

type SortOption = 'distance' | 'price_asc' | 'price_desc' | 'rating';

export default function BuyerProductListingScreen() {
  const params = useLocalSearchParams<{
    search?: string;
    category?: string;
    categoryTitle?: string;
    maxDistance?: string;
    sort?: string;
    organicOnly?: string;
  }>();

  const { language } = useLanguageStore();
  const { items, addItem, updateQuantity, getTotalCount } = useCartStore();

  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);

  // Filter States initialized directly from route params
  const [searchQuery, setSearchQuery] = useState(params.search || '');
  const [selectedCategory, setSelectedCategory] = useState<string>(
    params.category || 'all'
  );
  const [distanceFilter, setDistanceFilter] = useState<number | null>(
    params.maxDistance ? Number(params.maxDistance) : null
  );
  const [organicOnly, setOrganicOnly] = useState<boolean>(
    params.organicOnly === 'true'
  );
  const [inStockOnly, setInStockOnly] = useState<boolean>(false);
  const [priceRange, setPriceRange] = useState<'all' | 'under50' | 'under200' | 'under1000' | 'above1000'>('all');
  const [minRating, setMinRating] = useState<number | null>(null);

  // Sort State initialized from route params
  const [sortBy, setSortBy] = useState<SortOption>(
    (params.sort as SortOption) || 'distance'
  );

  // Modals for filters & sorting
  const [sortModalVisible, setSortModalVisible] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);

  const totalCartCount = getTotalCount();

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        const data = await productService.getProducts();
        if (isMounted) {
          setProducts(data);
        }
      } catch (err) {
        console.error('Failed to load products for listing:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  // Compute products with distance and applied filters
  const filteredProducts = useMemo(() => {
    let list = products.map((p) => ({
      ...p,
      distanceKm: getDistanceKm(BUYER_LOCATION.lat, BUYER_LOCATION.lng, p.lat, p.lng),
    }));

    // Category Filter
    if (selectedCategory && selectedCategory !== 'all') {
      if (selectedCategory === 'grains') {
        list = list.filter((p) => p.category === 'grains' || p.category === 'millets');
      } else {
        list = list.filter((p) => p.category === selectedCategory);
      }
    }

    // Search Query Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.nameTamil.toLowerCase().includes(q) ||
          p.sellerName.toLowerCase().includes(q) ||
          p.village.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q)
      );
    }

    // Distance Filter (10, 25, 50 km)
    if (distanceFilter !== null) {
      list = list.filter((p) => p.distanceKm <= distanceFilter);
    }

    // Organic Filter
    if (organicOnly) {
      list = list.filter((p) => p.isOrganic);
    }

    // In Stock Only Filter
    if (inStockOnly) {
      list = list.filter((p) => p.stock > 0);
    }

    // Price Range Filter
    if (priceRange === 'under50') {
      list = list.filter((p) => p.price <= 50);
    } else if (priceRange === 'under200') {
      list = list.filter((p) => p.price <= 200);
    } else if (priceRange === 'under1000') {
      list = list.filter((p) => p.price <= 1000);
    } else if (priceRange === 'above1000') {
      list = list.filter((p) => p.price > 1000);
    }

    // Rating Filter
    if (minRating !== null) {
      list = list.filter((p) => p.rating >= minRating);
    }

    // Sorting
    list.sort((a, b) => {
      if (sortBy === 'price_asc') return a.price - b.price;
      if (sortBy === 'price_desc') return b.price - a.price;
      if (sortBy === 'rating') return b.rating - a.rating;
      // Default: distance
      return a.distanceKm - b.distanceKm;
    });

    return list;
  }, [
    products,
    selectedCategory,
    searchQuery,
    distanceFilter,
    organicOnly,
    inStockOnly,
    priceRange,
    minRating,
    sortBy,
  ]);

  const activeFilterCount =
    (distanceFilter !== null ? 1 : 0) +
    (organicOnly ? 1 : 0) +
    (inStockOnly ? 1 : 0) +
    (priceRange !== 'all' ? 1 : 0) +
    (minRating !== null ? 1 : 0) +
    (selectedCategory !== 'all' ? 1 : 0);

  const resetAllFilters = () => {
    setSelectedCategory('all');
    setDistanceFilter(null);
    setOrganicOnly(false);
    setInStockOnly(false);
    setPriceRange('all');
    setMinRating(null);
    setSearchQuery('');
  };

  const getItemCartQty = (productId: string) => {
    const item = items.find((i) => i.id === productId);
    return item ? item.quantity : 0;
  };

  const getSortLabel = (sort: SortOption) => {
    switch (sort) {
      case 'distance':
        return language === 'ta' ? 'அருகாமை' : 'Nearest First';
      case 'price_asc':
        return language === 'ta' ? 'குறைந்த விலை' : 'Price: Low to High';
      case 'price_desc':
        return language === 'ta' ? 'அதிக விலை' : 'Price: High to Low';
      case 'rating':
        return language === 'ta' ? 'அதிக மதிப்பீடு' : 'Top Rated';
    }
  };

  return (
    <View style={styles.screen}>
      {/* AppHeader with Back button */}
      <AppHeader
        showBack={true}
        title={
          params.categoryTitle ||
          (selectedCategory !== 'all'
            ? selectedCategory.toUpperCase()
            : language === 'ta'
            ? 'விளைபொருட்கள்'
            : 'All Produce')
        }
        cartCount={totalCartCount}
        onSearchPress={() => {}}
        onCartPress={() => router.push('/(buyer)/(tabs)/cart')}
      />

      {/* Top Search & Filter Bar */}
      <View style={styles.topControlPanel}>
        {/* Search input field */}
        <View style={styles.searchBar}>
          <MaterialCommunityIcons
            name="magnify"
            size={20}
            color={colors.textSecondary}
          />
          <TextInput
            style={styles.searchInput}
            placeholder={
              language === 'ta'
                ? 'பொருட்கள் அல்லது விவசாயியைத் தேடுக...'
                : 'Search crop, village, or farmer...'
            }
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')} hitSlop={6}>
              <MaterialCommunityIcons
                name="close-circle"
                size={18}
                color={colors.textMuted}
              />
            </Pressable>
          )}
        </View>

        {/* Action Buttons: Sort & Advanced Filter */}
        <View style={styles.actionButtonsRow}>
          <Pressable
            style={styles.controlPill}
            onPress={() => setSortModalVisible(true)}>
            <MaterialCommunityIcons
              name="sort-variant"
              size={16}
              color={colors.primary}
            />
            <Text style={styles.controlPillText}>{getSortLabel(sortBy)}</Text>
            <MaterialCommunityIcons
              name="chevron-down"
              size={14}
              color={colors.textSecondary}
            />
          </Pressable>

          <Pressable
            style={[
              styles.controlPill,
              activeFilterCount > 0 && styles.controlPillActive,
            ]}
            onPress={() => setFilterModalVisible(true)}>
            <MaterialCommunityIcons
              name="tune-variant"
              size={16}
              color={activeFilterCount > 0 ? colors.white : colors.primary}
            />
            <Text
              style={[
                styles.controlPillText,
                activeFilterCount > 0 && styles.controlPillTextActive,
              ]}>
              {language === 'ta' ? 'வடிகட்டி' : 'Filters'}
              {activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
            </Text>
          </Pressable>
        </View>

        {/* Quick Distance & Toggle Filter Chips */}
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[
            {
              id: 'dist_all',
              label: language === 'ta' ? 'அனைத்து தூரம்' : 'Any Distance',
              active: distanceFilter === null,
              onPress: () => setDistanceFilter(null),
            },
            {
              id: 'dist_10',
              label: '≤ 10 km',
              active: distanceFilter === 10,
              onPress: () =>
                setDistanceFilter(distanceFilter === 10 ? null : 10),
            },
            {
              id: 'dist_25',
              label: '≤ 25 km',
              active: distanceFilter === 25,
              onPress: () =>
                setDistanceFilter(distanceFilter === 25 ? null : 25),
            },
            {
              id: 'dist_50',
              label: '≤ 50 km',
              active: distanceFilter === 50,
              onPress: () =>
                setDistanceFilter(distanceFilter === 50 ? null : 50),
            },
            {
              id: 'organic',
              label: language === 'ta' ? 'இயற்கை' : '🌱 Organic',
              active: organicOnly,
              onPress: () => setOrganicOnly(!organicOnly),
            },
            {
              id: 'instock',
              label: language === 'ta' ? 'இருப்பில்' : 'In Stock',
              active: inStockOnly,
              onPress: () => setInStockOnly(!inStockOnly),
            },
          ]}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.quickChipsList}
          renderItem={({ item }) => (
            <Pressable
              style={[
                styles.quickChip,
                item.active && styles.quickChipSelected,
              ]}
              onPress={item.onPress}>
              <Text
                style={[
                  styles.quickChipText,
                  item.active && styles.quickChipTextSelected,
                ]}>
                {item.label}
              </Text>
            </Pressable>
          )}
        />
      </View>

      {/* Results Header Count */}
      <View style={styles.resultsHeaderRow}>
        <Text style={styles.resultsCountText}>
          {language === 'ta'
            ? `${filteredProducts.length} விளைபொருட்கள் உள்ளன`
            : `Showing ${filteredProducts.length} farm items`}
        </Text>
        {activeFilterCount > 0 && (
          <Pressable onPress={resetAllFilters} hitSlop={6}>
            <Text style={styles.resetFiltersText}>
              {language === 'ta' ? 'வடிகட்டிகளை நீக்கு' : 'Reset Filters'}
            </Text>
          </Pressable>
        )}
      </View>

      {/* 2-Column Product Grid */}
      {loading ? (
        <View style={styles.loaderArea}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loaderText}>
            {language === 'ta' ? 'ஏற்றப்படுகிறது...' : 'Loading produce...'}
          </Text>
        </View>
      ) : filteredProducts.length === 0 ? (
        <EmptyState
          title={
            language === 'ta'
              ? 'விளைபொருட்கள் எதுவும் கிடைக்கவில்லை'
              : 'No matching produce found'
          }
          description={
            language === 'ta'
              ? 'நீங்கள் தேர்ந்தெடுத்த வடிகட்டிகளுக்கு ஏற்ப பொருட்கள் இல்லை. தயவுசெய்து தூரம் அல்லது விலையை மாற்றிப் பார்க்கவும்.'
              : 'Try relaxing your distance, category, or price filters to see more local farm harvests.'
          }
          icon="leaf-off"
          actionLabel={
            language === 'ta' ? 'வடிகட்டிகளை அழிக்க' : 'Clear All Filters'
          }
          onAction={resetAllFilters}
        />
      ) : (
        <FlatList
          data={filteredProducts}
          numColumns={2}
          keyExtractor={(item) => item.id}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const qty = getItemCartQty(item.id);
            return (
              <View style={styles.gridCardWrapper}>
                <ProductCard
                  name={item.name}
                  subtitle={item.nameTamil}
                  farmerName={`${item.sellerName} • ${item.village}`}
                  distanceKm={item.distanceKm}
                  price={item.price}
                  unit={item.unit}
                  rating={item.rating}
                  imageUri={item.images[0]}
                  quantity={qty}
                  onAdd={() => addItem(item, 1)}
                  onQuantityChange={(newQty) => updateQuantity(item.id, newQty)}
                  onPress={() =>
                    router.push({
                      pathname: '/(buyer)/product-detail',
                      params: { id: item.id },
                    })
                  }
                />
              </View>
            );
          }}
        />
      )}

      {/* Sort Options Modal */}
      <Modal
        visible={sortModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSortModalVisible(false)}>
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setSortModalVisible(false)}>
          <View style={styles.modalSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.modalTitle}>
              {language === 'ta' ? 'வரிசைப்படுத்துக' : 'Sort Products'}
            </Text>

            {(
              [
                { id: 'distance', label: language === 'ta' ? 'அருகாமை (குறைந்த தூரம்)' : 'Distance: Nearest to Buyer' },
                { id: 'price_asc', label: language === 'ta' ? 'விலை: குறைவாக இருந்து அதிகமாக' : 'Price: Low to High' },
                { id: 'price_desc', label: language === 'ta' ? 'விலை: அதிகமாக இருந்து குறைவாக' : 'Price: High to Low' },
                { id: 'rating', label: language === 'ta' ? 'வாடிக்கையாளர் மதிப்பீடு' : 'Customer Rating: Highest First' },
              ] as const
            ).map((opt) => (
              <Pressable
                key={opt.id}
                style={[
                  styles.sortOptionRow,
                  sortBy === opt.id && styles.sortOptionSelected,
                ]}
                onPress={() => {
                  setSortBy(opt.id);
                  setSortModalVisible(false);
                }}>
                <Text
                  style={[
                    styles.sortOptionText,
                    sortBy === opt.id && styles.sortOptionTextSelected,
                  ]}>
                  {opt.label}
                </Text>
                {sortBy === opt.id && (
                  <MaterialCommunityIcons
                    name="check"
                    size={20}
                    color={colors.primary}
                  />
                )}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* Filter Bottom Sheet Modal */}
      <Modal
        visible={filterModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setFilterModalVisible(false)}>
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setFilterModalVisible(false)}>
          <View style={styles.modalSheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.filterModalHeader}>
              <Text style={styles.modalTitle}>
                {language === 'ta' ? 'வடிகட்டிகள்' : 'Filter Products'}
              </Text>
              <Pressable onPress={resetAllFilters}>
                <Text style={styles.resetFiltersText}>
                  {language === 'ta' ? 'மீட்டமை' : 'Reset All'}
                </Text>
              </Pressable>
            </View>

            {/* Distance Section */}
            <Text style={styles.filterSectionTitle}>
              {language === 'ta' ? 'அதிகபட்ச தூரம்' : 'Max Farm Distance'}
            </Text>
            <View style={styles.filterPillsRow}>
              {[
                { val: null, label: 'Any' },
                { val: 10, label: '10 km' },
                { val: 25, label: '25 km' },
                { val: 50, label: '50 km' },
              ].map((d) => (
                <Pressable
                  key={String(d.val)}
                  style={[
                    styles.filterChoicePill,
                    distanceFilter === d.val && styles.filterChoicePillActive,
                  ]}
                  onPress={() => setDistanceFilter(d.val)}>
                  <Text
                    style={[
                      styles.filterChoiceText,
                      distanceFilter === d.val && styles.filterChoiceTextActive,
                    ]}>
                    {d.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Price Range Section */}
            <Text style={styles.filterSectionTitle}>
              {language === 'ta' ? 'விலை வரம்பு' : 'Price Range'}
            </Text>
            <View style={styles.filterPillsRow}>
              {[
                { id: 'all', label: 'All' },
                { id: 'under50', label: '≤ ₹50' },
                { id: 'under200', label: '≤ ₹200' },
                { id: 'under1000', label: '≤ ₹1000' },
                { id: 'above1000', label: '₹1000+' },
              ].map((p) => (
                <Pressable
                  key={p.id}
                  style={[
                    styles.filterChoicePill,
                    priceRange === p.id && styles.filterChoicePillActive,
                  ]}
                  onPress={() => setPriceRange(p.id as any)}>
                  <Text
                    style={[
                      styles.filterChoiceText,
                      priceRange === p.id && styles.filterChoiceTextActive,
                    ]}>
                    {p.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Rating Filter Section */}
            <Text style={styles.filterSectionTitle}>
              {language === 'ta' ? 'மதிப்பீடு' : 'Minimum Rating'}
            </Text>
            <View style={styles.filterPillsRow}>
              {[
                { val: null, label: 'All' },
                { val: 4.5, label: '4.5+ ★' },
                { val: 4.8, label: '4.8+ ★' },
              ].map((r) => (
                <Pressable
                  key={String(r.val)}
                  style={[
                    styles.filterChoicePill,
                    minRating === r.val && styles.filterChoicePillActive,
                  ]}
                  onPress={() => setMinRating(r.val)}>
                  <Text
                    style={[
                      styles.filterChoiceText,
                      minRating === r.val && styles.filterChoiceTextActive,
                    ]}>
                    {r.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Toggles */}
            <View style={styles.toggleRow}>
              <Pressable
                style={[
                  styles.filterChoicePill,
                  organicOnly && styles.filterChoicePillActive,
                ]}
                onPress={() => setOrganicOnly(!organicOnly)}>
                <Text
                  style={[
                    styles.filterChoiceText,
                    organicOnly && styles.filterChoiceTextActive,
                  ]}>
                  🌱 100% Organic Only
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.filterChoicePill,
                  inStockOnly && styles.filterChoicePillActive,
                ]}
                onPress={() => setInStockOnly(!inStockOnly)}>
                <Text
                  style={[
                    styles.filterChoiceText,
                    inStockOnly && styles.filterChoiceTextActive,
                  ]}>
                  ✓ In Stock Only
                </Text>
              </Pressable>
            </View>

            {/* Apply Button */}
            <Pressable
              style={styles.applyFilterBtn}
              onPress={() => setFilterModalVisible(false)}>
              <Text style={styles.applyFilterBtnText}>
                {language === 'ta'
                  ? `பயன்படுத்து (${filteredProducts.length} முடிவுகள்)`
                  : `Apply Filters (${filteredProducts.length} items)`}
              </Text>
            </Pressable>
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
  topControlPanel: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.xs + 2,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    height: 40,
  },
  searchInput: {
    flex: 1,
    marginLeft: spacing.xs,
    fontSize: fontSizes.sm,
    color: colors.text,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  controlPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 4,
  },
  controlPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  controlPillText: {
    fontSize: fontSizes.xs,
    fontWeight: '700',
    color: colors.text,
  },
  controlPillTextActive: {
    color: colors.white,
  },
  quickChipsList: {
    gap: spacing.xs,
    paddingTop: 4,
  },
  quickChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  quickChipSelected: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  quickChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  quickChipTextSelected: {
    color: colors.primaryDark,
    fontWeight: '700',
  },
  resultsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  resultsCountText: {
    fontSize: fontSizes.xs + 1,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  resetFiltersText: {
    fontSize: fontSizes.xs,
    fontWeight: '700',
    color: colors.accent,
  },
  loaderArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  loaderText: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
  },
  listContainer: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xxl,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    marginBottom: spacing.sm + 2,
  },
  gridCardWrapper: {
    width: '48.5%',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
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
  filterModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sortOptionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  sortOptionSelected: {
    backgroundColor: colors.primaryLight,
  },
  sortOptionText: {
    fontSize: fontSizes.sm,
    color: colors.text,
    fontWeight: '600',
  },
  sortOptionTextSelected: {
    color: colors.primaryDark,
    fontWeight: '800',
  },
  filterSectionTitle: {
    fontSize: fontSizes.xs + 1,
    fontWeight: '800',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    marginTop: spacing.xs,
  },
  filterPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  filterChoicePill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  filterChoicePillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChoiceText: {
    fontSize: fontSizes.xs,
    fontWeight: '700',
    color: colors.text,
  },
  filterChoiceTextActive: {
    color: colors.white,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  applyFilterBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  applyFilterBtnText: {
    color: colors.white,
    fontSize: fontSizes.sm,
    fontWeight: '800',
  },
});
