/**
 * Seller Add Product Screen
 * Form for farmers to list new harvest produce with comprehensive agricultural parameters:
 * - Up to 5 photos via expo-image-picker (Camera / Gallery)
 * - Name in English & Tamil
 * - Agricultural Categories (including Organic Manure, Fodder, Grains and Millets)
 * - Flexible Units (kg, quintal, ton, bundle, bag, tractor load, truck load)
 * - Price, Quantity, Minimum Order Quantity
 * - Harvest Date selector
 * - Organic toggle (TNOCD certified)
 * - Composting Age (for Organic Manure)
 * - Moisture % (for Fodder / Straw / Grains)
 * - Variety selector (Paddy / Ragi / Millets)
 * - Vehicle Type (Two-Wheeler, Auto, Mini Truck, Tractor, Heavy Truck)
 * - Delivery Radius Slider strictly capped at 50 km
 * Features dark green header with "Seller Mode" pill.
 */

import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import React, { useState } from 'react';
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
  SellerCropCategory,
  SellerCropUnit,
  useLanguageStore,
  useSellerProductStore,
} from '@/store';
import { colors, fontSizes, spacing } from '@/theme';

interface CategoryOption {
  id: SellerCropCategory;
  labelEn: string;
  labelTa: string;
  icon: string;
}

const CATEGORY_OPTIONS: CategoryOption[] = [
  {
    id: 'organic_manure',
    labelEn: 'Organic Manure',
    labelTa: 'இயற்கை எரு / உரம்',
    icon: 'shovel',
  },
  {
    id: 'fodder',
    labelEn: 'Fodder & Straw',
    labelTa: 'தீவனப்புல் / வைக்கோல்',
    icon: 'grass',
  },
  {
    id: 'grains_millets',
    labelEn: 'Grains & Millets',
    labelTa: 'தானியங்கள் & சிறுதானியம்',
    icon: 'grain',
  },
  {
    id: 'vegetables',
    labelEn: 'Vegetables',
    labelTa: 'காய்கறிகள்',
    icon: 'carrot',
  },
  {
    id: 'fruits',
    labelEn: 'Fruits',
    labelTa: 'பழங்கள்',
    icon: 'food-apple',
  },
  {
    id: 'pulses',
    labelEn: 'Pulses & Dal',
    labelTa: 'பருப்பு வகைகள்',
    icon: 'seed',
  },
];

const UNIT_OPTIONS: { id: SellerCropUnit; labelEn: string; labelTa: string }[] = [
  { id: 'kg', labelEn: 'Kilogram (kg)', labelTa: 'கிலோ (kg)' },
  { id: 'quintal', labelEn: 'Quintal (100 kg)', labelTa: 'குவிண்டால்' },
  { id: 'ton', labelEn: 'Metric Ton', labelTa: 'டன்' },
  { id: 'bundle', labelEn: 'Bundle (கட்டு)', labelTa: 'கட்டு' },
  { id: 'bag', labelEn: 'Bag / Sack (பை)', labelTa: 'சாக்குப்பை' },
  { id: 'tractor load', labelEn: 'Tractor Load', labelTa: 'டிராக்டர் லோடு' },
  { id: 'truck load', labelEn: 'Truck Load', labelTa: 'லாரி லோடு' },
];

const VEHICLE_OPTIONS = [
  { id: 'two_wheeler', labelEn: 'Two-Wheeler (Bike)', icon: 'motorbike' },
  { id: 'auto_rickshaw', labelEn: 'Auto / 3-Wheeler', icon: 'rickshaw' },
  { id: 'mini_truck', labelEn: 'Mini Truck (Tata Ace)', icon: 'truck-flatbed' },
  { id: 'tractor', labelEn: 'Tractor Trolley', icon: 'tractor' },
  { id: 'heavy_truck', labelEn: 'Heavy Truck / Lorry', icon: 'truck' },
];

const RADIUS_STEPS = [10, 20, 30, 40, 50];

