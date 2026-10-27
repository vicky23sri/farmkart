/**
 * Buyer Checkout Screen
 * Features:
 * - Address selection with interactive map pin (react-native-maps)
 * - Live GPS location fetch with expo-location fallback
 * - Delivery slot picker (Early morning, Evening harvest dispatch)
 * - Order summary with real item breakdown and load-based delivery tier
 * - Strict 50 km blocker if any item's seller is beyond 50 km
 * - Routes to payment screen upon verification
 */

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';

import { AppHeader } from '@/components/AppHeader';
import { Card } from '@/components/Card';
import { PrimaryButton } from '@/components/PrimaryButton';
import {
  BuyerLocation,
  useCartStore,
  useLanguageStore,
  useLocationStore,
} from '@/store';
import { colors, fontSizes, shadows, spacing } from '@/theme';
import { formatDistance, getDistanceKm } from '@/utils/distance';

export interface DeliverySlot {
  id: string;
  title: string;
  titleTamil: string;
  timeWindow: string;
  tag: string;
}

const DELIVERY_SLOTS: DeliverySlot[] = [
  {
    id: 'slot-1',
    title: 'Today Morning Express',
    titleTamil: 'இன்று காலை விரைவு',
    timeWindow: '6:30 AM - 9:30 AM',
    tag: 'Early Harvest',
  },
  {
    id: 'slot-2',
    title: 'Today Evening Dispatch',
    titleTamil: 'இன்று மாலை விநியோகம்',
    timeWindow: '4:30 PM - 7:30 PM',
    tag: 'Fresh Afternoon Cut',
  },
  {
    id: 'slot-3',
    title: 'Tomorrow Morning',
    titleTamil: 'நாளை அதிகாலை',
    timeWindow: '6:00 AM - 9:00 AM',
    tag: 'Next Day Morning',
  },
];

