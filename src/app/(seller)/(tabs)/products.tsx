/**
 * Seller Products Screen
 * Inventory management for crops listed by the farmer:
 * - Edit crop price, minimum order, and details
 * - Instant stock update modal (+10, +50, +100 or manual amount)
 * - Active / Inactive switch to pause/unpause visibility
 * - Features the signature dark green header with "Seller Mode" pill.
 */

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { Card } from '@/components/Card';
import { PrimaryButton } from '@/components/PrimaryButton';
import {
  SellerProduct,
  useLanguageStore,
  useSellerProductStore,
} from '@/store';
import { colors, fontSizes, shadows, spacing } from '@/theme';

type ProductFilterTab = 'all' | 'active' | 'low_stock' | 'paused';

export default function SellerProductsScreen() {
  const { language } = useLanguageStore();
  const {
    products,
    toggleActive,
    updateStock,
    updateProduct,
    deleteProduct,
  } = useSellerProductStore();

  const [activeTab, setActiveTab] = useState<ProductFilterTab>('all');

  // Stock Update Modal State
  const [stockModalProduct, setStockModalProduct] = useState<SellerProduct | null>(null);
  const [newStockInput, setNewStockInput] = useState('');

  // Edit Crop Modal State
  const [editModalProduct, setEditModalProduct] = useState<SellerProduct | null>(null);
  const [editPrice, setEditPrice] = useState('');
  const [editMinOrder, setEditMinOrder] = useState('');
  const [editHarvestDate, setEditHarvestDate] = useState('');

  // Filtered crops
  const filteredProducts = useMemo(() => {
    switch (activeTab) {
      case 'active':
        return products.filter((p) => p.isActive);
      case 'low_stock':
        return products.filter((p) => p.isActive && p.stock <= 15);
      case 'paused':
        return products.filter((p) => !p.isActive);
      default:
        return products;
    }
  }, [products, activeTab]);

  // Open Stock Modal
  const openStockModal = (product: SellerProduct) => {
    setStockModalProduct(product);
    setNewStockInput(product.stock.toString());
  };

  // Submit Stock Update
  const handleSaveStock = () => {
    if (!stockModalProduct) return;
    const stockNum = Number(newStockInput);
    if (isNaN(stockNum) || stockNum < 0) {
      Alert.alert('Invalid Stock', 'Please enter a valid stock quantity.');
      return;
    }

    updateStock(stockModalProduct.id, stockNum);
    setStockModalProduct(null);

    Alert.alert(
      language === 'ta' ? 'கையிருப்பு மாற்றப்பட்டது' : 'Stock Updated',
      `${stockModalProduct.name} stock updated to ${stockNum} ${stockModalProduct.unit}.`
    );
  };

  // Open Edit Modal
  const openEditModal = (product: SellerProduct) => {
    setEditModalProduct(product);
    setEditPrice(product.price.toString());
    setEditMinOrder(product.minOrder.toString());
    setEditHarvestDate(product.harvestDate);
  };

  // Save Edit Changes
  const handleSaveEdit = () => {
    if (!editModalProduct) return;
    const priceNum = Number(editPrice);
    const minOrderNum = Number(editMinOrder);

    if (isNaN(priceNum) || priceNum <= 0) {
      Alert.alert('Invalid Price', 'Please enter a valid price.');
      return;
    }

    updateProduct(editModalProduct.id, {
      price: priceNum,
      minOrder: isNaN(minOrderNum) || minOrderNum <= 0 ? 1 : minOrderNum,
      harvestDate: editHarvestDate.trim() || editModalProduct.harvestDate,
    });

    setEditModalProduct(null);

    Alert.alert(
      language === 'ta' ? 'மாற்றங்கள் சேமிக்கப்பட்டன' : 'Listing Updated',
      `${editModalProduct.name} price and terms updated successfully.`
    );
  };

  // Delete Confirmation
  const handleDelete = (product: SellerProduct) => {
    Alert.alert(
      language === 'ta' ? 'பயிரை நீக்கவா?' : 'Delete Listing?',
      language === 'ta'
        ? `${product.name} பட்டியலை நிச்சயமாக நீக்க விரும்புகிறீர்களா?`
        : `Are you sure you want to remove ${product.name} from your listings?`,
      [
        { text: language === 'ta' ? 'ரத்து' : 'Cancel', style: 'cancel' },
        {
          text: language === 'ta' ? 'நீக்கு' : 'Delete',
          style: 'destructive',
          onPress: () => deleteProduct(product.id),
        },
      ]
    );
  };

  return (
    <View style={styles.screen}>
      {/* Signature Dark Green Header with Seller Mode Pill */}
      <AppHeader
        isSeller={true}
        title={language === 'ta' ? 'என் விளைபொருட்கள்' : 'My Harvest Listings'}
        showSearch={false}
        showCart={false}
      />

      {/* Tabs Filter Bar */}
      <View style={styles.tabsBar}>
        {[
          { id: 'all' as const, label: 'All', count: products.length },
          {
            id: 'active' as const,
            label: 'Active',
            count: products.filter((p) => p.isActive).length,
          },
          {
            id: 'low_stock' as const,
            label: 'Low Stock',
            count: products.filter((p) => p.isActive && p.stock <= 15).length,
          },
          {
            id: 'paused' as const,
            label: 'Paused',
            count: products.filter((p) => !p.isActive).length,
          },
        ].map((tab) => {
          const isSelected = activeTab === tab.id;
          return (
            <Pressable
              key={tab.id}
              onPress={() => setActiveTab(tab.id)}
              style={[styles.tabBtn, isSelected && styles.tabBtnActive]}>
              <Text
                style={[styles.tabBtnText, isSelected && styles.tabBtnTextActive]}>
                {tab.label}
              </Text>
              <View
                style={[
                  styles.tabCountBadge,
                  isSelected && styles.tabCountBadgeActive,
                ]}>
                <Text
                  style={[
                    styles.tabCountText,
                    isSelected && styles.tabCountTextActive,
                  ]}>
                  {tab.count}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* Top Header Summary & Add CTA */}
        <View style={styles.summaryBar}>
          <View>
            <Text style={styles.summaryTitle}>
              {language === 'ta' ? 'பண்ணை சரக்கிருப்பு' : 'Farm Crop Inventory'}
            </Text>
            <Text style={styles.summarySubtitle}>
              {products.filter((p) => p.isActive).length} active harvests visible to
              buyers within 50 km
            </Text>
          </View>

          <Pressable
            style={styles.addBtn}
            onPress={() => router.push('/(seller)/add-product')}>
            <MaterialCommunityIcons name="plus" size={18} color={colors.white} />
            <Text style={styles.addBtnText}>
              {language === 'ta' ? 'புதிய பயிர்' : 'Add Crop'}
            </Text>
          </Pressable>
        </View>

        {/* Listings List */}
        {filteredProducts.length === 0 ? (
          <Card style={styles.emptyCard}>
            <MaterialCommunityIcons
              name="sprout-outline"
              size={48}
              color={colors.primary}
            />
            <Text style={styles.emptyTitle}>No Crops in this category</Text>
            <Text style={styles.emptySubtitle}>
              Publish a new harvest listing to start receiving orders.
            </Text>
            <PrimaryButton
              title="Add New Harvest"
              icon="plus"
              onPress={() => router.push('/(seller)/add-product')}
              style={{ marginTop: spacing.sm }}
            />
          </Card>
        ) : (
          filteredProducts.map((crop) => {
            const isLowStock = crop.isActive && crop.stock <= 15;
            const thumbUri = crop.photos[0];

            return (
              <Card key={crop.id} style={styles.cropCard}>
                {/* Header Row: Thumbnail, Name, Active Switch */}
                <View style={styles.cropHeaderRow}>
                  {thumbUri ? (
                    <Image source={{ uri: thumbUri }} style={styles.cropThumb} resizeMode="cover" />
                  ) : (
                    <View style={styles.cropThumbPlaceholder}>
                      <MaterialCommunityIcons name="sprout" size={24} color={colors.primaryDark} />
                    </View>
                  )}

                  <View style={styles.cropMainInfoCol}>
                    <View style={styles.titleBadgeRow}>
                      <Text style={styles.cropTitle} numberOfLines={1}>
                        {crop.name}
                      </Text>
                      {crop.isOrganic && (
                        <View style={styles.organicTag}>
                          <Text style={styles.organicTagText}>100% Organic</Text>
                        </View>
                      )}
                    </View>

                    <Text style={styles.cropCategoryText}>
                      {crop.categoryLabel} • {crop.harvestDate}
                    </Text>

                    <Text style={styles.cropPriceText}>
                      ₹{crop.price.toLocaleString('en-IN')}{' '}
                      <Text style={styles.cropPriceUnit}>/ {crop.unit}</Text>
                    </Text>
                  </View>

                  {/* Active / Inactive Switch */}
                  <View style={styles.switchCol}>
                    <Switch
                      value={crop.isActive}
                      onValueChange={() => toggleActive(crop.id)}
                      trackColor={{ false: '#E0E0E0', true: colors.primaryLight }}
                      thumbColor={crop.isActive ? colors.primaryDark : '#BDBDBD'}
                    />
                    <Text
                      style={[
                        styles.switchLabel,
                        crop.isActive ? styles.switchLabelActive : styles.switchLabelPaused,
                      ]}>
                      {crop.isActive ? 'Active' : 'Paused'}
                    </Text>
                  </View>
                </View>

                {/* Stock & Parameters Row */}
                <View style={styles.stockStatusRow}>
                  <View style={styles.stockPill}>
                    <MaterialCommunityIcons
                      name="scale"
                      size={14}
                      color={isLowStock ? '#D32F2F' : colors.primaryDark}
                    />
                    <Text
                      style={[
                        styles.stockPillText,
                        isLowStock && styles.stockPillTextLow,
                      ]}>
                      Stock: {crop.stock} {crop.unit}
                    </Text>
                    {isLowStock && (
                      <View style={styles.lowStockWarningPill}>
                        <Text style={styles.lowStockWarningText}>LOW</Text>
                      </View>
                    )}
                  </View>

                  <Text style={styles.minOrderTag}>
                    Min order: {crop.minOrder} {crop.unit}
                  </Text>

                  <Text style={styles.radiusTag}>
                    Max: {crop.deliveryRadiusKm} km
                  </Text>
                </View>

                {/* Special Category Badges (Manure Composting Age / Moisture / Variety) */}
                {(crop.compostingAge || crop.moisture || crop.variety) && (
                  <View style={styles.extraAttributesRow}>
                    {crop.compostingAge && (
                      <View style={styles.extraAttrTag}>
                        <MaterialCommunityIcons name="shovel" size={11} color="#5D4037" />
                        <Text style={styles.extraAttrText}>{crop.compostingAge}</Text>
                      </View>
                    )}
                    {crop.moisture && (
                      <View style={styles.extraAttrTag}>
                        <MaterialCommunityIcons name="water-percent" size={11} color="#1565C0" />
                        <Text style={styles.extraAttrText}>Moisture: {crop.moisture}</Text>
                      </View>
                    )}
                    {crop.variety && (
                      <View style={styles.extraAttrTag}>
                        <MaterialCommunityIcons name="grain" size={11} color={colors.primaryDark} />
                        <Text style={styles.extraAttrText}>Variety: {crop.variety}</Text>
                      </View>
                    )}
                  </View>
                )}

                <View style={styles.divider} />

                {/* Bottom Action Controls: Stock Update, Edit, Delete */}
                <View style={styles.cropActionsRow}>
                  {/* Stock Update Button */}
                  <Pressable
                    style={styles.actionBtnStock}
                    onPress={() => openStockModal(crop)}>
                    <MaterialCommunityIcons
                      name="plus-minus-box"
                      size={16}
                      color={colors.primaryDark}
                    />
                    <Text style={styles.actionBtnStockText}>Update Stock</Text>
                  </Pressable>

                  {/* Edit Details Button */}
                  <Pressable
                    style={styles.actionBtnEdit}
                    onPress={() => openEditModal(crop)}>
                    <MaterialCommunityIcons
                      name="pencil-outline"
                      size={16}
                      color={colors.textSecondary}
                    />
                    <Text style={styles.actionBtnEditText}>Edit</Text>
                  </Pressable>

                  {/* Delete Button */}
                  <Pressable
                    style={styles.actionBtnDelete}
                    onPress={() => handleDelete(crop)}
                    hitSlop={8}>
                    <MaterialCommunityIcons
                      name="trash-can-outline"
                      size={18}
                      color={colors.textMuted}
                    />
                  </Pressable>
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>

      {/* Stock Update Modal */}
      <Modal
        visible={!!stockModalProduct}
        transparent
        animationType="fade"
        onRequestClose={() => setStockModalProduct(null)}>
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setStockModalProduct(null)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>
              Update Stock: {stockModalProduct?.name}
            </Text>
            <Text style={styles.modalSubtitle}>
              Current Available Quantity: {stockModalProduct?.stock}{' '}
              {stockModalProduct?.unit}
            </Text>

            {/* Quick Increment Buttons */}
            <View style={styles.quickIncrementRow}>
              {[10, 50, 100].map((inc) => (
                <Pressable
                  key={inc}
                  style={styles.quickIncBtn}
                  onPress={() => {
                    const current = Number(newStockInput) || 0;
                    setNewStockInput((current + inc).toString());
                  }}>
                  <Text style={styles.quickIncText}>+{inc}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.inputLabel}>
              New Total Stock ({stockModalProduct?.unit}):
            </Text>
            <TextInput
              style={styles.stockModalInput}
              keyboardType="numeric"
              value={newStockInput}
              onChangeText={setNewStockInput}
              placeholder="Enter stock quantity"
            />

            <View style={styles.modalActionsRow}>
              <Pressable
                style={styles.modalCancelBtn}
                onPress={() => setStockModalProduct(null)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalSaveBtn} onPress={handleSaveStock}>
                <Text style={styles.modalSaveText}>Save Stock</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Edit Crop Modal */}
      <Modal
        visible={!!editModalProduct}
        transparent
        animationType="slide"
        onRequestClose={() => setEditModalProduct(null)}>
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setEditModalProduct(null)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Edit: {editModalProduct?.name}</Text>
            <Text style={styles.modalSubtitle}>
              Unit: {editModalProduct?.unit} • Category: {editModalProduct?.categoryLabel}
            </Text>

            <Text style={styles.inputLabel}>
              Price (₹ per {editModalProduct?.unit}):
            </Text>
            <TextInput
              style={styles.stockModalInput}
              keyboardType="numeric"
              value={editPrice}
              onChangeText={setEditPrice}
              placeholder="Price in ₹"
            />

            <Text style={styles.inputLabel}>
              Minimum Order Quantity ({editModalProduct?.unit}):
            </Text>
            <TextInput
              style={styles.stockModalInput}
              keyboardType="numeric"
              value={editMinOrder}
              onChangeText={setEditMinOrder}
              placeholder="Minimum Order"
            />

            <Text style={styles.inputLabel}>Harvest / Packaging Date:</Text>
            <TextInput
              style={styles.stockModalInput}
              value={editHarvestDate}
              onChangeText={setEditHarvestDate}
              placeholder="e.g. Fresh Daily / Oct 26"
            />

            <View style={styles.modalActionsRow}>
              <Pressable
                style={styles.modalCancelBtn}
                onPress={() => setEditModalProduct(null)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalSaveBtn} onPress={handleSaveEdit}>
                <Text style={styles.modalSaveText}>Update Listing</Text>
              </Pressable>
            </View>
          </Pressable>
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
  tabsBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    justifyContent: 'space-between',
  },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
    gap: 4,
  },
  tabBtnActive: {
    backgroundColor: colors.primaryLight,
  },
  tabBtnText: {
    fontSize: fontSizes.xs,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  tabBtnTextActive: {
    fontWeight: '800',
    color: colors.primaryDark,
  },
  tabCountBadge: {
    backgroundColor: colors.surfaceSecondary,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  tabCountBadgeActive: {
    backgroundColor: colors.primaryDark,
  },
  tabCountText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  tabCountTextActive: {
    color: colors.white,
  },
  scrollContent: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xxl + 40,
  },
  summaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryTitle: {
    fontSize: fontSizes.md + 1,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  summarySubtitle: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 4,
    ...shadows.soft,
  },
  addBtnText: {
    color: colors.white,
    fontSize: fontSizes.xs + 1,
    fontWeight: '800',
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: 8,
  },
  emptyTitle: {
    fontSize: fontSizes.md,
    fontWeight: '800',
    color: colors.text,
  },
  emptySubtitle: {
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 240,
  },
  cropCard: {
    gap: spacing.xs + 2,
  },
  cropHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  cropThumb: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  cropThumbPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cropMainInfoCol: {
    flex: 1,
  },
  titleBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  cropTitle: {
    fontSize: fontSizes.sm + 1,
    fontWeight: '800',
    color: colors.text,
    flex: 1,
  },
  organicTag: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: colors.primary,
  },
  organicTagText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  cropCategoryText: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  cropPriceText: {
    fontSize: fontSizes.sm + 1,
    fontWeight: '900',
    color: colors.primaryDark,
    marginTop: 3,
  },
  cropPriceUnit: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  switchCol: {
    alignItems: 'center',
    gap: 2,
  },
  switchLabel: {
    fontSize: 10,
    fontWeight: '700',
  },
  switchLabelActive: {
    color: colors.primaryDark,
  },
  switchLabelPaused: {
    color: colors.textMuted,
  },
  stockStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 2,
  },
  stockPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F8E9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  stockPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  stockPillTextLow: {
    color: '#D32F2F',
  },
  lowStockWarningPill: {
    backgroundColor: '#D32F2F',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  lowStockWarningText: {
    fontSize: 8,
    fontWeight: '900',
    color: colors.white,
  },
  minOrderTag: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  radiusTag: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  extraAttributesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  extraAttrTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 4,
  },
  extraAttrText: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 4,
  },
  cropActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  actionBtnStock: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
  },
  actionBtnStockText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  actionBtnEdit: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
  },
  actionBtnEditText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  actionBtnDelete: {
    padding: 6,
    marginLeft: 'auto',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  modalCard: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadows.medium,
  },
  modalTitle: {
    fontSize: fontSizes.md,
    fontWeight: '800',
    color: colors.text,
  },
  modalSubtitle: {
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
  },
  quickIncrementRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: 4,
  },
  quickIncBtn: {
    flex: 1,
    backgroundColor: colors.primaryLight,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  quickIncText: {
    fontSize: fontSizes.xs + 1,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  inputLabel: {
    fontSize: fontSizes.xs,
    fontWeight: '700',
    color: colors.textSecondary,
    marginTop: 6,
  },
  stockModalInput: {
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: fontSizes.sm,
    color: colors.text,
  },
  modalActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  modalCancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  modalCancelText: {
    fontSize: fontSizes.sm,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  modalSaveBtn: {
    backgroundColor: colors.primaryDark,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  modalSaveText: {
    fontSize: fontSizes.sm,
    fontWeight: '800',
    color: colors.white,
  },
});
