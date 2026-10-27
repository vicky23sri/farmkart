/**
 * Buyer Profile Screen
 * Features:
 * - AppHeader on top with title, cart badge, and language toggle
 * - User card with avatar, name, phone, email, and Edit Profile modal
 * - Stats counters (Orders, Wishlist, Addresses)
 * - Saved Addresses management with useLocationStore (active selection, add address modal, delete)
 * - Payment Methods (Saved UPI IDs, Saved RuPay/Visa Cards, COD preference, Add Payment modal)
 * - Language Switch (English / Tamil live toggle with useLanguageStore)
 * - Help & Support (24x7 Kisan Call Centre 1800-425-1555, WhatsApp Mandi Support, Expandable FAQs)
 * - Quick shortcuts to Wishlist and My Orders
 * - Switch to Seller / Farmer mode
 * - Logout confirmation with useAuthStore
 */

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  Linking,
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
import {
  BuyerLocation,
  useAuthStore,
  useCartStore,
  useLanguageStore,
  useLocationStore,
  useOrderStore,
  useWishlistStore,
} from '@/store';
import { colors, fontSizes, spacing } from '@/theme';

interface SavedPaymentMethod {
  id: string;
  type: 'upi' | 'card';
  title: string;
  subtitle: string;
  icon: string;
  isDefault?: boolean;
}

const INITIAL_PAYMENT_METHODS: SavedPaymentMethod[] = [
  {
    id: 'pay-1',
    type: 'upi',
    title: 'Google Pay UPI',
    subtitle: 'karthik.v@okhdfcbank',
    icon: 'google',
    isDefault: true,
  },
  {
    id: 'pay-2',
    type: 'upi',
    title: 'PhonePe UPI',
    subtitle: '9876543210@ybl',
    icon: 'cellphone-wireless',
  },
  {
    id: 'pay-3',
    type: 'card',
    title: 'HDFC Bank RuPay Debit',
    subtitle: '•••• 4129 (Exp 08/29)',
    icon: 'credit-card',
  },
  {
    id: 'pay-4',
    type: 'card',
    title: 'SBI Kisan Credit Card',
    subtitle: '•••• 8821 (Exp 12/28)',
    icon: 'credit-card-outline',
  },
];