export default function BuyerCheckoutScreen() {
  const { language } = useLanguageStore();
  const {
    currentLocation,
    savedAddresses,
    setLocation,
    addSavedAddress,
    requestAndFetchCurrentLocation,
    isLocating,
    maxDeliveryRadiusKm,
  } = useLocationStore();

  const {
    items,
    getSubtotal,
    couponCode,
    couponDiscount,
    getDeliveryBreakdown,
  } = useCartStore();

  const [selectedSlotId, setSelectedSlotId] = useState<string>('slot-1');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [newStreetAddress, setNewStreetAddress] = useState('');
  const [newCityName, setNewCityName] = useState('');

  // Pin coordinates for map marker
  const [pinCoord, setPinCoord] = useState<{
    latitude: number;
    longitude: number;
  }>({
    latitude: currentLocation.lat,
    longitude: currentLocation.lng,
  });

  // Calculate items with distance from current address
  const itemsWithDistance = useMemo(() => {
    return items.map((item) => {
      const dist = getDistanceKm(
        pinCoord.latitude,
        pinCoord.longitude,
        item.product.lat,
        item.product.lng
      );
      return {
        ...item,
        distanceKm: dist,
        isDeliverable: dist <= maxDeliveryRadiusKm,
      };
    });
  }, [items, pinCoord, maxDeliveryRadiusKm]);

  // Check 50 km blocker
  const outOfRangeItems = useMemo(() => {
    return itemsWithDistance.filter((item) => !item.isDeliverable);
  }, [itemsWithDistance]);

  const isBlocked = outOfRangeItems.length > 0;

  // Bill calculation
  const subtotal = getSubtotal();
  const deliveryBreakdown = getDeliveryBreakdown(
    pinCoord.latitude,
    pinCoord.longitude
  );
  const deliveryFee = deliveryBreakdown.fee;
  const grandTotal = Math.max(0, subtotal - couponDiscount + deliveryFee);

  // Map pin move handler
  const handleMapPress = (e: any) => {
    if (e?.nativeEvent?.coordinate) {
      const coord = e.nativeEvent.coordinate;
      setPinCoord(coord);
    }
  };

  const handleUseGps = async () => {
    const res = await requestAndFetchCurrentLocation();
    if (res.success && res.location) {
      setPinCoord({
        latitude: res.location.lat,
        longitude: res.location.lng,
      });
    }
  };

  const handleSaveNewAddress = () => {
    if (!newStreetAddress.trim()) {
      Alert.alert('Required', 'Please enter your street / door address.');
      return;
    }
    const newLoc: BuyerLocation = {
      id: `addr-${Date.now()}`,
      name: newCityName.trim() || 'Custom Farm Destination',
      nameTamil: 'விநியோக முகவரி',
      lat: pinCoord.latitude,
      lng: pinCoord.longitude,
      address: newStreetAddress.trim(),
    };
    addSavedAddress(newLoc);
    setShowAddressForm(false);
    setNewStreetAddress('');
    setNewCityName('');
  };

  const handleProceedToPayment = () => {
    if (items.length === 0) {
      Alert.alert('Empty Basket', 'Please add fresh produce before checking out.');
      router.push('/(buyer)/(tabs)');
      return;
    }

    // Navigate to dedicated payment screen
    router.push({
      pathname: '/(buyer)/payment',
      params: {
        slotId: selectedSlotId,
        notes: deliveryNotes,
        grandTotal: String(grandTotal),
        isExtendedDelivery: isBlocked ? 'true' : 'false',
        address: currentLocation ? `${currentLocation.address}, ${currentLocation.name}` : '',
        lat: String(pinCoord.latitude ?? currentLocation.lat),
        lng: String(pinCoord.longitude ?? currentLocation.lng),
      },
    });
  };

  return (
    <View style={styles.screen}>
      <AppHeader
        isSeller={false}
        showBack
        title={language === 'ta' ? 'செக்அவுட்' : 'Order Checkout'}
        showSearch={false}
        showCart={false}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* 1. Address Selection & Map Pin Card */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.headerIconCircle}>
              <MaterialCommunityIcons
                name="map-marker-radius"
                size={20}
                color={colors.primary}
              />
            </View>
            <View style={styles.headerTextCol}>
              <Text style={styles.sectionTitle}>
                {language === 'ta' ? 'விநியோக முகவரி' : 'Delivery Destination'}
              </Text>
              <Text style={styles.sectionSubtitle}>
                Pinpoint your exact farm or doorstep location
              </Text>
            </View>

            <Pressable
              onPress={handleUseGps}
              disabled={isLocating}
              style={styles.gpsButton}>
              {isLocating ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <>
                  <MaterialCommunityIcons
                    name="crosshairs-gps"
                    size={15}
                    color={colors.primaryDark}
                  />
                  <Text style={styles.gpsButtonText}>Live GPS</Text>
                </>
              )}
            </Pressable>
          </View>

          {/* Interactive Map Pin (react-native-maps) */}
          <View style={styles.mapContainer}>
            {MapView && Platform.OS !== 'web' ? (
              <MapView
                style={styles.mapView}
                initialRegion={{
                  latitude: pinCoord.latitude,
                  longitude: pinCoord.longitude,
                  latitudeDelta: 0.05,
                  longitudeDelta: 0.05,
                }}
                region={{
                  latitude: pinCoord.latitude,
                  longitude: pinCoord.longitude,
                  latitudeDelta: 0.05,
                  longitudeDelta: 0.05,
                }}
                onPress={handleMapPress}>
                {Marker && (
                  <Marker
                    coordinate={pinCoord}
                    draggable
                    onDragEnd={(e: any) => {
                      if (e?.nativeEvent?.coordinate) {
                        setPinCoord(e.nativeEvent.coordinate);
                      }
                    }}
                    title="Delivery Pinpoint"
                    description={currentLocation.address}
                  />
                )}
              </MapView>
            ) : (
              // Web / Fallback Map Simulation Card
              <View style={styles.mapFallback}>
                <View style={styles.mapFallbackPin}>
                  <MaterialCommunityIcons
                    name="map-marker"
                    size={36}
                    color={colors.error}
                  />
                </View>
                <Text style={styles.mapFallbackTitle}>
                  Delivery Coordinate Pinpoint
                </Text>
                <Text style={styles.mapFallbackCoords}>
                  GPS: {pinCoord.latitude.toFixed(4)}°N,{' '}
                  {pinCoord.longitude.toFixed(4)}°E
                </Text>
                <Text style={styles.mapFallbackHint}>
                  Tap Live GPS to center on your exact phone coordinates
                </Text>
              </View>
            )}

            {/* Pin Info Overlay Tag */}
            <View style={styles.pinOverlayTag}>
              <MaterialCommunityIcons
                name="pin-outline"
                size={14}
                color={colors.white}
              />
              <Text style={styles.pinOverlayText} numberOfLines={1}>
                {pinCoord.latitude.toFixed(4)}°N, {pinCoord.longitude.toFixed(4)}°E
              </Text>
            </View>
          </View>

          {/* Saved Address Radio Selector */}
          <View style={styles.savedAddressesList}>
            <Text style={styles.subLabel}>
              {language === 'ta' ? 'சேமிக்கப்பட்ட முகவரிகள்' : 'Saved Hubs / Addresses'}
            </Text>
            {savedAddresses.map((addr) => {
              const isSelected =
                Math.abs(addr.lat - pinCoord.latitude) < 0.001 &&
                Math.abs(addr.lng - pinCoord.longitude) < 0.001;

              return (
                <Pressable
                  key={addr.name}
                  onPress={() => {
                    setLocation(addr);
                    setPinCoord({ latitude: addr.lat, longitude: addr.lng });
                  }}
                  style={[
                    styles.addressItem,
                    isSelected && styles.addressItemSelected,
                  ]}>
                  <MaterialCommunityIcons
                    name={isSelected ? 'radiobox-marked' : 'radiobox-blank'}
                    size={20}
                    color={isSelected ? colors.primary : colors.textMuted}
                  />
                  <View style={styles.addressTextCol}>
                    <Text
                      style={[
                        styles.addressName,
                        isSelected && styles.addressNameSelected,
                      ]}>
                      {language === 'ta' ? addr.nameTamil : addr.name}
                    </Text>
                    <Text style={styles.addressBody} numberOfLines={1}>
                      {addr.address}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          {/* Toggle Add Custom Address */}
          {!showAddressForm ? (
            <Pressable
              onPress={() => setShowAddressForm(true)}
              style={styles.addAddressTrigger}>
              <MaterialCommunityIcons
                name="plus"
                size={16}
                color={colors.primary}
              />
              <Text style={styles.addAddressTriggerText}>
                {language === 'ta'
                  ? '+ புதிய முகவரியை சேர்க்க'
                  : '+ Enter New Door / Farm Address'}
              </Text>
            </Pressable>
          ) : (
            <View style={styles.newAddressForm}>
              <TextInput
                style={styles.addressInput}
                placeholder="Area / Land Name (e.g. Vadipatti North Farm)"
                placeholderTextColor={colors.textMuted}
                value={newCityName}
                onChangeText={setNewCityName}
              />
              <TextInput
                style={[styles.addressInput, { height: 60 }]}
                placeholder="Door No, Street Name, Landmark & Pincode"
                placeholderTextColor={colors.textMuted}
                multiline
                value={newStreetAddress}
                onChangeText={setNewStreetAddress}
              />
              <View style={styles.addressFormButtons}>
                <Pressable
                  onPress={() => setShowAddressForm(false)}
                  style={styles.cancelAddressBtn}>
                  <Text style={styles.cancelAddressBtnText}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={handleSaveNewAddress}
                  style={styles.saveAddressBtn}>
                  <Text style={styles.saveAddressBtnText}>Save Address</Text>
                </Pressable>
              </View>
            </View>
          )}
        </Card>

        {/* 2. 50 km Out of Range Blocker Notice */}
        {isBlocked && (
          <View style={styles.blockerCard}>
            <View style={styles.blockerHeader}>
              <MaterialCommunityIcons
                name="cancel"
                size={24}
                color={colors.error}
              />
              <View style={styles.blockerTextGroup}>
                <Text style={styles.blockerTitle}>
                  {language === 'ta'
                    ? 'செக்அவுட் தடுக்கப்பட்டது (> 50 கி.மீ)'
                    : 'Checkout Blocked: Distance > 50 km'}
                </Text>
                <Text style={styles.blockerDesc}>
                  Doorstep farm delivery is only permitted within 50 km. Some
                  items are located too far from your selected location:
                </Text>
              </View>
            </View>

            <View style={styles.blockerItemsList}>
              {outOfRangeItems.map((item) => (
                <View key={item.id} style={styles.blockerItemRow}>
                  <Text style={styles.blockerItemName} numberOfLines={1}>
                    • {item.product.name} ({item.product.sellerName})
                  </Text>
                  <Text style={styles.blockerItemDistance}>
                    {formatDistance(item.distanceKm)}
                  </Text>
                </View>
              ))}
            </View>

            <Pressable
              onPress={() => router.push('/(buyer)/(tabs)/cart')}
              style={styles.returnToCartBtn}>
              <Text style={styles.returnToCartBtnText}>
                Open Cart to Remove Faraway Items
              </Text>
            </Pressable>
          </View>
        )}

        {/* 3. Delivery Slot Picker */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.headerIconCircle}>
              <MaterialCommunityIcons
                name="clock-time-four-outline"
                size={20}
                color={colors.accent}
              />
            </View>
            <View style={styles.headerTextCol}>
              <Text style={styles.sectionTitle}>
                {language === 'ta' ? 'விநியோக நேரம்' : 'Delivery Slot'}
              </Text>
              <Text style={styles.sectionSubtitle}>
                Select when farmers should harvest and dispatch
              </Text>
            </View>
          </View>

          <View style={styles.slotsList}>
            {DELIVERY_SLOTS.map((slot) => {
              const isSelected = selectedSlotId === slot.id;
              return (
                <Pressable
                  key={slot.id}
                  onPress={() => setSelectedSlotId(slot.id)}
                  style={[
                    styles.slotItem,
                    isSelected && styles.slotItemSelected,
                  ]}>
                  <View style={styles.slotLeft}>
                    <MaterialCommunityIcons
                      name={isSelected ? 'check-circle' : 'circle-outline'}
                      size={20}
                      color={isSelected ? colors.primary : colors.textMuted}
                    />
                    <View>
                      <Text
                        style={[
                          styles.slotTitle,
                          isSelected && styles.slotTitleSelected,
                        ]}>
                        {language === 'ta' ? slot.titleTamil : slot.title}
                      </Text>
                      <Text style={styles.slotTime}>{slot.timeWindow}</Text>
                    </View>
                  </View>

                  <View
                    style={[
                      styles.slotTag,
                      isSelected && styles.slotTagSelected,
                    ]}>
                    <Text
                      style={[
                        styles.slotTagText,
                        isSelected && styles.slotTagTextSelected,
                      ]}>
                      {slot.tag}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          {/* Delivery Instructions Input */}
          <View style={styles.notesContainer}>
            <Text style={styles.notesLabel}>
              {language === 'ta'
                ? 'விவசாயிக்கு குறிப்பு (விருப்பமானது)'
                : 'Delivery Instructions / Field Landmark (Optional)'}
            </Text>
            <TextInput
              style={styles.notesInput}
              placeholder="e.g. Near the temple coconut grove / Tractor parking gate"
              placeholderTextColor={colors.textMuted}
              value={deliveryNotes}
              onChangeText={setDeliveryNotes}
            />
          </View>
        </Card>

        {/* 4. Order Summary Card */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.headerIconCircle}>
              <MaterialCommunityIcons
                name="clipboard-list-outline"
                size={20}
                color={colors.primary}
              />
            </View>
            <View style={styles.headerTextCol}>
              <Text style={styles.sectionTitle}>
                {language === 'ta' ? 'ஆர்டர் விபரம்' : 'Order Summary'}
              </Text>
              <Text style={styles.sectionSubtitle}>
                {items.length} items from Tamil Nadu verified farms
              </Text>
            </View>
          </View>

          {/* Item Thumbnails List */}
          <View style={styles.orderItemsList}>
            {itemsWithDistance.map((item) => (
              <View key={item.id} style={styles.orderItemRow}>
                <Image
                  source={{ uri: item.product.images[0] }}
                  style={styles.orderItemThumb}
                  resizeMode="cover"
                />
                <View style={styles.orderItemTextCol}>
                  <Text style={styles.orderItemName} numberOfLines={1}>
                    {item.product.name}
                  </Text>
                  <Text style={styles.orderItemSub}>
                    {item.quantity} {item.selectedUnit} • {formatDistance(item.distanceKm)} from {item.product.village}
                  </Text>
                </View>
                <Text style={styles.orderItemTotal}>
                  ₹{item.product.price * item.quantity}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.divider} />

          {/* Price Breakdown */}
          <View style={styles.billRows}>
            <View style={styles.billRow}>
              <Text style={styles.billLabel}>Produce Subtotal</Text>
              <Text style={styles.billValue}>₹{subtotal}</Text>
            </View>

            {couponDiscount > 0 && (
              <View style={styles.billRow}>
                <Text style={[styles.billLabel, { color: colors.primary }]}>
                  Coupon Discount ({couponCode})
                </Text>
                <Text style={[styles.billValue, { color: colors.primary }]}>
                  - ₹{couponDiscount}
                </Text>
              </View>
            )}

            <View style={styles.billRow}>
              <View>
                <Text style={styles.billLabel}>Farm-to-Door Delivery Fee</Text>
                <Text style={styles.billFeeDesc}>
                  {deliveryBreakdown.vehicleName}
                </Text>
              </View>
              <Text style={styles.billValue}>₹{deliveryFee}</Text>
            </View>

            <View style={[styles.billRow, styles.billGrandTotalRow]}>
              <Text style={styles.grandTotalLabel}>Total Payable</Text>
              <Text style={styles.grandTotalValue}>₹{grandTotal}</Text>
            </View>
          </View>
        </Card>
      </ScrollView>

      {/* Sticky Bottom Bar */}
      <View style={styles.bottomBar}>
        <View style={styles.bottomSubtotalCol}>
          <Text style={styles.bottomLabel}>Total Payable</Text>
          <Text style={styles.bottomAmount}>₹{grandTotal}</Text>
        </View>

        <PrimaryButton
          title={
            isBlocked
              ? 'Blocked: > 50 km Limit'
              : language === 'ta'
              ? 'பணம் செலுத்துதல் →'
              : 'Proceed to Payment →'
          }
          icon={isBlocked ? 'cancel' : 'credit-card-fast-outline'}
          disabled={isBlocked}
          onPress={handleProceedToPayment}
          style={[styles.proceedBtn, isBlocked && styles.proceedBtnBlocked]}
        />
      </View>
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
    paddingBottom: 110,
  },
  sectionCard: {
    gap: spacing.sm,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextCol: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: fontSizes.sm + 1,
    fontWeight: '800',
    color: colors.text,
  },
  sectionSubtitle: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  gpsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  gpsButtonText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  mapContainer: {
    height: 160,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#EDF5EC',
    marginTop: 4,
  },
  mapView: {
    width: '100%',
    height: '100%',
  },
  mapFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EDF5EC',
    padding: spacing.md,
  },
  mapFallbackPin: {
    marginBottom: 4,
  },
  mapFallbackTitle: {
    fontSize: fontSizes.xs + 1,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  mapFallbackCoords: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  mapFallbackHint: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 4,
  },
  pinOverlayTag: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(27, 94, 32, 0.85)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  pinOverlayText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '700',
  },
  savedAddressesList: {
    gap: spacing.xs + 2,
    marginTop: 4,
  },
  subLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  addressItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  addressItemSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  addressTextCol: {
    flex: 1,
  },
  addressName: {
    fontSize: fontSizes.xs + 1,
    fontWeight: '700',
    color: colors.text,
  },
  addressNameSelected: {
    color: colors.primaryDark,
  },
  addressBody: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  addAddressTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 4,
  },
  addAddressTriggerText: {
    fontSize: fontSizes.xs,
    fontWeight: '700',
    color: colors.primary,
  },
  newAddressForm: {
    gap: spacing.xs + 2,
    marginTop: 4,
  },
  addressInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: fontSizes.xs + 1,
    backgroundColor: colors.surfaceSecondary,
    color: colors.text,
  },
  addressFormButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 4,
  },
  cancelAddressBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  cancelAddressBtnText: {
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
  },
  saveAddressBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
  },
  saveAddressBtnText: {
    fontSize: fontSizes.xs,
    fontWeight: '700',
    color: colors.white,
  },
  blockerCard: {
    backgroundColor: '#FFEBEE',
    borderWidth: 1.5,
    borderColor: colors.error,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.sm,
  },
  blockerHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  blockerTextGroup: {
    flex: 1,
  },
  blockerTitle: {
    fontSize: fontSizes.sm + 1,
    fontWeight: '800',
    color: colors.error,
  },
  blockerDesc: {
    fontSize: fontSizes.xs,
    color: '#B71C1C',
    lineHeight: 16,
    marginTop: 2,
  },
  blockerItemsList: {
    gap: 4,
  },
  blockerItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.white,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  blockerItemName: {
    fontSize: fontSizes.xs,
    fontWeight: '700',
    color: colors.error,
    flex: 1,
  },
  blockerItemDistance: {
    fontSize: fontSizes.xs,
    fontWeight: '800',
    color: colors.error,
  },
  returnToCartBtn: {
    backgroundColor: colors.error,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 2,
  },
  returnToCartBtnText: {
    color: colors.white,
    fontSize: fontSizes.xs,
    fontWeight: '800',
  },
  slotsList: {
    gap: spacing.xs + 2,
  },
  slotItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  slotItemSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  slotLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  slotTitle: {
    fontSize: fontSizes.xs + 1,
    fontWeight: '700',
    color: colors.text,
  },
  slotTitleSelected: {
    color: colors.primaryDark,
  },
  slotTime: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  slotTag: {
    backgroundColor: colors.surfaceSecondary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  slotTagSelected: {
    backgroundColor: colors.primary,
  },
  slotTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  slotTagTextSelected: {
    color: colors.white,
  },
  notesContainer: {
    marginTop: spacing.xs,
    gap: 4,
  },
  notesLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  notesInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: fontSizes.xs,
    backgroundColor: colors.surfaceSecondary,
    color: colors.text,
  },
  orderItemsList: {
    gap: spacing.sm,
  },
  orderItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  orderItemThumb: {
    width: 44,
    height: 44,
    borderRadius: 6,
    backgroundColor: colors.surfaceSecondary,
  },
  orderItemTextCol: {
    flex: 1,
  },
  orderItemName: {
    fontSize: fontSizes.xs + 1,
    fontWeight: '700',
    color: colors.text,
  },
  orderItemSub: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  orderItemTotal: {
    fontSize: fontSizes.sm,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
  billRows: {
    gap: spacing.xs + 2,
  },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  billLabel: {
    fontSize: fontSizes.xs + 1,
    color: colors.textSecondary,
  },
  billFeeDesc: {
    fontSize: 10,
    color: colors.textMuted,
  },
  billValue: {
    fontSize: fontSizes.xs + 1,
    fontWeight: '700',
    color: colors.text,
  },
  billGrandTotalRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.xs + 4,
    marginTop: 4,
  },
  grandTotalLabel: {
    fontSize: fontSizes.sm + 1,
    fontWeight: '800',
    color: colors.text,
  },
  grandTotalValue: {
    fontSize: fontSizes.md + 2,
    fontWeight: '900',
    color: colors.primaryDark,
  },
  bottomBar: {
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
  bottomSubtotalCol: {
    justifyContent: 'center',
  },
  bottomLabel: {
    fontSize: 10,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  bottomAmount: {
    fontSize: fontSizes.lg,
    fontWeight: '900',
    color: colors.primaryDark,
  },
  proceedBtn: {
    minWidth: 200,
  },
  proceedBtnBlocked: {
    backgroundColor: colors.textMuted,
  },
});
