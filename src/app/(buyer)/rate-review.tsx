/**
 * Rate and Review Screen
 * Features:
 * - AppHeader with Back button and localized title
 * - Produce & Farmer Order card context
 * - 3 Distinct Star Rating bars:
 *    1. Product Quality (Freshness, Taste, Mandi Grade)
 *    2. Farmer / Seller (Grading, Harvest Care, Seller Trust)
 *    3. Delivery Experience (Speed, Vehicle Handling, Driver Courtesy)
 * - Interactive Quick Tags (Fresh, Good packaging, On time, 100% Organic, etc.)
 * - Multiline feedback text with character counter
 * - Photo upload with expo-image-picker (Gallery or Camera, horizontal preview with delete)
 * - Updates shared useOrderStore and provides immediate visual confirmation
 */

import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { Card } from '@/components/Card';
import { useCartStore, useLanguageStore, useOrderStore } from '@/store';
import { colors, fontSizes, spacing } from '@/theme';

const QUICK_TAGS = [
  { id: 'fresh', labelEn: 'Fresh Harvest 🥬', labelTa: 'புதிய விளைச்சல் 🥬' },
  { id: 'packaging', labelEn: 'Good Packaging 📦', labelTa: 'தரமான பேக்கிங் 📦' },
  { id: 'ontime', labelEn: 'On Time ⚡', labelTa: 'சரியான நேரம் ⚡' },
  { id: 'organic', labelEn: '100% Organic 🌿', labelTa: 'இயற்கை உரம் 🌿' },
  { id: 'fair_price', labelEn: 'Fair Mandi Price 💰', labelTa: 'நியாயமான விலை 💰' },
  { id: 'friendly_farmer', labelEn: 'Friendly Farmer 👨‍🌾', labelTa: 'நட்பான விவசாயி 👨‍🌾' },
  { id: 'careful_handling', labelEn: 'Careful Handling 🚚', labelTa: 'பாதுகாப்பான வாகனம் 🚚' },
  { id: 'farm_aroma', labelEn: 'Farm Fresh Aroma 🌾', labelTa: 'இயற்கை நறுமணம் 🌾' },
];