export default function AddProductScreen() {
  const { language } = useLanguageStore();
  const { addProduct } = useSellerProductStore();

  // Core product states
  const [photos, setPhotos] = useState<string[]>([]);
  const [isPhotoPickerOpen, setIsPhotoPickerOpen] = useState(false);
  const [cropName, setCropName] = useState('');
  const [tamilName, setTamilName] = useState('');
  const [category, setCategory] = useState<SellerCropCategory>('organic_manure');
  const [unit, setUnit] = useState<SellerCropUnit>('tractor load');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [minOrder, setMinOrder] = useState('1');
  const [harvestDate, setHarvestDate] = useState('Harvested Today (Fresh)');
  const [isOrganic, setIsOrganic] = useState(true);

  // Category-specific fields
  const [compostingAge, setCompostingAge] = useState('9 Months Well-Cured & Aerated');
  const [moisture, setMoisture] = useState('11% (Mandi Storage Grade)');
  const [variety, setVariety] = useState('Seeraga Samba Traditional');

  // Logistics fields
  const [vehicleType, setVehicleType] = useState('tractor');
  const [deliveryRadiusKm, setDeliveryRadiusKm] = useState(30);

  const [loading, setLoading] = useState(false);

  // Photo handlers with expo-image-picker
  const handleTakePhoto = async () => {
    setIsPhotoPickerOpen(false);
    if (photos.length >= 5) {
      Alert.alert('Maximum Reached', 'You can upload up to 5 photos.');
      return;
    }

    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Required', 'Camera permission is required.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setPhotos((prev) => [...prev, result.assets[0].uri].slice(0, 5));
      }
    } catch {
      Alert.alert('Error', 'Could not open camera.');
    }
  };

  const handlePickFromGallery = async () => {
    setIsPhotoPickerOpen(false);
    if (photos.length >= 5) {
      Alert.alert('Maximum Reached', 'You can upload up to 5 photos.');
      return;
    }

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Required', 'Photo library permission is required.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
        allowsMultipleSelection: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const uris = result.assets.map((a) => a.uri);
        setPhotos((prev) => [...prev, ...uris].slice(0, 5));
      }
    } catch {
      Alert.alert('Error', 'Could not open gallery.');
    }
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Submit listing
  const handleSubmit = () => {
    if (!cropName.trim()) {
      Alert.alert('Crop Name Required', 'Please enter crop name in English or Tamil.');
      return;
    }
    if (!price.trim() || isNaN(Number(price))) {
      Alert.alert('Valid Price Required', 'Please enter a valid price per unit.');
      return;
    }
    if (!quantity.trim() || isNaN(Number(quantity))) {
      Alert.alert('Available Quantity Required', 'Please enter available harvest quantity.');
      return;
    }

    setLoading(true);

    const categoryObj = CATEGORY_OPTIONS.find((c) => c.id === category);

    // Default farm photo if farmer didn't upload
    const finalPhotos =
      photos.length > 0
        ? photos
        : category === 'organic_manure'
        ? ['https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=600']
        : category === 'fodder'
        ? ['https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=600']
        : category === 'grains_millets'
        ? ['https://images.unsplash.com/photo-1586201375761-83865001e31c?w=600']
        : ['https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=600'];

    setTimeout(() => {
      addProduct({
        name: cropName.trim(),
        nameTamil: tamilName.trim() || cropName.trim(),
        category,
        categoryLabel: categoryObj?.labelEn || 'Farm Harvest',
        price: Number(price),
        unit,
        stock: Number(quantity),
        minOrder: Number(minOrder) || 1,
        harvestDate: harvestDate.trim() || 'Today',
        isOrganic,
        isActive: true,
        photos: finalPhotos,
        vehicleType,
        deliveryRadiusKm: Math.min(50, deliveryRadiusKm),
        compostingAge: category === 'organic_manure' ? compostingAge : undefined,
        moisture:
          category === 'fodder' || category === 'grains_millets' ? moisture : undefined,
        variety: category === 'grains_millets' ? variety : undefined,
      });

      setLoading(false);

      Alert.alert(
        language === 'ta' ? 'பட்டியலிடப்பட்டது!' : 'Harvest Published!',
        language === 'ta'
          ? `${cropName} உங்கள் பண்ணை சந்தையில் நேரடியாக பட்டியலிடப்பட்டது.`
          : `${cropName} is now live and discoverable by local buyers within ${deliveryRadiusKm} km!`,
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    }, 600);
  };

  return (
    <View style={styles.screen}>
      {/* Signature Dark Green Header with Seller Mode Pill and Back button */}
      <AppHeader
        isSeller={true}
        showBack={true}
        title={language === 'ta' ? 'புதிய பயிர் சேர்க்க' : 'Add New Harvest'}
        showSearch={false}
        showCart={false}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        {/* 1. Photo Upload Section (Up to 5 photos) */}
        <Card style={styles.sectionCard}>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.sectionHeading}>
                {language === 'ta' ? 'பண்ணை புகைப்படங்கள்' : 'Harvest Photos'}
              </Text>
              <Text style={styles.sectionSubtitle}>
                Add up to 5 real photos of crop or manure loading
              </Text>
            </View>
            <View style={styles.photoCountBadge}>
              <Text style={styles.photoCountText}>{photos.length} / 5</Text>
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photosScroll}>
            {/* Add Photo Button */}
            {photos.length < 5 && (
              <Pressable
                onPress={() => setIsPhotoPickerOpen(true)}
                style={styles.addPhotoBtn}>
                <MaterialCommunityIcons
                  name="camera-plus-outline"
                  size={26}
                  color={colors.primaryDark}
                />
                <Text style={styles.addPhotoBtnText}>
                  {language === 'ta' ? 'படம் சேர்' : 'Add Photo'}
                </Text>
              </Pressable>
            )}

            {/* Photo Previews */}
            {photos.map((uri, index) => (
              <View key={uri + index} style={styles.photoThumbWrapper}>
                <Image source={{ uri }} style={styles.photoThumb} resizeMode="cover" />
                <Pressable
                  onPress={() => handleRemovePhoto(index)}
                  hitSlop={6}
                  style={styles.removePhotoBtn}>
                  <MaterialCommunityIcons name="close" size={14} color={colors.white} />
                </Pressable>
              </View>
            ))}
          </ScrollView>
        </Card>

        {/* 2. Crop Names (English & Tamil) */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionHeading}>Crop Identification</Text>

          <Text style={styles.label}>
            Crop Name (English) <Text style={styles.req}>*</Text>
          </Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Traditional Seeraga Samba Nellu / Organic Tomatoes"
            value={cropName}
            onChangeText={setCropName}
          />

          <Text style={styles.label}>Crop Name in Tamil (பயிர் பெயர்)</Text>
          <TextInput
            style={styles.input}
            placeholder="எ.கா. நாட்டு தக்காளி / சீரக சம்பா நெல்"
            value={tamilName}
            onChangeText={setTamilName}
          />
        </Card>

        {/* 3. Category Selector (Including Manure, Fodder, Grains) */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionHeading}>
            Agricultural Category <Text style={styles.req}>*</Text>
          </Text>
          <View style={styles.chipsWrap}>
            {CATEGORY_OPTIONS.map((cat) => {
              const isSelected = category === cat.id;
              return (
                <Pressable
                  key={cat.id}
                  onPress={() => setCategory(cat.id)}
                  style={[styles.categoryChip, isSelected && styles.categoryChipSelected]}>
                  <MaterialCommunityIcons
                    name={cat.icon as any}
                    size={16}
                    color={isSelected ? colors.white : colors.primaryDark}
                  />
                  <Text
                    style={[
                      styles.categoryChipText,
                      isSelected && styles.categoryChipTextSelected,
                    ]}>
                    {language === 'ta' ? cat.labelTa : cat.labelEn}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Card>

        {/* 4. Flexible Units */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionHeading}>
            Measurement Unit <Text style={styles.req}>*</Text>
          </Text>
          <Text style={styles.sectionSubtitle}>
            Select billing unit suitable for wholesale or retail
          </Text>
          <View style={styles.chipsWrap}>
            {UNIT_OPTIONS.map((u) => {
              const isSelected = unit === u.id;
              return (
                <Pressable
                  key={u.id}
                  onPress={() => setUnit(u.id)}
                  style={[styles.unitChip, isSelected && styles.unitChipSelected]}>
                  <Text
                    style={[
                      styles.unitChipText,
                      isSelected && styles.unitChipTextSelected,
                    ]}>
                    {language === 'ta' ? u.labelTa : u.labelEn}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Card>

        {/* 5. Pricing, Stock & Minimum Order Quantity */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionHeading}>Pricing & Stock Quantity</Text>

          <View style={styles.inputsRow}>
            <View style={styles.inputCol}>
              <Text style={styles.label}>
                Price (₹ per {unit}) <Text style={styles.req}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder="₹ Amount"
                keyboardType="numeric"
                value={price}
                onChangeText={setPrice}
              />
            </View>

            <View style={styles.inputCol}>
              <Text style={styles.label}>
                Available Stock ({unit}) <Text style={styles.req}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder="Stock quantity"
                keyboardType="numeric"
                value={quantity}
                onChangeText={setQuantity}
              />
            </View>
          </View>

          <View style={styles.inputsRow}>
            <View style={styles.inputCol}>
              <Text style={styles.label}>Minimum Order ({unit})</Text>
              <TextInput
                style={styles.input}
                placeholder="Min order"
                keyboardType="numeric"
                value={minOrder}
                onChangeText={setMinOrder}
              />
            </View>

            <View style={styles.inputCol}>
              <Text style={styles.label}>Harvest / Packing Date</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Today / Oct 26"
                value={harvestDate}
                onChangeText={setHarvestDate}
              />
            </View>
          </View>

          {/* Organic Toggle */}
          <View style={styles.toggleRow}>
            <View style={styles.toggleTextCol}>
              <Text style={styles.toggleTitle}>100% Organic Certified (இயற்கை பயிர்)</Text>
              <Text style={styles.toggleSubtitle}>
                Cultivated with zero synthetic chemicals / TNOCD verified
              </Text>
            </View>
            <Switch
              value={isOrganic}
              onValueChange={setIsOrganic}
              trackColor={{ false: '#E0E0E0', true: colors.primaryLight }}
              thumbColor={isOrganic ? colors.primaryDark : '#F5F5F5'}
            />
          </View>
        </Card>

        {/* 6. Dynamic Category Specific Fields */}
        {category === 'organic_manure' && (
          <Card style={styles.dynamicCard}>
            <View style={styles.dynamicHeaderRow}>
              <MaterialCommunityIcons name="shovel" size={18} color={colors.accent} />
              <Text style={styles.dynamicTitle}>Composting & Organic Manure Details</Text>
            </View>

            <Text style={styles.label}>Composting Age & Curing Status</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 6 Months Cured / 1 Year Vermicompost"
              value={compostingAge}
              onChangeText={setCompostingAge}
            />

            <Text style={styles.label}>Moisture Content (Approx %)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 20-25% Ideal Moisture"
              value={moisture}
              onChangeText={setMoisture}
            />
          </Card>
        )}

        {(category === 'fodder' || category === 'grains_millets') && (
          <Card style={styles.dynamicCard}>
            <View style={styles.dynamicHeaderRow}>
              <MaterialCommunityIcons name="water-percent" size={18} color="#1976D2" />
              <Text style={styles.dynamicTitle}>Moisture Content (ஈரப்பதம்)</Text>
            </View>

            <Text style={styles.label}>Moisture Rating (Mandi Storage Grade)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Below 12% Mandi Grade / Dry Straw (8%)"
              value={moisture}
              onChangeText={setMoisture}
            />
          </Card>
        )}

        {category === 'grains_millets' && (
          <Card style={styles.dynamicCard}>
            <View style={styles.dynamicHeaderRow}>
              <MaterialCommunityIcons name="grain" size={18} color={colors.primaryDark} />
              <Text style={styles.dynamicTitle}>Grain / Millet Variety</Text>
            </View>

            <Text style={styles.label}>Variety (Paddy / Ragi / Millet Type)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Seeraga Samba / Ponni / Finger Millet (Ragi)"
              value={variety}
              onChangeText={setVariety}
            />
          </Card>
        )}

        {/* 7. Logistics & Delivery Vehicle Type */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionHeading}>Logistics & Dispatch Vehicle</Text>
          <Text style={styles.sectionSubtitle}>
            What vehicle will carry this produce to the buyer?
          </Text>

          <View style={styles.vehicleList}>
            {VEHICLE_OPTIONS.map((v) => {
              const isSelected = vehicleType === v.id;
              return (
                <Pressable
                  key={v.id}
                  onPress={() => setVehicleType(v.id)}
                  style={[styles.vehicleItem, isSelected && styles.vehicleItemSelected]}>
                  <MaterialCommunityIcons
                    name={v.icon as any}
                    size={20}
                    color={isSelected ? colors.primaryDark : colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.vehicleItemText,
                      isSelected && styles.vehicleItemTextSelected,
                    ]}>
                    {v.labelEn}
                  </Text>
                  {isSelected && (
                    <MaterialCommunityIcons
                      name="check-circle"
                      size={18}
                      color={colors.primaryDark}
                    />
                  )}
                </Pressable>
              );
            })}
          </View>
        </Card>

        {/* 8. Delivery Radius Slider Capped at 50 km */}
        <Card style={styles.sectionCard}>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.sectionHeading}>Farm Delivery Radius</Text>
              <Text style={styles.sectionSubtitle}>
                Strictly capped at 50 km to preserve farm freshness
              </Text>
            </View>
            <View style={styles.radiusPill}>
              <Text style={styles.radiusPillText}>{deliveryRadiusKm} km</Text>
            </View>
          </View>

          {/* Stepped Radius Selector */}
          <View style={styles.radiusStepsRow}>
            {RADIUS_STEPS.map((step) => {
              const isSelected = deliveryRadiusKm === step;
              return (
                <Pressable
                  key={step}
                  onPress={() => setDeliveryRadiusKm(step)}
                  style={[styles.radiusStepBtn, isSelected && styles.radiusStepBtnSelected]}>
                  <Text
                    style={[
                      styles.radiusStepText,
                      isSelected && styles.radiusStepTextSelected,
                    ]}>
                    {step} km
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.radiusNoticeBox}>
            <MaterialCommunityIcons name="shield-check" size={16} color={colors.primaryDark} />
            <Text style={styles.radiusNoticeText}>
              FarmKart guarantees direct-from-field delivery within a 50 km radius.
            </Text>
          </View>
        </Card>

        {/* Submit Primary Button */}
        <PrimaryButton
          title={
            loading
              ? language === 'ta'
                ? 'பட்டியலிடப்படுகிறது...'
                : 'Publishing Listing...'
              : language === 'ta'
              ? 'விளைபொருளை வெளியிடவும்'
              : 'Publish Harvest Listing'
          }
          icon="check-decagram"
          onPress={handleSubmit}
          disabled={loading}
          style={{ marginTop: spacing.xs }}
        />
      </ScrollView>

      {/* Image Picker Choice Modal */}
      <Modal
        visible={isPhotoPickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsPhotoPickerOpen(false)}>
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setIsPhotoPickerOpen(false)}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Upload Harvest Photo</Text>

            <Pressable style={styles.modalActionItem} onPress={handleTakePhoto}>
              <View style={[styles.modalActionIcon, { backgroundColor: '#E8F5E9' }]}>
                <MaterialCommunityIcons name="camera" size={24} color={colors.primaryDark} />
              </View>
              <View>
                <Text style={styles.modalActionTitle}>Take Live Photo with Camera</Text>
                <Text style={styles.modalActionDesc}>Capture fresh produce or tractor load</Text>
              </View>
            </Pressable>

            <View style={styles.divider} />

            <Pressable style={styles.modalActionItem} onPress={handlePickFromGallery}>
              <View style={[styles.modalActionIcon, { backgroundColor: '#E3F2FD' }]}>
                <MaterialCommunityIcons name="image-multiple" size={24} color="#1976D2" />
              </View>
              <View>
                <Text style={styles.modalActionTitle}>Choose from Device Gallery</Text>
                <Text style={styles.modalActionDesc}>Select farm harvest photos</Text>
              </View>
            </Pressable>

            <Pressable
              style={styles.modalCancelBtn}
              onPress={() => setIsPhotoPickerOpen(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
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
  scrollContent: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xxl + 40,
  },
  sectionCard: {
    gap: spacing.xs + 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  sectionHeading: {
    fontSize: fontSizes.sm + 1,
    fontWeight: '800',
    color: colors.text,
  },
  sectionSubtitle: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  req: {
    color: colors.error,
  },
  photoCountBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  photoCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  photosScroll: {
    marginTop: spacing.xs,
  },
  addPhotoBtn: {
    width: 80,
    height: 80,
    borderRadius: 10,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.primaryDark,
    backgroundColor: '#F1F8E9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
    gap: 4,
  },
  addPhotoBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  photoThumbWrapper: {
    width: 80,
    height: 80,
    borderRadius: 10,
    marginRight: spacing.sm,
    position: 'relative',
  },
  photoThumb: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
  },
  removePhotoBtn: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#D32F2F',
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: fontSizes.xs,
    fontWeight: '700',
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  input: {
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: fontSizes.sm,
    color: colors.text,
    marginTop: 4,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    gap: 6,
  },
  categoryChipSelected: {
    backgroundColor: colors.primaryDark,
    borderColor: colors.primaryDark,
  },
  categoryChipText: {
    fontSize: fontSizes.xs,
    fontWeight: '600',
    color: colors.text,
  },
  categoryChipTextSelected: {
    color: colors.white,
    fontWeight: '800',
  },
  unitChip: {
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  unitChipSelected: {
    backgroundColor: colors.primaryDark,
    borderColor: colors.primaryDark,
  },
  unitChipText: {
    fontSize: fontSizes.xs,
    fontWeight: '600',
    color: colors.text,
  },
  unitChipTextSelected: {
    color: colors.white,
    fontWeight: '800',
  },
  inputsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  inputCol: {
    flex: 1,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F1F8E9',
    padding: spacing.sm + 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primaryLight,
    marginTop: spacing.xs,
  },
  toggleTextCol: {
    flex: 1,
    marginRight: spacing.sm,
  },
  toggleTitle: {
    fontSize: fontSizes.xs + 1,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  toggleSubtitle: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 2,
  },
  dynamicCard: {
    backgroundColor: '#FFFDE7',
    borderWidth: 1.5,
    borderColor: '#FFF59D',
    gap: spacing.xs + 2,
  },
  dynamicHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dynamicTitle: {
    fontSize: fontSizes.sm,
    fontWeight: '800',
    color: colors.text,
  },
  vehicleList: {
    gap: 8,
    marginTop: 6,
  },
  vehicleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 10,
  },
  vehicleItemSelected: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primaryDark,
  },
  vehicleItemText: {
    fontSize: fontSizes.xs + 1,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  vehicleItemTextSelected: {
    color: colors.primaryDark,
    fontWeight: '800',
  },
  radiusPill: {
    backgroundColor: colors.primaryDark,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  radiusPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.white,
  },
  radiusStepsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
    marginTop: 8,
  },
  radiusStepBtn: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 8,
    borderRadius: 8,
  },
  radiusStepBtnSelected: {
    backgroundColor: colors.primaryDark,
    borderColor: colors.primaryDark,
  },
  radiusStepText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text,
  },
  radiusStepTextSelected: {
    color: colors.white,
    fontWeight: '900',
  },
  radiusNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F8E9',
    padding: spacing.xs + 2,
    borderRadius: 8,
    gap: 6,
    marginTop: 8,
  },
  radiusNoticeText: {
    fontSize: 11,
    color: colors.primaryDark,
    fontWeight: '600',
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.lg,
    gap: spacing.md,
  },
  modalTitle: {
    fontSize: fontSizes.md,
    fontWeight: '800',
    color: colors.text,
  },
  modalActionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  modalActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalActionTitle: {
    fontSize: fontSizes.sm,
    fontWeight: '700',
    color: colors.text,
  },
  modalActionDesc: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  modalCancelBtn: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  modalCancelText: {
    fontSize: fontSizes.sm,
    fontWeight: '700',
    color: colors.textSecondary,
  },
});
