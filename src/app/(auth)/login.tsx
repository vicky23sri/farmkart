/**
 * Login & Register Screen
 * Modern Authentication flow:
 * - Email / Mobile & Password Login
 * - New Account Registration with Role Selection (Buyer / Farmer)
 * - Google Sign-In (token verified by the server)
 */

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/AppHeader';
import { Card } from '@/components/Card';
import { PrimaryButton } from '@/components/PrimaryButton';
import { authService } from '@/services/authService';
import { isGoogleSignInConfigured, signInWithGoogle } from '@/services/googleSignIn';
import { useAuthStore, useLanguageStore } from '@/store';
import { colors, fontSizes, spacing } from '@/theme';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const { login } = useAuthStore();
  const { language } = useLanguageStore();

  // Mode: 'login' or 'register'
  const [tab, setTab] = useState<'login' | 'register'>('login');

  // Login form state
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);

  // Register form state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regMobile, setRegMobile] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [regRole, setRegRole] = useState<'buyer' | 'seller'>('buyer');
  const [regLoading, setRegLoading] = useState(false);

  const [googleLoading, setGoogleLoading] = useState(false);

  // Handle successful authentication
  const handleAuthSuccess = async (token: string, role?: 'buyer' | 'seller' | null) => {
    if (role === 'buyer') {
      await login(token, 'buyer');
      router.replace('/(buyer)/(tabs)');
    } else if (role === 'seller') {
      await login(token, 'seller');
      router.replace('/(seller)/(tabs)');
    } else {
      await login(token);
      router.push('/(auth)/role-select');
    }
  };

  // 1. Password Login
  const handleLogin = async () => {
    if (!loginIdentifier.trim()) {
      Alert.alert(
        language === 'ta' ? 'தேவைப்படுகிறது' : 'Required',
        language === 'ta'
          ? 'மின்னஞ்சல் அல்லது மொபைல் எண்ணை உள்ளிடவும்.'
          : 'Please enter your email or mobile number.'
      );
      return;
    }
    if (!loginPassword) {
      Alert.alert(
        language === 'ta' ? 'தேவைப்படுகிறது' : 'Required',
        language === 'ta' ? 'கடவுச்சொல்லை உள்ளிடவும்.' : 'Please enter your password.'
      );
      return;
    }

    setLoginLoading(true);
    try {
      const res = await authService.loginWithPassword({
        emailOrMobile: loginIdentifier,
        password: loginPassword,
      });
      setLoginLoading(false);

      if (res.success && res.token) {
        await handleAuthSuccess(res.token, res.role);
      } else {
        Alert.alert(
          language === 'ta' ? 'உள்நுழைவு தோல்வி' : 'Login Failed',
          res.message || 'Invalid email or password.'
        );
      }
    } catch {
      setLoginLoading(false);
      Alert.alert('Error', 'Failed to connect to authentication service.');
    }
  };

  // 2. Registration
  const handleRegister = async () => {
    if (!regName.trim()) {
      Alert.alert(
        language === 'ta' ? 'தேவைப்படுகிறது' : 'Required',
        language === 'ta' ? 'உங்கள் பெயரை உள்ளிடவும்.' : 'Please enter your full name.'
      );
      return;
    }
    if (!regEmail.trim() || !regEmail.includes('@')) {
      Alert.alert(
        language === 'ta' ? 'தவறான மின்னஞ்சல்' : 'Invalid Email',
        language === 'ta'
          ? 'சரியான மின்னஞ்சல் முகவரியை உள்ளிடவும்.'
          : 'Please enter a valid email address.'
      );
      return;
    }
    if (!regPassword || regPassword.length < 8) {
      Alert.alert(
        language === 'ta' ? 'எளிய கடவுச்சொல்' : 'Weak Password',
        language === 'ta'
          ? 'கடவுச்சொல் குறைந்தது 8 எழுத்துகள் இருக்க வேண்டும்.'
          : 'Password must be at least 8 characters.'
      );
      return;
    }
    if (regMobile.trim() && !/^[6-9]\d{9}$/.test(regMobile.trim())) {
      Alert.alert(
        language === 'ta' ? 'தவறான மொபைல் எண்' : 'Invalid Mobile Number',
        language === 'ta'
          ? '6-9 இல் தொடங்கும் 10 இலக்க மொபைல் எண்ணை உள்ளிடவும்.'
          : 'Enter a 10-digit Indian mobile number starting with 6-9.'
      );
      return;
    }

    setRegLoading(true);
    try {
      const res = await authService.register({
        name: regName.trim(),
        email: regEmail.trim(),
        mobile: regMobile.trim() || undefined,
        password: regPassword,
        role: regRole,
      });
      setRegLoading(false);

      if (res.success && res.token) {
        Alert.alert(
          language === 'ta' ? 'வெற்றி' : 'Success',
          language === 'ta'
            ? 'உங்கள் கணக்கு வெற்றிகரமாக உருவாக்கப்பட்டது!'
            : 'Your account has been created successfully!'
        );
        await handleAuthSuccess(res.token, regRole);
      } else {
        Alert.alert(
          language === 'ta' ? 'பதிவு தோல்வி' : 'Registration Failed',
          res.message || 'Could not register account.'
        );
      }
    } catch {
      setRegLoading(false);
      Alert.alert('Error', 'Failed to connect to registration service.');
    }
  };

  // 3. Google Sign-In: get a Google token (native picker / web popup) and let the server verify it
  const handleGooglePress = async () => {
    if (!isGoogleSignInConfigured || googleLoading) return;
    try {
      setGoogleLoading(true);
      const credential = await signInWithGoogle();
      if (!credential) return; // user cancelled

      const authRes = await authService.googleAuth({
        ...credential,
        role: tab === 'register' ? regRole : undefined,
      });
      if (authRes.success && authRes.token) {
        await handleAuthSuccess(authRes.token, authRes.role);
      } else {
        Alert.alert('Google sign-in failed', authRes.message || 'Please try again.');
      }
    } catch (err: any) {
      Alert.alert('Google sign-in failed', err?.message || 'Please try again.');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <AppHeader
        title="FarmKart"
        showBack={false}
        showSearch={false}
        showCart={false}
        showNotifications={false}
        showLanguageToggle
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {/* Logo & Welcome Header */}
          <View style={styles.headerSection}>
            <View style={styles.logoBadge}>
              <MaterialCommunityIcons name="sprout" size={36} color={colors.primary} />
            </View>
            <Text style={styles.mainTitle}>
              {tab === 'login'
                ? language === 'ta'
                  ? 'வணக்கம்! மீண்டும் வருக'
                  : 'Welcome to FarmKart'
                : language === 'ta'
                ? 'புதிய கணக்கை தொடங்குங்கள்'
                : 'Join FarmKart Today'}
            </Text>
            <Text style={styles.subText}>
              {language === 'ta'
                ? 'விவசாயிகளிடமிருந்து நேரடியாக வாங்குங்கள் அல்லது விற்கவும்.'
                : 'Direct Farm-to-Door marketplace connecting farmers & buyers.'}
            </Text>
          </View>

          {/* Tab Selector: Login vs Register */}
          <View style={styles.tabContainer}>
            <Pressable
              style={[styles.tabButton, tab === 'login' && styles.tabButtonActive]}
              onPress={() => setTab('login')}>
              <MaterialCommunityIcons
                name="login-variant"
                size={18}
                color={tab === 'login' ? colors.white : colors.textSecondary}
              />
              <Text
                style={[styles.tabText, tab === 'login' && styles.tabTextActive]}>
                {language === 'ta' ? 'உள்நுழைக' : 'Sign In'}
              </Text>
            </Pressable>

            <Pressable
              style={[styles.tabButton, tab === 'register' && styles.tabButtonActive]}
              onPress={() => setTab('register')}>
              <MaterialCommunityIcons
                name="account-plus-outline"
                size={18}
                color={tab === 'register' ? colors.white : colors.textSecondary}
              />
              <Text
                style={[styles.tabText, tab === 'register' && styles.tabTextActive]}>
                {language === 'ta' ? 'பதிவு செய்க' : 'Register'}
              </Text>
            </Pressable>
          </View>

          {/* Form Card */}
          <Card style={styles.card}>
            {tab === 'login' ? (
              /* ================= LOGIN FORM ================= */
              <View>
                <Text style={styles.fieldLabel}>
                  {language === 'ta' ? 'மின்னஞ்சல் அல்லது மொபைல்' : 'Email or Mobile Number'}
                </Text>
                <View style={styles.inputRow}>
                  <MaterialCommunityIcons
                    name="account-outline"
                    size={20}
                    color={colors.textSecondary}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.textInput}
                    placeholder="karthik@example.com or 9876543210"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="none"
                    value={loginIdentifier}
                    onChangeText={setLoginIdentifier}
                  />
                </View>

                <Text style={styles.fieldLabel}>
                  {language === 'ta' ? 'கடவுச்சொல்' : 'Password'}
                </Text>
                <View style={styles.inputRow}>
                  <MaterialCommunityIcons
                    name="lock-outline"
                    size={20}
                    color={colors.textSecondary}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.textInput}
                    placeholder="••••••••"
                    placeholderTextColor={colors.textMuted}
                    secureTextEntry={!showLoginPassword}
                    value={loginPassword}
                    onChangeText={setLoginPassword}
                  />
                  <Pressable
                    onPress={() => setShowLoginPassword(!showLoginPassword)}
                    style={styles.eyeBtn}>
                    <MaterialCommunityIcons
                      name={showLoginPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color={colors.textSecondary}
                    />
                  </Pressable>
                </View>

                <PrimaryButton
                  title={language === 'ta' ? 'உள்நுழைக' : 'Sign In'}
                  icon="login"
                  loading={loginLoading}
                  onPress={handleLogin}
                  style={styles.submitBtn}
                />
              </View>
            ) : (
              /* ================= REGISTER FORM ================= */
              <View>
                <Text style={styles.fieldLabel}>
                  {language === 'ta' ? 'முழு பெயர்' : 'Full Name'}
                </Text>
                <View style={styles.inputRow}>
                  <MaterialCommunityIcons
                    name="account-outline"
                    size={20}
                    color={colors.textSecondary}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.textInput}
                    placeholder="e.g. Vignesh Kumar"
                    placeholderTextColor={colors.textMuted}
                    value={regName}
                    onChangeText={setRegName}
                  />
                </View>

                <Text style={styles.fieldLabel}>
                  {language === 'ta' ? 'மின்னஞ்சல் முகவரி' : 'Email Address'}
                </Text>
                <View style={styles.inputRow}>
                  <MaterialCommunityIcons
                    name="email-outline"
                    size={20}
                    color={colors.textSecondary}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.textInput}
                    placeholder="vignesh@example.com"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={regEmail}
                    onChangeText={setRegEmail}
                  />
                </View>

                <Text style={styles.fieldLabel}>
                  {language === 'ta' ? 'மொபைல் எண் (விருப்பத்திற்குரியது)' : 'Mobile Number (Optional)'}
                </Text>
                <View style={styles.inputRow}>
                  <MaterialCommunityIcons
                    name="phone-outline"
                    size={20}
                    color={colors.textSecondary}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.textInput}
                    placeholder="9876543210"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="phone-pad"
                    maxLength={10}
                    value={regMobile}
                    onChangeText={setRegMobile}
                  />
                </View>

                <Text style={styles.fieldLabel}>
                  {language === 'ta' ? 'கடவுச்சொல் (குறைந்தது 6 எழுத்துகள்)' : 'Password (min 6 characters)'}
                </Text>
                <View style={styles.inputRow}>
                  <MaterialCommunityIcons
                    name="lock-outline"
                    size={20}
                    color={colors.textSecondary}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.textInput}
                    placeholder="••••••••"
                    placeholderTextColor={colors.textMuted}
                    secureTextEntry={!showRegPassword}
                    value={regPassword}
                    onChangeText={setRegPassword}
                  />
                  <Pressable
                    onPress={() => setShowRegPassword(!showRegPassword)}
                    style={styles.eyeBtn}>
                    <MaterialCommunityIcons
                      name={showRegPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color={colors.textSecondary}
                    />
                  </Pressable>
                </View>

                <Text style={styles.fieldLabel}>
                  {language === 'ta' ? 'உங்கள் பங்கு' : 'Select Your Role'}
                </Text>
                <View style={styles.roleRow}>
                  <Pressable
                    style={[styles.roleCard, regRole === 'buyer' && styles.roleCardActive]}
                    onPress={() => setRegRole('buyer')}>
                    <MaterialCommunityIcons
                      name="basket"
                      size={24}
                      color={regRole === 'buyer' ? colors.primary : colors.textSecondary}
                    />
                    <Text
                      style={[styles.roleTitle, regRole === 'buyer' && styles.roleTitleActive]}>
                      {language === 'ta' ? 'வாங்குபவர்' : 'Buyer'}
                    </Text>
                    <Text style={styles.roleDesc}>
                      {language === 'ta' ? 'புதிய காய்கறிகள் வாங்க' : 'Buy farm-fresh goods'}
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[styles.roleCard, regRole === 'seller' && styles.roleCardActive]}
                    onPress={() => setRegRole('seller')}>
                    <MaterialCommunityIcons
                      name="tractor"
                      size={24}
                      color={regRole === 'seller' ? colors.primary : colors.textSecondary}
                    />
                    <Text
                      style={[styles.roleTitle, regRole === 'seller' && styles.roleTitleActive]}>
                      {language === 'ta' ? 'விவசாயி' : 'Farmer'}
                    </Text>
                    <Text style={styles.roleDesc}>
                      {language === 'ta' ? 'விளைபொருட்களை விற்க' : 'Sell your harvest'}
                    </Text>
                  </Pressable>
                </View>

                <PrimaryButton
                  title={language === 'ta' ? 'கணக்கை உருவாக்குக' : 'Create Account'}
                  icon="account-check-outline"
                  loading={regLoading}
                  onPress={handleRegister}
                  style={styles.submitBtn}
                />
              </View>
            )}

            {isGoogleSignInConfigured ? (
            <>
            {/* Divider */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>
                {language === 'ta' ? 'அல்லது' : 'OR CONTINUE WITH'}
              </Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Google OAuth Button */}
            <Pressable
              style={({ pressed }) => [
                styles.googleBtn,
                pressed && styles.googleBtnPressed,
              ]}
              disabled={googleLoading}
              onPress={handleGooglePress}>
              <MaterialCommunityIcons name="google" size={22} color="#EA4335" />
              <Text style={styles.googleBtnText}>
                {googleLoading
                  ? language === 'ta'
                    ? 'இணைக்கிறது...'
                    : 'Connecting...'
                  : language === 'ta'
                  ? 'Google மூலம் உள்நுழைக'
                  : 'Continue with Google'}
              </Text>
            </Pressable>
            </>
            ) : null}
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  headerSection: {
    alignItems: 'center',
    marginVertical: spacing.md,
  },
  logoBadge: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  mainTitle: {
    fontSize: fontSizes.xl,
    fontWeight: '800',
    color: colors.primaryDark,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subText: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 12,
    padding: 4,
    marginBottom: spacing.md,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  tabButtonActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontSize: fontSizes.sm,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.white,
    fontWeight: '700',
  },
  card: {
    padding: spacing.lg,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },
  fieldLabel: {
    fontSize: fontSizes.xs,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: spacing.sm,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.sm,
    height: 48,
  },
  inputIcon: {
    marginRight: spacing.xs,
  },
  textInput: {
    flex: 1,
    fontSize: fontSizes.md,
    color: colors.text,
    paddingVertical: 8,
  },
  eyeBtn: {
    padding: spacing.xs,
  },
  roleRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: 4,
  },
  roleCard: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.sm,
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  roleCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  roleTitle: {
    fontSize: fontSizes.sm,
    fontWeight: '700',
    color: colors.textSecondary,
    marginTop: 4,
  },
  roleTitleActive: {
    color: colors.primary,
  },
  roleDesc: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 2,
  },
  submitBtn: {
    marginTop: spacing.lg,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    paddingHorizontal: spacing.sm,
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 12,
    backgroundColor: colors.white,
    gap: 10,
  },
  googleBtnPressed: {
    backgroundColor: colors.surfaceSecondary,
  },
  googleBtnText: {
    fontSize: fontSizes.md,
    fontWeight: '600',
    color: colors.text,
  },
  demoSection: {
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 12,
  },
  demoHeading: {
    fontSize: fontSizes.xs,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  demoRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  demoBuyerBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.accent,
    borderRadius: 8,
    paddingVertical: 10,
    gap: 6,
  },
  demoBuyerText: {
    fontSize: fontSizes.sm,
    fontWeight: '700',
    color: colors.accent,
  },
  demoSellerBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 10,
    gap: 6,
  },
  demoSellerText: {
    fontSize: fontSizes.sm,
    fontWeight: '700',
    color: colors.white,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: spacing.xs,
  },
  modalTitle: {
    fontSize: fontSizes.lg,
    fontWeight: '700',
    color: colors.text,
  },
  modalSub: {
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  modalAccountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    marginBottom: spacing.sm,
  },
  modalAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  modalAvatarText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: fontSizes.md,
  },
  modalAccountDetails: {
    flex: 1,
  },
  modalAccountName: {
    fontSize: fontSizes.sm,
    fontWeight: '700',
    color: colors.text,
  },
  modalAccountEmail: {
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
  },
  customEmailBox: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  customEmailInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    fontSize: fontSizes.xs,
    height: 38,
  },
  customEmailBtn: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  customEmailBtnText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: fontSizes.xs,
  },
  modalCloseBtn: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  modalCloseText: {
    color: colors.textMuted,
    fontWeight: '600',
    fontSize: fontSizes.sm,
  },
});