export default function RateReviewScreen() {
  const { language } = useLanguageStore();
  const { getTotalCount } = useCartStore();
  const { orders, submitReview } = useOrderStore();
  const params = useLocalSearchParams<{ orderId?: string }>();

  // Locate matching order
  const order = orders.find(
    (o) => o.id.toLowerCase() === (params.orderId || '').toLowerCase()
  ) || orders.find((o) => o.status === 'delivered') || orders[0];

  const firstItem = order?.items[0];

  // Review states (pre-populate if already reviewed)
  const existingReview = order?.review;
  const [productRating, setProductRating] = useState<number>(existingReview?.productRating || 5);
  const [farmerRating, setFarmerRating] = useState<number>(existingReview?.farmerRating || 5);
  const [deliveryRating, setDeliveryRating] = useState<number>(existingReview?.deliveryRating || 5);
  const [selectedTags, setSelectedTags] = useState<string[]>(existingReview?.tags || ['fresh', 'packaging', 'ontime']);
  const [comment, setComment] = useState<string>(existingReview?.comment || '');
  const [photos, setPhotos] = useState<string[]>(existingReview?.photos || []);
  const [isPhotoPickerOpen, setIsPhotoPickerOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Toggle quick tags
  const toggleTag = (tagId: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  // Launch Camera
  const handleTakePhoto = async () => {
    setIsPhotoPickerOpen(false);
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          language === 'ta' ? 'அனுமதி தேவை' : 'Permission Required',
          language === 'ta'
            ? 'புகைப்படம் எடுக்க கேமரா அணுகலை அனுமதிக்கவும்.'
            : 'Camera access is required to take photos of your harvest delivery.'
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setPhotos((prev) => [...prev, result.assets[0].uri]);
      }
    } catch {
      Alert.alert('Error', 'Unable to open camera on this device.');
    }
  };

  // Launch Gallery
  const handlePickFromGallery = async () => {
    setIsPhotoPickerOpen(false);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          language === 'ta' ? 'அனுமதி தேவை' : 'Permission Required',
          language === 'ta'
            ? 'கேலரியில் இருந்து படம் தேர்ந்தெடுக்க அனுமதி தேவை.'
            : 'Photo library access is required to upload harvest images.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
        allowsMultipleSelection: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const uris = result.assets.map((asset) => asset.uri);
        setPhotos((prev) => [...prev, ...uris]);
      }
    } catch {
      Alert.alert('Error', 'Unable to access media library on this device.');
    }
  };

  // Remove photo
  const handleRemovePhoto = (indexToRemove: number) => {
    setPhotos((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  // Rating label helper
  const getRatingLabel = (rating: number, category: 'product' | 'farmer' | 'delivery') => {
    if (category === 'product') {
      const labelsEn = ['', 'Poor Quality', 'Average Crop', 'Good Freshness', 'Very Fresh', 'Exceptional Harvest!'];
      const labelsTa = ['', 'மோசமானது', 'சராசரி', 'நல்ல தரம்', 'மிகவும் புதியது', 'அருமையான விளைச்சல்!'];
      return language === 'ta' ? labelsTa[rating] : labelsEn[rating];
    }
    if (category === 'farmer') {
      const labelsEn = ['', 'Unresponsive', 'Average Service', 'Good Farmer', 'Great Trust', 'Outstanding Uzhavan!'];
      const labelsTa = ['', 'பதிலில்லை', 'சராசரி', 'நல்ல விவசாயி', 'நம்பகமானவர்', 'சிறந்த உழவர்!'];
      return language === 'ta' ? labelsTa[rating] : labelsEn[rating];
    }
    // delivery
    const labelsEn = ['', 'Damaged / Late', 'Delayed', 'On Time', 'Careful & Quick', 'Superb Express Delivery!'];
    const labelsTa = ['', 'சேதம் / தாமதம்', 'தாமதம்', 'நேரத்திற்கு வந்தது', 'பாதுகாப்பானது', 'சிறப்பான விநியோகம்!'];
    return language === 'ta' ? labelsTa[rating] : labelsEn[rating];
  };

  // Submit Review
  const handleSubmit = () => {
    if (productRating === 0) {
      Alert.alert(
        language === 'ta' ? 'மதிப்பீடு தேவை' : 'Rating Required',
        language === 'ta'
          ? 'தயவுசெய்து விளைபொருளுக்கு குறைந்தபட்சம் 1 நட்சத்திரம் வழங்கவும்.'
          : 'Please select a star rating for the farm product quality.'
      );
      return;
    }

    if (!order) {
      Alert.alert('Error', 'Order not found.');
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      submitReview(order.id, {
        productRating,
        farmerRating,
        deliveryRating,
        comment: comment.trim(),
        photos,
        tags: selectedTags,
        date: new Date().toISOString(),
      });
      setIsSubmitting(false);
      setShowSuccessModal(true);
    }, 400);
  };

  return (
    <View style={styles.screen}>
      <AppHeader
        showBack={true}
        title={language === 'ta' ? 'மதிப்பீடு & கருத்து' : 'Rate & Review'}
        cartCount={getTotalCount()}
        onCartPress={() => router.push('/(buyer)/(tabs)/cart')}
      />

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        {/* Order Summary Context Card */}
        {order && (
          <Card style={styles.orderContextCard}>
            <View style={styles.orderContextRow}>
              {firstItem?.image ? (
                <Image
                  source={{ uri: firstItem.image }}
                  style={styles.itemThumb}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.itemThumbPlaceholder}>
                  <MaterialCommunityIcons
                    name="sprout"
                    size={28}
                    color={colors.primary}
                  />
                </View>
              )}
              <View style={styles.orderInfoCol}>
                <Text style={styles.orderIdTag}>Order #{order.id}</Text>
                <Text style={styles.orderItemTitle} numberOfLines={1}>
                  {firstItem?.name || 'Farm Fresh Produce'}
                </Text>
                <View style={styles.farmerSubRow}>
                  <MaterialCommunityIcons
                    name="tractor"
                    size={14}
                    color={colors.primary}
                  />
                  <Text style={styles.farmerSubText}>
                    {order.sellerName} • {order.sellerFarm}
                  </Text>
                </View>
              </View>
            </View>
          </Card>
        )}

        {/* 1. Product Quality Rating */}
        <Card style={styles.ratingCard}>
          <View style={styles.cardHeaderRow}>
            <View style={[styles.headerIconBg, { backgroundColor: '#E8F5E9' }]}>
              <MaterialCommunityIcons name="leaf" size={20} color={colors.primaryDark} />
            </View>
            <View style={styles.headerTextCol}>
              <Text style={styles.cardHeading}>
                {language === 'ta' ? 'விளைபொருள் தரம்' : '1. Product Quality'}
              </Text>
              <Text style={styles.cardSubheading}>
                {language === 'ta'
                  ? 'புத்துணர்ச்சி, இயற்கை மணம், அளவு மற்றும் தூய்மை'
                  : 'Freshness, aroma, grading, and weight accuracy'}
              </Text>
            </View>
          </View>

          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Pressable
                key={star}
                onPress={() => setProductRating(star)}
                hitSlop={8}
                style={styles.starTouch}>
                <MaterialCommunityIcons
                  name={star <= productRating ? 'star' : 'star-outline'}
                  size={36}
                  color={star <= productRating ? '#FFB300' : colors.border}
                />
              </Pressable>
            ))}
          </View>
          <Text style={styles.ratingPillLabel}>
            {getRatingLabel(productRating, 'product')}
          </Text>
        </Card>

        {/* 2. Farmer / Seller Rating */}
        <Card style={styles.ratingCard}>
          <View style={styles.cardHeaderRow}>
            <View style={[styles.headerIconBg, { backgroundColor: '#FFF3E0' }]}>
              <MaterialCommunityIcons name="account-cowboy-hat" size={20} color={colors.accent} />
            </View>
            <View style={styles.headerTextCol}>
              <Text style={styles.cardHeading}>
                {language === 'ta' ? 'விவசாயி / உழவர்' : '2. Farmer & Farm Service'}
              </Text>
              <Text style={styles.cardSubheading}>
                {language === 'ta'
                  ? 'சரியான தரம் பிரித்தல், அறுவடை கவனிப்பு, உழவர் சேவை'
                  : 'Honest sorting, field harvesting care, and communication'}
              </Text>
            </View>
          </View>

          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Pressable
                key={star}
                onPress={() => setFarmerRating(star)}
                hitSlop={8}
                style={styles.starTouch}>
                <MaterialCommunityIcons
                  name={star <= farmerRating ? 'star' : 'star-outline'}
                  size={36}
                  color={star <= farmerRating ? '#FFB300' : colors.border}
                />
              </Pressable>
            ))}
          </View>
          <Text style={styles.ratingPillLabel}>
            {getRatingLabel(farmerRating, 'farmer')}
          </Text>
        </Card>

        {/* 3. Delivery Experience Rating */}
        <Card style={styles.ratingCard}>
          <View style={styles.cardHeaderRow}>
            <View style={[styles.headerIconBg, { backgroundColor: '#E3F2FD' }]}>
              <MaterialCommunityIcons name="truck-fast" size={20} color="#1976D2" />
            </View>
            <View style={styles.headerTextCol}>
              <Text style={styles.cardHeading}>
                {language === 'ta' ? 'விநியோக அனுபவம்' : '3. Delivery Experience'}
              </Text>
              <Text style={styles.cardSubheading}>
                {language === 'ta'
                  ? 'நேரம் தவறாமை, பாதுகாப்பான வாகனம், ஓட்டுநர் பணிவு'
                  : 'On-time arrival, careful transport, and driver conduct'}
              </Text>
            </View>
          </View>

          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Pressable
                key={star}
                onPress={() => setDeliveryRating(star)}
                hitSlop={8}
                style={styles.starTouch}>
                <MaterialCommunityIcons
                  name={star <= deliveryRating ? 'star' : 'star-outline'}
                  size={36}
                  color={star <= deliveryRating ? '#FFB300' : colors.border}
                />
              </Pressable>
            ))}
          </View>
          <Text style={styles.ratingPillLabel}>
            {getRatingLabel(deliveryRating, 'delivery')}
          </Text>
        </Card>

        {/* Quick Highlights / Tags */}
        <Card style={styles.tagsCard}>
          <Text style={styles.cardHeading}>
            {language === 'ta' ? 'விரைவு குறிப்புகள்' : 'What did you like the most?'}
          </Text>
          <Text style={styles.cardSubheading}>
            {language === 'ta'
              ? 'பொருந்தக்கூடிய குறிப்புகளைத் தேர்ந்தெடுக்கவும்'
              : 'Select quick tags to help other mandi buyers'}
          </Text>

          <View style={styles.tagsContainer}>
            {QUICK_TAGS.map((tag) => {
              const isSelected = selectedTags.includes(tag.id);
              return (
                <Pressable
                  key={tag.id}
                  onPress={() => toggleTag(tag.id)}
                  style={[
                    styles.tagChip,
                    isSelected ? styles.tagChipActive : styles.tagChipInactive,
                  ]}>
                  <Text
                    style={[
                      styles.tagChipText,
                      isSelected ? styles.tagChipTextActive : styles.tagChipTextInactive,
                    ]}>
                    {language === 'ta' ? tag.labelTa : tag.labelEn}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Card>

        {/* Written Review */}
        <Card style={styles.textReviewCard}>
          <View style={styles.textHeaderRow}>
            <Text style={styles.cardHeading}>
              {language === 'ta' ? 'உங்கள் கருத்து' : 'Detailed Review'}
            </Text>
            <Text style={styles.charCount}>{comment.length} / 500</Text>
          </View>

          <TextInput
            style={styles.textInput}
            multiline
            numberOfLines={4}
            maxLength={500}
            value={comment}
            onChangeText={setComment}
            placeholder={
              language === 'ta'
                ? 'விளைபொருளின் தரம், மணம், பேக்கிங் மற்றும் எடை துல்லியம் பற்றி விவரிக்கவும்...'
                : 'Write about harvest freshness, packaging care, taste, and experience with this farmer...'
            }
            placeholderTextColor={colors.textSecondary}
          />
        </Card>

        {/* Photo Upload with expo-image-picker */}
        <Card style={styles.photoUploadCard}>
          <View style={styles.photoHeaderRow}>
            <View>
              <Text style={styles.cardHeading}>
                {language === 'ta' ? 'புகைப்படங்கள் இணைக்கவும்' : 'Add Photos'}
              </Text>
              <Text style={styles.cardSubheading}>
                {language === 'ta'
                  ? 'விளைபொருள் அல்லது விநியோக புகைப்படங்களை பகிரவும்'
                  : 'Share unboxing or harvest produce images'}
              </Text>
            </View>
            <Text style={styles.photoCountText}>{photos.length} photos</Text>
          </View>

          {/* Photos Row */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photosScroll}>
            {/* Add Photo Button */}
            <Pressable
              onPress={() => setIsPhotoPickerOpen(true)}
              style={styles.addPhotoBtn}>
              <MaterialCommunityIcons
                name="camera-plus-outline"
                size={26}
                color={colors.primary}
              />
              <Text style={styles.addPhotoBtnText}>
                {language === 'ta' ? 'சேர்' : 'Add'}
              </Text>
            </Pressable>

            {/* Photo Previews */}
            {photos.map((uri, index) => (
              <View key={uri + index} style={styles.photoPreviewWrapper}>
                <Image source={{ uri }} style={styles.photoPreview} resizeMode="cover" />
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

        {/* Submit Review Button */}
        <Pressable
          onPress={handleSubmit}
          disabled={isSubmitting}
          style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}>
          <MaterialCommunityIcons
            name="check-decagram"
            size={20}
            color={colors.white}
          />
          <Text style={styles.submitBtnText}>
            {isSubmitting
              ? language === 'ta'
                ? 'பதிவாகிறது...'
                : 'Submitting Review...'
              : language === 'ta'
              ? 'மதிப்பீட்டை சமர்ப்பிக்கவும்'
              : 'Submit Review'}
          </Text>
        </Pressable>
      </ScrollView>

      {/* Image Picker Option Modal */}
      <Modal
        visible={isPhotoPickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsPhotoPickerOpen(false)}>
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setIsPhotoPickerOpen(false)}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>
              {language === 'ta' ? 'புகைப்படம் தேர்ந்தெடுக்கவும்' : 'Upload Harvest Photo'}
            </Text>

            <Pressable style={styles.modalActionItem} onPress={handleTakePhoto}>
              <View style={[styles.modalActionIcon, { backgroundColor: '#E8F5E9' }]}>
                <MaterialCommunityIcons name="camera" size={24} color={colors.primary} />
              </View>
              <View style={styles.modalActionTextCol}>
                <Text style={styles.modalActionTitle}>
                  {language === 'ta' ? 'கேமரா மூலம் எடுக்கவும்' : 'Take Photo with Camera'}
                </Text>
                <Text style={styles.modalActionDesc}>
                  {language === 'ta' ? 'புதிய புகைப்படம் எடுக்க' : 'Capture instant produce snapshot'}
                </Text>
              </View>
            </Pressable>

            <View style={styles.divider} />

            <Pressable style={styles.modalActionItem} onPress={handlePickFromGallery}>
              <View style={[styles.modalActionIcon, { backgroundColor: '#E3F2FD' }]}>
                <MaterialCommunityIcons name="image-multiple" size={24} color="#1976D2" />
              </View>
              <View style={styles.modalActionTextCol}>
                <Text style={styles.modalActionTitle}>
                  {language === 'ta' ? 'கேலரியில் இருந்து தேர்ந்தெடுக்க' : 'Choose from Gallery'}
                </Text>
                <Text style={styles.modalActionDesc}>
                  {language === 'ta' ? 'சேமிக்கப்பட்ட படங்கள்' : 'Select unboxing images from library'}
                </Text>
              </View>
            </Pressable>

            <Pressable
              style={styles.modalCancelBtn}
              onPress={() => setIsPhotoPickerOpen(false)}>
              <Text style={styles.modalCancelText}>
                {language === 'ta' ? 'ரத்து' : 'Cancel'}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* Success Modal */}
      <Modal
        visible={showSuccessModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowSuccessModal(false);
          router.back();
        }}>
        <View style={styles.successOverlay}>
          <Card style={styles.successCard}>
            <View style={styles.successIconCircle}>
              <MaterialCommunityIcons
                name="heart-pulse"
                size={42}
                color={colors.primary}
              />
            </View>
            <Text style={styles.successTitle}>
              {language === 'ta' ? 'மிக்க நன்றி!' : 'Thank You!'}
            </Text>
            <Text style={styles.successMessage}>
              {language === 'ta'
                ? 'உங்கள் மதிப்புமிக்க கருத்து உள்ளூர் விவசாயிகளுக்கும் நுகர்வோர்களுக்கும் பெரிதும் உதவும்.'
                : 'Your review supports rural Tamil farmers and guides marketplace buyers to authentic harvests.'}
            </Text>

            <View style={styles.successStatsRow}>
              <View style={styles.successStatPill}>
                <MaterialCommunityIcons name="leaf" size={16} color={colors.primary} />
                <Text style={styles.successStatText}>Product: {productRating}★</Text>
              </View>
              <View style={styles.successStatPill}>
                <MaterialCommunityIcons name="tractor" size={16} color={colors.accent} />
                <Text style={styles.successStatText}>Farmer: {farmerRating}★</Text>
              </View>
              <View style={styles.successStatPill}>
                <MaterialCommunityIcons name="truck-fast" size={16} color="#1976D2" />
                <Text style={styles.successStatText}>Delivery: {deliveryRating}★</Text>
              </View>
            </View>

            <Pressable
              style={styles.successDoneBtn}
              onPress={() => {
                setShowSuccessModal(false);
                router.back();
              }}>
              <Text style={styles.successDoneBtnText}>
                {language === 'ta' ? 'சரி' : 'Done'}
              </Text>
            </Pressable>
          </Card>
        </View>
      </Modal>
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
  orderContextCard: {
    padding: spacing.sm + 2,
    backgroundColor: colors.surface,
  },
  orderContextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
  },
  itemThumb: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  itemThumbPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderInfoCol: {
    flex: 1,
  },
  orderIdTag: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primaryDark,
    textTransform: 'uppercase',
  },
  orderItemTitle: {
    fontSize: fontSizes.md,
    fontWeight: '700',
    color: colors.text,
    marginTop: 2,
  },
  farmerSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  farmerSubText: {
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  ratingCard: {
    padding: spacing.md,
    alignItems: 'center',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    width: '100%',
    marginBottom: spacing.sm,
  },
  headerIconBg: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextCol: {
    flex: 1,
  },
  cardHeading: {
    fontSize: fontSizes.md,
    fontWeight: '700',
    color: colors.text,
  },
  cardSubheading: {
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: spacing.xs,
  },
  starTouch: {
    padding: 2,
  },
  ratingPillLabel: {
    fontSize: fontSizes.xs + 1,
    fontWeight: '700',
    color: colors.primaryDark,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 6,
  },
  tagsCard: {
    padding: spacing.md,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: spacing.sm,
  },
  tagChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  tagChipActive: {
    backgroundColor: '#E8F5E9',
    borderColor: colors.primary,
  },
  tagChipInactive: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  tagChipText: {
    fontSize: fontSizes.xs + 1,
    fontWeight: '600',
  },
  tagChipTextActive: {
    color: colors.primaryDark,
    fontWeight: '700',
  },
  tagChipTextInactive: {
    color: colors.textSecondary,
  },
  textReviewCard: {
    padding: spacing.md,
  },
  textHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  charCount: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  textInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.sm + 2,
    fontSize: fontSizes.sm,
    color: colors.text,
    minHeight: 90,
    textAlignVertical: 'top',
    backgroundColor: '#FAFAFA',
  },
  photoUploadCard: {
    padding: spacing.md,
  },
  photoHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  photoCountText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  photosScroll: {
    flexDirection: 'row',
  },
  addPhotoBtn: {
    width: 80,
    height: 80,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryLight,
    marginRight: spacing.sm,
  },
  addPhotoBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primaryDark,
    marginTop: 2,
  },
  photoPreviewWrapper: {
    position: 'relative',
    marginRight: spacing.sm,
  },
  photoPreview: {
    width: 80,
    height: 80,
    borderRadius: 10,
  },
  removePhotoBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.white,
  },
  submitBtn: {
    backgroundColor: colors.primaryDark,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: spacing.xs,
    marginTop: spacing.xs,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
      },
      android: { elevation: 3 },
    }),
  },
  submitBtnDisabled: {
    opacity: 0.7,
  },
  submitBtnText: {
    color: colors.white,
    fontSize: fontSizes.md,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  modalTitle: {
    fontSize: fontSizes.md + 1,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.md,
  },
  modalActionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm + 4,
    gap: spacing.md,
  },
  modalActionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalActionTextCol: {
    flex: 1,
  },
  modalActionTitle: {
    fontSize: fontSizes.sm + 2,
    fontWeight: '700',
    color: colors.text,
  },
  modalActionDesc: {
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 4,
  },
  modalCancelBtn: {
    marginTop: spacing.md,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: fontSizes.sm + 1,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  successOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  successCard: {
    width: '100%',
    padding: spacing.xl,
    alignItems: 'center',
    borderRadius: 16,
  },
  successIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  successTitle: {
    fontSize: fontSizes.xl,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  successMessage: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
    lineHeight: 20,
  },
  successStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    marginVertical: spacing.md,
  },
  successStatPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  successStatText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text,
  },
  successDoneBtn: {
    backgroundColor: colors.primaryDark,
    paddingVertical: 12,
    paddingHorizontal: 36,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  successDoneBtnText: {
    color: colors.white,
    fontSize: fontSizes.md,
    fontWeight: '700',
  },
});