export default function BuyerProfileScreen() {
  const { logout } = useAuthStore();
  const { language, setLanguage } = useLanguageStore();
  const { currentLocation, savedAddresses, setLocation, addSavedAddress, removeSavedAddress } =
    useLocationStore();
  const { orders } = useOrderStore();
  const { items: wishlistItems } = useWishlistStore();
  const { getTotalCount } = useCartStore();

  // Profile Edit State
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [userName, setUserName] = useState('Karthik V.');
  const [userPhone, setUserPhone] = useState('+91 98765 43210');
  const [userEmail, setUserEmail] = useState('karthik.v@tamilagri.in');

  // Address Modal State
  const [isAddAddressOpen, setIsAddAddressOpen] = useState(false);
  const [newAddrLabel, setNewAddrLabel] = useState('Home');
  const [newAddrStreet, setNewAddrStreet] = useState('');
  const [newAddrArea, setNewAddrArea] = useState('');
  const [newAddrCity, setNewAddrCity] = useState('Madurai');
  const [newAddrPincode, setNewAddrPincode] = useState('625001');

  // Payment State
  const [paymentMethods, setPaymentMethods] = useState<SavedPaymentMethod[]>(INITIAL_PAYMENT_METHODS);
  const [isAddPaymentOpen, setIsAddPaymentOpen] = useState(false);
  const [newPayType, setNewPayType] = useState<'upi' | 'card'>('upi');
  const [newPayTitle, setNewPayTitle] = useState('');
  const [newPayValue, setNewPayValue] = useState('');
  const [codDefaultEnabled, setCodDefaultEnabled] = useState(false);

  // FAQ Accordion State
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  // Toggle FAQ
  const toggleFaq = (index: number) => {
    setExpandedFaq(expandedFaq === index ? null : index);
  };

  // Add Address Handler
  const handleSaveAddress = () => {
    if (!newAddrStreet.trim() || !newAddrArea.trim()) {
      Alert.alert(
        language === 'ta' ? 'தகவல் தேவை' : 'Details Required',
        language === 'ta' ? 'தெரு மற்றும் பகுதியை உள்ளிடவும்.' : 'Please enter street name and locality/area.'
      );
      return;
    }

    const fullAddress = `${newAddrStreet.trim()}, ${newAddrArea.trim()}, ${newAddrCity} - ${newAddrPincode}`;
    const newAddressObj: BuyerLocation = {
      id: `addr-${Date.now()}`,
      name: newAddrLabel,
      nameTamil: newAddrLabel === 'Home' ? 'வீடு' : newAddrLabel === 'Work' ? 'அலுவலகம்' : 'பண்ணை',
      address: fullAddress,
      lat: 9.9252 + (Math.random() - 0.5) * 0.05,
      lng: 78.1198 + (Math.random() - 0.5) * 0.05,
    };

    addSavedAddress(newAddressObj);
    setIsAddAddressOpen(false);
    setNewAddrStreet('');
    setNewAddrArea('');

    Alert.alert(
      language === 'ta' ? 'சேமிக்கப்பட்டது' : 'Address Saved',
      language === 'ta'
        ? 'புதிய முகவரி வெற்றிகரமாக சேர்க்கப்பட்டது.'
        : 'Your delivery address has been added successfully.'
    );
  };

  // Delete Address Handler
  const handleDeleteAddress = (item: BuyerLocation) => {
    Alert.alert(
      language === 'ta' ? 'முகவரியை நீக்கு' : 'Delete Address',
      language === 'ta'
        ? `"${item.name}" முகவரியை நீக்க விரும்புகிறீர்களா?`
        : `Delete "${item.name}" from saved addresses?`,
      [
        { text: language === 'ta' ? 'ரத்து' : 'Cancel', style: 'cancel' },
        {
          text: language === 'ta' ? 'நீக்கு' : 'Delete',
          style: 'destructive',
          onPress: () => removeSavedAddress(item.id || item.address),
        },
      ]
    );
  };

  // Add Payment Handler
  const handleSavePayment = () => {
    if (!newPayTitle.trim() || !newPayValue.trim()) {
      Alert.alert(
        language === 'ta' ? 'தகவல் தேவை' : 'Details Required',
        language === 'ta' ? 'பெயர் மற்றும் விவரங்களை உள்ளிடவும்.' : 'Please enter name and UPI ID or card details.'
      );
      return;
    }

    const newMethod: SavedPaymentMethod = {
      id: `pay-${Date.now()}`,
      type: newPayType,
      title: newPayTitle.trim(),
      subtitle: newPayValue.trim(),
      icon: newPayType === 'upi' ? 'cellphone-wireless' : 'credit-card',
    };

    setPaymentMethods((prev) => [newMethod, ...prev]);
    setIsAddPaymentOpen(false);
    setNewPayTitle('');
    setNewPayValue('');

    Alert.alert(
      language === 'ta' ? 'சேர்க்கப்பட்டது' : 'Payment Method Added',
      language === 'ta' ? 'புதிய கட்டண முறை சேர்க்கப்பட்டது.' : 'Your payment method has been saved.'
    );
  };

  // Call Kisan Helpline
  const handleCallHelpline = () => {
    const phoneNumber = 'tel:18004251555';
    Linking.canOpenURL(phoneNumber)
      .then((supported) => {
        if (supported) {
          Linking.openURL(phoneNumber);
        } else {
          Alert.alert(
            'Kisan Call Centre Hotline',
            'Toll-Free Agricultural Support:\n1800-425-1555\n(Available 6 AM - 10 PM daily in Tamil)'
          );
        }
      })
      .catch(() => {
        Alert.alert(
          'Kisan Call Centre Hotline',
          'Toll-Free Support: 1800-425-1555 (All Tamil Nadu Farming Districts)'
        );
      });
  };

  // Logout Handler
  const handleLogout = () => {
    Alert.alert(
      language === 'ta' ? 'வெளியேறு' : 'Logout of FarmKart',
      language === 'ta'
        ? 'நிச்சயமாக வெளியேற விரும்புகிறீர்களா?'
        : 'Are you sure you want to log out of FarmKart?',
      [
        { text: language === 'ta' ? 'ரத்து' : 'Cancel', style: 'cancel' },
        {
          text: language === 'ta' ? 'வெளியேறு' : 'Logout',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/(auth)/login');
          },
        },
      ]
    );
  };

  const FAQS = [
    {
      qEn: 'What is the 50 km delivery rule?',
      qTa: '50 கி.மீ விநியோக விதிமுறை என்றால் என்ன?',
      aEn: 'To guarantee maximum farm freshness and fair transportation costs, FarmKart only delivers produce from farmers located within 50 km of your address. This prevents produce wilting and avoids middlemen markups.',
      aTa: 'விளைபொருட்களின் புத்துணர்ச்சியை உறுதி செய்யவும், போக்குவரத்து கட்டணத்தை குறைக்கவும், உங்கள் முகவரியிலிருந்து 50 கி.மீ சுற்றளவுக்குள் உள்ள பண்ணைகளில் இருந்து மட்டுமே விநியோகம் செய்யப்படுகிறது.',
    },
    {
      qEn: 'How are direct Mandi prices calculated?',
      qTa: 'மண்டி மொத்த விலை எவ்வாறு நிர்ணயிக்கப்படுகிறது?',
      aEn: 'Prices are set directly by local Tamil Nadu farmers in sync with daily agricultural marketing committee rates. There are zero broker commissions or wholesale cuts.',
      aTa: 'தமிழக உழவர் சந்தைகளின் தினசரி சந்தை நிலவரப்படி விவசாயிகளால் நேரடியாக விலை நிர்ணயிக்கப்படுகிறது. இடைத்தரகர் கமிஷன் எதுவும் இல்லை.',
    },
    {
      qEn: 'How does bulk tractor and tipper delivery work?',
      qTa: 'டிராக்டர் மற்றும் மொத்த லோடு விநியோகம் எவ்வாறு செயல்படுகிறது?',
      aEn: 'For heavy agricultural commodities like A2 Cow Dung Manure (Mattu Eruvu) and Paddy Straw (Vaikkol), our logistics team dispatches mini trucks or tractor tippers. Driver contact details and vehicle numbers are shared directly upon dispatch.',
      aTa: 'மாட்டு எருவு மற்றும் வைக்கோல் போன்ற பெரிய அளவிலான பொருட்களுக்கு மினி லாரி அல்லது டிராக்டர் மூலம் விநியோகம் செய்யப்படுகிறது. ஓட்டுநர் தொடர்பு விபரம் பகிரப்படும்.',
    },
    {
      qEn: 'What if I need to cancel or return produce?',
      qTa: 'ஆர்டரை ரத்து செய்ய அல்லது திரும்ப அளிக்க முடியுமா?',
      aEn: 'You can cancel an order free of charge before harvest packing. Delivered orders can be returned upon delivery inspection if quality does not match mandi standards.',
      aTa: 'விளைபொருள் அறுவடைக்கு முன் இலவசமாக ரத்து செய்யலாம். விநியோகத்தின் போது தரம் திருப்தி அளிக்கவில்லை எனில் திரும்ப அளிக்கலாம்.',
    },
  ];

  return (
    <View style={styles.screen}>
      <AppHeader
        title={language === 'ta' ? 'என் சுயவிவரம்' : 'My Profile'}
        cartCount={getTotalCount()}
        onCartPress={() => router.push('/(buyer)/(tabs)/cart')}
        onSearchPress={() => router.push('/(buyer)/products')}
      />

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}>
        {/* User Card */}
        <Card style={styles.userCard}>
          <View style={styles.userRow}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>
                {userName
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase()}
              </Text>
              <Pressable
                style={styles.avatarEditBadge}
                onPress={() => setIsEditProfileOpen(true)}>
                <MaterialCommunityIcons name="pencil" size={12} color={colors.white} />
              </Pressable>
            </View>

            <View style={styles.userInfoCol}>
              <View style={styles.userNameRow}>
                <Text style={styles.userName}>{userName}</Text>
                <Pressable onPress={() => setIsEditProfileOpen(true)} hitSlop={6}>
                  <Text style={styles.editBtnText}>
                    {language === 'ta' ? 'திருத்து' : 'Edit'}
                  </Text>
                </Pressable>
              </View>
              <Text style={styles.userContact}>{userPhone}</Text>
              <Text style={styles.userEmail}>{userEmail}</Text>

              <View style={styles.activeLocationPill}>
                <MaterialCommunityIcons
                  name="map-marker"
                  size={12}
                  color={colors.primaryDark}
                />
                <Text style={styles.activeLocationText} numberOfLines={1}>
                  {currentLocation.name}
                </Text>
              </View>
            </View>
          </View>

          {/* Stat Badges Strip */}
          <View style={styles.statStrip}>
            <Pressable
              style={styles.statBox}
              onPress={() => router.push('/(buyer)/(tabs)/orders')}>
              <Text style={styles.statValue}>{orders.length}</Text>
              <Text style={styles.statLabel}>
                {language === 'ta' ? 'ஆர்டர்கள்' : 'Orders'}
              </Text>
            </Pressable>
            <View style={styles.statDivider} />
            <Pressable
              style={styles.statBox}
              onPress={() => router.push('/(buyer)/wishlist')}>
              <Text style={styles.statValue}>{wishlistItems.length}</Text>
              <Text style={styles.statLabel}>
                {language === 'ta' ? 'விருப்பங்கள்' : 'Wishlist'}
              </Text>
            </Pressable>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{savedAddresses.length}</Text>
              <Text style={styles.statLabel}>
                {language === 'ta' ? 'முகவரிகள்' : 'Addresses'}
              </Text>
            </View>
          </View>
        </Card>

        {/* Quick Nav Shortcuts */}
        <View style={styles.quickNavRow}>
          <Pressable
            style={styles.quickNavTile}
            onPress={() => router.push('/(buyer)/wishlist')}>
            <View style={[styles.quickNavIconBg, { backgroundColor: '#FCE4EC' }]}>
              <MaterialCommunityIcons name="heart" size={20} color="#E91E63" />
            </View>
            <View>
              <Text style={styles.quickNavTitle}>
                {language === 'ta' ? 'விருப்பப்பட்டியல்' : 'Wishlist'}
              </Text>
              <Text style={styles.quickNavSubtitle}>
                {wishlistItems.length} {language === 'ta' ? 'பொருட்கள்' : 'saved crops'}
              </Text>
            </View>
          </Pressable>

          <Pressable
            style={styles.quickNavTile}
            onPress={() => router.push('/(buyer)/notifications')}>
            <View style={[styles.quickNavIconBg, { backgroundColor: '#E3F2FD' }]}>
              <MaterialCommunityIcons name="bell" size={20} color="#1976D2" />
            </View>
            <View>
              <Text style={styles.quickNavTitle}>
                {language === 'ta' ? 'அறிவிப்புகள்' : 'Notifications'}
              </Text>
              <Text style={styles.quickNavSubtitle}>
                {language === 'ta' ? 'விநியோக தகவல்' : 'Mandi alerts'}
              </Text>
            </View>
          </Pressable>
        </View>

        {/* 1. Saved Delivery Addresses */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionTitleGroup}>
              <View style={[styles.sectionIconBg, { backgroundColor: '#E8F5E9' }]}>
                <MaterialCommunityIcons
                  name="map-marker-multiple"
                  size={18}
                  color={colors.primaryDark}
                />
              </View>
              <Text style={styles.sectionTitle}>
                {language === 'ta' ? 'சேமிக்கப்பட்ட முகவரிகள்' : 'Saved Addresses'}
              </Text>
            </View>

            <Pressable
              onPress={() => setIsAddAddressOpen(true)}
              style={styles.actionPillBtn}>
              <MaterialCommunityIcons name="plus" size={14} color={colors.primaryDark} />
              <Text style={styles.actionPillBtnText}>
                {language === 'ta' ? 'புதிய முகவரி' : 'Add New'}
              </Text>
            </Pressable>
          </View>

          <View style={styles.addressesList}>
            {savedAddresses.map((addr) => {
              const isActive =
                currentLocation.address === addr.address ||
                currentLocation.name === addr.name;

              return (
                <Pressable
                  key={addr.id || addr.address}
                  onPress={() => setLocation(addr)}
                  style={[
                    styles.addressItem,
                    isActive && styles.addressItemActive,
                  ]}>
                  <View style={styles.addressLeftCol}>
                    <View style={styles.addressHeaderRow}>
                      <Text style={styles.addressName}>
                        {language === 'ta' && addr.nameTamil ? addr.nameTamil : addr.name}
                      </Text>
                      {isActive && (
                        <View style={styles.activePill}>
                          <Text style={styles.activePillText}>
                            {language === 'ta' ? 'தற்போதையது' : 'ACTIVE'}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.addressText} numberOfLines={2}>
                      {addr.address}
                    </Text>
                  </View>

                  <View style={styles.addressActionsRow}>
                    <Pressable
                      onPress={() => handleDeleteAddress(addr)}
                      hitSlop={8}
                      style={styles.deleteAddrBtn}>
                      <MaterialCommunityIcons
                        name="trash-can-outline"
                        size={18}
                        color={colors.textSecondary}
                      />
                    </Pressable>
                    <MaterialCommunityIcons
                      name={isActive ? 'radiobox-marked' : 'radiobox-blank'}
                      size={20}
                      color={isActive ? colors.primary : colors.border}
                    />
                  </View>
                </Pressable>
              );
            })}
          </View>
        </Card>

        {/* 2. Payment Methods */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionTitleGroup}>
              <View style={[styles.sectionIconBg, { backgroundColor: '#FFF3E0' }]}>
                <MaterialCommunityIcons
                  name="credit-card-settings-outline"
                  size={18}
                  color={colors.accent}
                />
              </View>
              <Text style={styles.sectionTitle}>
                {language === 'ta' ? 'கட்டண முறைகள்' : 'Payment Methods'}
              </Text>
            </View>

            <Pressable
              onPress={() => setIsAddPaymentOpen(true)}
              style={styles.actionPillBtn}>
              <MaterialCommunityIcons name="plus" size={14} color={colors.primaryDark} />
              <Text style={styles.actionPillBtnText}>
                {language === 'ta' ? 'சேர்' : 'Add'}
              </Text>
            </Pressable>
          </View>

          {/* COD Default Switch */}
          <View style={styles.codSettingRow}>
            <View style={styles.codSettingTextCol}>
              <Text style={styles.codSettingTitle}>
                {language === 'ta'
                  ? 'பொருளைப் பெற்றவுடன் ரொக்கம் (COD)'
                  : 'Cash on Delivery (COD)'}
              </Text>
              <Text style={styles.codSettingDesc}>
                {language === 'ta'
                  ? 'விளைபொருள் வரும்போது பணம் செலுத்த முன்னுரிமை'
                  : 'Prefer paying cash to the driver upon delivery'}
              </Text>
            </View>
            <Switch
              value={codDefaultEnabled}
              onValueChange={setCodDefaultEnabled}
              trackColor={{ false: '#E0E0E0', true: colors.primaryLight }}
              thumbColor={codDefaultEnabled ? colors.primary : '#F5F5F5'}
            />
          </View>

          <View style={styles.divider} />

          {/* Saved UPI & Cards */}
          <View style={styles.paymentMethodsList}>
            {paymentMethods.map((pm) => (
              <View key={pm.id} style={styles.paymentItem}>
                <View style={styles.paymentIconCircle}>
                  <MaterialCommunityIcons
                    name={pm.icon as any}
                    size={20}
                    color={colors.primaryDark}
                  />
                </View>
                <View style={styles.paymentTextCol}>
                  <View style={styles.paymentTitleRow}>
                    <Text style={styles.paymentTitle}>{pm.title}</Text>
                    {pm.isDefault && (
                      <View style={styles.defaultPill}>
                        <Text style={styles.defaultPillText}>DEFAULT</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.paymentSubtitle}>{pm.subtitle}</Text>
                </View>
              </View>
            ))}
          </View>
        </Card>

        {/* 3. Language Switch (English / Tamil) */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionTitleGroup}>
              <View style={[styles.sectionIconBg, { backgroundColor: '#EDE7F6' }]}>
                <MaterialCommunityIcons name="translate" size={18} color="#5E35B1" />
              </View>
              <Text style={styles.sectionTitle}>
                {language === 'ta' ? 'பயன்பாட்டு மொழி' : 'App Language'}
              </Text>
            </View>
          </View>

          <View style={styles.langSelectorRow}>
            <Pressable
              onPress={() => setLanguage('en')}
              style={[
                styles.langOptionBtn,
                language === 'en' && styles.langOptionBtnActive,
              ]}>
              <Text
                style={[
                  styles.langOptionText,
                  language === 'en' && styles.langOptionTextActive,
                ]}>
                English
              </Text>
              {language === 'en' && (
                <MaterialCommunityIcons
                  name="check-circle"
                  size={16}
                  color={colors.primary}
                />
              )}
            </Pressable>

            <Pressable
              onPress={() => setLanguage('ta')}
              style={[
                styles.langOptionBtn,
                language === 'ta' && styles.langOptionBtnActive,
              ]}>
              <Text
                style={[
                  styles.langOptionText,
                  language === 'ta' && styles.langOptionTextActive,
                ]}>
                தமிழ் (Tamil)
              </Text>
              {language === 'ta' && (
                <MaterialCommunityIcons
                  name="check-circle"
                  size={16}
                  color={colors.primary}
                />
              )}
            </Pressable>
          </View>
        </Card>

        {/* 4. Help & Support / Kisan Helpline */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionTitleGroup}>
              <View style={[styles.sectionIconBg, { backgroundColor: '#E0F2F1' }]}>
                <MaterialCommunityIcons
                  name="face-agent"
                  size={18}
                  color="#00796B"
                />
              </View>
              <Text style={styles.sectionTitle}>
                {language === 'ta' ? 'உதவி & ஆதரவு' : 'Help & Farmer Support'}
              </Text>
            </View>
          </View>

          {/* Kisan Call Centre Banner */}
          <Pressable style={styles.helplineBanner} onPress={handleCallHelpline}>
            <View style={styles.helplineIconCircle}>
              <MaterialCommunityIcons name="phone-classic" size={24} color={colors.white} />
            </View>
            <View style={styles.helplineTextCol}>
              <Text style={styles.helplineTitle}>
                {language === 'ta'
                  ? 'கிசான் உதவி மையம் (Kisan Helpline)'
                  : '24x7 Kisan Call Centre'}
              </Text>
              <Text style={styles.helplinePhone}>Toll-Free: 1800-425-1555</Text>
              <Text style={styles.helplineSubtitle}>
                {language === 'ta'
                  ? 'தமிழ்நாடு வேளாண்மை & மண்டி ஆதரவு'
                  : 'Direct Tamil assistance for farm orders & mandi logistics'}
              </Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={22} color={colors.white} />
          </Pressable>

          {/* FAQs Accordion */}
          <Text style={styles.faqHeading}>
            {language === 'ta' ? 'அடிக்கடி கேட்கப்படும் கேள்விகள்' : 'Frequently Asked Questions'}
          </Text>

          <View style={styles.faqList}>
            {FAQS.map((faq, index) => {
              const isOpen = expandedFaq === index;
              return (
                <View key={index} style={styles.faqItem}>
                  <Pressable
                    onPress={() => toggleFaq(index)}
                    style={styles.faqQuestionRow}>
                    <Text style={styles.faqQuestionText}>
                      {language === 'ta' ? faq.qTa : faq.qEn}
                    </Text>
                    <MaterialCommunityIcons
                      name={isOpen ? 'chevron-up' : 'chevron-down'}
                      size={20}
                      color={colors.textSecondary}
                    />
                  </Pressable>
                  {isOpen && (
                    <Text style={styles.faqAnswerText}>
                      {language === 'ta' ? faq.aTa : faq.aEn}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        </Card>

        {/* Switch Role Card */}
        <Card style={styles.switchRoleCard}>
          <Pressable
            style={styles.switchRolePressable}
            onPress={() => router.push('/(auth)/role-select')}>
            <View style={[styles.sectionIconBg, { backgroundColor: colors.primaryLight }]}>
              <MaterialCommunityIcons name="tractor" size={22} color={colors.primaryDark} />
            </View>
            <View style={styles.switchRoleTextCol}>
              <Text style={styles.switchRoleTitle}>
                {language === 'ta' ? 'விவசாயி கணக்கிற்கு மாறவும்' : 'Switch to Farmer / Seller Mode'}
              </Text>
              <Text style={styles.switchRoleDesc}>
                {language === 'ta'
                  ? 'பயிர்களை நேரடியாக பட்டியலிட்டு விற்பனை செய்யவும்'
                  : 'List crops, set farm-gate prices, and fulfill wholesale orders'}
              </Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textSecondary} />
          </Pressable>
        </Card>

        {/* Logout Button */}
        <Card style={styles.logoutCard}>
          <Pressable style={styles.logoutBtn} onPress={handleLogout}>
            <MaterialCommunityIcons name="logout" size={20} color={colors.error} />
            <Text style={styles.logoutBtnText}>
              {language === 'ta' ? 'கணக்கிலிருந்து வெளியேறு' : 'Logout of FarmKart'}
            </Text>
          </Pressable>
        </Card>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal
        visible={isEditProfileOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsEditProfileOpen(false)}>
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setIsEditProfileOpen(false)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>
              {language === 'ta' ? 'சுயவிவரத்தை திருத்து' : 'Edit Profile'}
            </Text>

            <Text style={styles.modalInputLabel}>Full Name</Text>
            <TextInput
              style={styles.modalInput}
              value={userName}
              onChangeText={setUserName}
              placeholder="Enter your name"
            />

            <Text style={styles.modalInputLabel}>Phone Number</Text>
            <TextInput
              style={styles.modalInput}
              value={userPhone}
              onChangeText={setUserPhone}
              keyboardType="phone-pad"
              placeholder="+91 Phone number"
            />

            <Text style={styles.modalInputLabel}>Email Address</Text>
            <TextInput
              style={styles.modalInput}
              value={userEmail}
              onChangeText={setUserEmail}
              keyboardType="email-address"
              placeholder="Email address"
            />

            <View style={styles.modalBtnRow}>
              <Pressable
                style={styles.modalCancelBtn}
                onPress={() => setIsEditProfileOpen(false)}>
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={styles.modalSaveBtn}
                onPress={() => {
                  setIsEditProfileOpen(false);
                  Alert.alert('Profile Updated', 'Your profile details have been saved.');
                }}>
                <Text style={styles.modalSaveBtnText}>Save Changes</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Add Address Modal */}
      <Modal
        visible={isAddAddressOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsAddAddressOpen(false)}>
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setIsAddAddressOpen(false)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>
              {language === 'ta' ? 'புதிய முகவரி சேர்க்க' : 'Add Delivery Address'}
            </Text>

            <View style={styles.labelPickerRow}>
              {['Home', 'Work', 'Farm Office'].map((lbl) => (
                <Pressable
                  key={lbl}
                  onPress={() => setNewAddrLabel(lbl)}
                  style={[
                    styles.labelPickerChip,
                    newAddrLabel === lbl && styles.labelPickerChipActive,
                  ]}>
                  <Text
                    style={[
                      styles.labelPickerChipText,
                      newAddrLabel === lbl && styles.labelPickerChipTextActive,
                    ]}>
                    {lbl}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.modalInputLabel}>Street / Door No.</Text>
            <TextInput
              style={styles.modalInput}
              value={newAddrStreet}
              onChangeText={setNewAddrStreet}
              placeholder="e.g. 14, Periyar Salai, 2nd Cross"
            />

            <Text style={styles.modalInputLabel}>Locality / Area / Village</Text>
            <TextInput
              style={styles.modalInput}
              value={newAddrArea}
              onChangeText={setNewAddrArea}
              placeholder="e.g. Thirunagar / Vadipatti"
            />

            <View style={styles.rowTwoCols}>
              <View style={styles.col}>
                <Text style={styles.modalInputLabel}>City</Text>
                <TextInput
                  style={styles.modalInput}
                  value={newAddrCity}
                  onChangeText={setNewAddrCity}
                />
              </View>
              <View style={styles.col}>
                <Text style={styles.modalInputLabel}>Pincode</Text>
                <TextInput
                  style={styles.modalInput}
                  value={newAddrPincode}
                  onChangeText={setNewAddrPincode}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={styles.modalBtnRow}>
              <Pressable
                style={styles.modalCancelBtn}
                onPress={() => setIsAddAddressOpen(false)}>
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalSaveBtn} onPress={handleSaveAddress}>
                <Text style={styles.modalSaveBtnText}>Save Address</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Add Payment Modal */}
      <Modal
        visible={isAddPaymentOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsAddPaymentOpen(false)}>
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setIsAddPaymentOpen(false)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>
              {language === 'ta' ? 'கட்டண முறை சேர்க்க' : 'Add Payment Method'}
            </Text>

            <View style={styles.labelPickerRow}>
              <Pressable
                onPress={() => setNewPayType('upi')}
                style={[
                  styles.labelPickerChip,
                  newPayType === 'upi' && styles.labelPickerChipActive,
                ]}>
                <Text
                  style={[
                    styles.labelPickerChipText,
                    newPayType === 'upi' && styles.labelPickerChipTextActive,
                  ]}>
                  UPI ID (VPA)
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setNewPayType('card')}
                style={[
                  styles.labelPickerChip,
                  newPayType === 'card' && styles.labelPickerChipActive,
                ]}>
                <Text
                  style={[
                    styles.labelPickerChipText,
                    newPayType === 'card' && styles.labelPickerChipTextActive,
                  ]}>
                  Debit / Kisan Card
                </Text>
              </Pressable>
            </View>

            <Text style={styles.modalInputLabel}>
              {newPayType === 'upi' ? 'App / Bank Name' : 'Cardholder Name'}
            </Text>
            <TextInput
              style={styles.modalInput}
              value={newPayTitle}
              onChangeText={setNewPayTitle}
              placeholder={newPayType === 'upi' ? 'e.g. BHIM UPI / Paytm' : 'e.g. Karthik V'}
            />

            <Text style={styles.modalInputLabel}>
              {newPayType === 'upi' ? 'UPI ID' : 'Card Number'}
            </Text>
            <TextInput
              style={styles.modalInput}
              value={newPayValue}
              onChangeText={setNewPayValue}
              placeholder={newPayType === 'upi' ? 'e.g. username@bank' : '16-digit card number'}
              keyboardType={newPayType === 'upi' ? 'email-address' : 'numeric'}
            />

            <View style={styles.modalBtnRow}>
              <Pressable
                style={styles.modalCancelBtn}
                onPress={() => setIsAddPaymentOpen(false)}>
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalSaveBtn} onPress={handleSavePayment}>
                <Text style={styles.modalSaveBtnText}>Save Payment</Text>
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
  container: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xxl + 30,
  },
  userCard: {
    padding: spacing.md,
    borderRadius: 16,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  avatarText: {
    color: colors.white,
    fontSize: fontSizes.xl,
    fontWeight: '800',
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: colors.accent,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.white,
  },
  userInfoCol: {
    flex: 1,
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  userName: {
    fontSize: fontSizes.lg,
    fontWeight: '800',
    color: colors.text,
  },
  editBtnText: {
    fontSize: fontSizes.xs + 1,
    fontWeight: '700',
    color: colors.primary,
  },
  userContact: {
    fontSize: fontSizes.xs + 1,
    color: colors.textSecondary,
    marginTop: 1,
  },
  userEmail: {
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
  },
  activeLocationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  activeLocationText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  statStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  statBox: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: fontSizes.md + 2,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  statLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: colors.border,
  },
  quickNavRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  quickNavTile: {
    flex: 1,
    backgroundColor: colors.surface,
    padding: spacing.sm + 2,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickNavIconBg: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickNavTitle: {
    fontSize: fontSizes.sm,
    fontWeight: '700',
    color: colors.text,
  },
  quickNavSubtitle: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  sectionCard: {
    padding: spacing.md,
    borderRadius: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  sectionTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
  sectionIconBg: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: fontSizes.md,
    fontWeight: '700',
    color: colors.text,
  },
  actionPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: colors.primaryLight,
  },
  actionPillBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  addressesList: {
    gap: spacing.xs,
  },
  addressItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.sm + 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#FAFAFA',
  },
  addressItemActive: {
    borderColor: colors.primary,
    backgroundColor: '#F7FCF6',
  },
  addressLeftCol: {
    flex: 1,
    marginRight: spacing.sm,
  },
  addressHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  addressName: {
    fontSize: fontSizes.sm,
    fontWeight: '700',
    color: colors.text,
  },
  activePill: {
    backgroundColor: colors.primary,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  activePillText: {
    color: colors.white,
    fontSize: 9,
    fontWeight: '800',
  },
  addressText: {
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  addressActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  deleteAddrBtn: {
    padding: 2,
  },
  codSettingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  codSettingTextCol: {
    flex: 1,
    marginRight: spacing.sm,
  },
  codSettingTitle: {
    fontSize: fontSizes.sm,
    fontWeight: '700',
    color: colors.text,
  },
  codSettingDesc: {
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  paymentMethodsList: {
    gap: spacing.xs,
  },
  paymentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs + 2,
  },
  paymentIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentTextCol: {
    flex: 1,
  },
  paymentTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  paymentTitle: {
    fontSize: fontSizes.sm,
    fontWeight: '700',
    color: colors.text,
  },
  defaultPill: {
    backgroundColor: colors.accentLight,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  defaultPillText: {
    color: colors.accent,
    fontSize: 8,
    fontWeight: '800',
  },
  paymentSubtitle: {
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
    marginTop: 1,
  },
  langSelectorRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  langOptionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: '#FAFAFA',
    gap: 6,
  },
  langOptionBtnActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  langOptionText: {
    fontSize: fontSizes.sm + 1,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  langOptionTextActive: {
    color: colors.primaryDark,
    fontWeight: '800',
  },
  helplineBanner: {
    backgroundColor: colors.primaryDark,
    borderRadius: 12,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    marginTop: spacing.xs,
  },
  helplineIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  helplineTextCol: {
    flex: 1,
  },
  helplineTitle: {
    color: colors.white,
    fontSize: fontSizes.sm + 1,
    fontWeight: '700',
  },
  helplinePhone: {
    color: colors.accentLight,
    fontSize: fontSizes.sm,
    fontWeight: '800',
    marginTop: 2,
  },
  helplineSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 10,
    marginTop: 2,
  },
  faqHeading: {
    fontSize: fontSizes.sm + 1,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  faqList: {
    gap: spacing.xs,
  },
  faqItem: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: spacing.sm,
  },
  faqQuestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  faqQuestionText: {
    fontSize: fontSizes.sm,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
    marginRight: 6,
  },
  faqAnswerText: {
    fontSize: fontSizes.xs + 1,
    color: colors.textSecondary,
    lineHeight: 18,
    marginTop: 6,
    paddingHorizontal: 2,
  },
  switchRoleCard: {
    padding: 0,
    overflow: 'hidden',
  },
  switchRolePressable: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.sm,
  },
  switchRoleTextCol: {
    flex: 1,
  },
  switchRoleTitle: {
    fontSize: fontSizes.sm + 1,
    fontWeight: '700',
    color: colors.text,
  },
  switchRoleDesc: {
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  logoutCard: {
    padding: 0,
    overflow: 'hidden',
    marginTop: spacing.xs,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    gap: spacing.xs,
    backgroundColor: '#FFEBEE',
  },
  logoutBtnText: {
    fontSize: fontSizes.sm + 1,
    fontWeight: '700',
    color: colors.error,
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
    fontSize: fontSizes.md + 2,
    fontWeight: '800',
    color: colors.text,
    marginBottom: spacing.md,
  },
  modalInputLabel: {
    fontSize: fontSizes.xs + 1,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 4,
    marginTop: 8,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: fontSizes.sm,
    color: colors.text,
    backgroundColor: '#FAFAFA',
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
  },
  modalCancelBtnText: {
    fontSize: fontSizes.sm,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  modalSaveBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: colors.primaryDark,
    alignItems: 'center',
  },
  modalSaveBtnText: {
    fontSize: fontSizes.sm,
    fontWeight: '700',
    color: colors.white,
  },
  labelPickerRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  labelPickerChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#F5F5F5',
  },
  labelPickerChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  labelPickerChipText: {
    fontSize: fontSizes.xs,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  labelPickerChipTextActive: {
    color: colors.primaryDark,
    fontWeight: '700',
  },
  rowTwoCols: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  col: {
    flex: 1,
  },
});
