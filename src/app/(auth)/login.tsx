/**
 * Login Screen
 * Two-stage authentication:
 * 1. 10-digit Indian mobile number validation (+91, starting with 6-9)
 * 2. 6-box OTP verification with auto-focus and a 30-second resend countdown timer.
 * Integrates with authService and updates useAuthStore upon verification.
 */

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { Card } from '@/components/Card';
import { PrimaryButton } from '@/components/PrimaryButton';
import { authService } from '@/services/authService';
import { useAuthStore, useLanguageStore } from '@/store';
import { colors, fontSizes, spacing } from '@/theme';

export default function LoginScreen() {
  const { login } = useAuthStore();
  const { language } = useLanguageStore();

  // Mode: 'phone' (step 1) or 'otp' (step 2)
  const [mode, setMode] = useState<'phone' | 'otp'>('phone');

  // Step 1: Mobile state
  const [phone, setPhone] = useState('9876543210');
  const [phoneError, setPhoneError] = useState('');
  const [sendingOtp, setSendingOtp] = useState(false);

  // Step 2: 6-box OTP state
  const [otp, setOtp] = useState<string[]>(['', '', '', '', '', '']);
  const [verifying, setVerifying] = useState(false);
  const [resendTimer, setResendTimer] = useState(30);
  const [canResend, setCanResend] = useState(false);

  // Refs for the 6 OTP input boxes
  const inputRefs = useRef<any[]>([]);

  // 30-second countdown timer for OTP resend
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    if (mode === 'otp' && resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => {
          if (prev <= 1) {
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [mode, resendTimer]);

  // Step 1: Validate Indian phone number and request OTP
  const handleSendOtp = async () => {
    const cleanPhone = phone.replace(/\D/g, '');

    if (!cleanPhone) {
      setPhoneError(
        language === 'ta'
          ? 'தொலைபேசி எண்ணை உள்ளிடவும்.'
          : 'Please enter your 10-digit mobile number.'
      );
      return;
    }

    if (!authService.isValidIndianMobile(cleanPhone)) {
      setPhoneError(
        language === 'ta'
          ? 'சரியான 10 இலக்க இந்திய தொலைபேசி எண்ணை உள்ளிடவும் (6, 7, 8, அல்லது 9-ல் தொடங்க வேண்டும்).'
          : 'Please enter a valid 10-digit Indian number (starts with 6, 7, 8, or 9).'
      );
      return;
    }

    setPhoneError('');
    setSendingOtp(true);

    try {
      const res = await authService.sendOtp(cleanPhone);
      setSendingOtp(false);

      if (res.success) {
        setMode('otp');
        setOtp(['', '', '', '', '', '']);
        setResendTimer(30);
        setCanResend(false);

        // Focus first box automatically
        setTimeout(() => {
          inputRefs.current[0]?.focus();
        }, 150);
      } else {
        Alert.alert('Error', res.message);
      }
    } catch {
      setSendingOtp(false);
      Alert.alert('Error', 'Failed to connect to authentication service.');
    }
  };

  // Step 2: Handle OTP input digit change & auto-advance
  const handleOtpChange = (value: string, index: number) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);

    // Auto-focus next box if digit is entered
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  // Handle backspace navigation in OTP boxes
  const handleOtpKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  // Step 2: Verify the 6-digit OTP
  const handleVerifyOtp = async () => {
    const fullOtp = otp.join('');

    if (fullOtp.length < 6) {
      Alert.alert(
        language === 'ta' ? 'முழுமையற்ற OTP' : 'Incomplete OTP',
        language === 'ta'
          ? '6 இலக்க OTP எண்ணை உள்ளிடவும்.'
          : 'Please enter all 6 digits of the verification code.'
      );
      return;
    }

    setVerifying(true);

    try {
      const res = await authService.verifyOtp(phone, fullOtp);
      setVerifying(false);

      if (res.success && res.token) {
        // Save session token in auth store
        await login(res.token);
        // Direct to role selection screen
        router.push('/(auth)/role-select');
      } else {
        Alert.alert(
          language === 'ta' ? 'தவறான OTP' : 'Invalid OTP',
          res.message || 'Please check the code and try again.'
        );
      }
    } catch {
      setVerifying(false);
      Alert.alert('Error', 'Verification failed. Please try again.');
    }
  };

  // Resend OTP handler
  const handleResend = async () => {
    if (!canResend) return;

    setCanResend(false);
    setResendTimer(30);
    setOtp(['', '', '', '', '', '']);

    try {
      const res = await authService.resendOtp(phone);
      Alert.alert(
        language === 'ta' ? 'OTP அனுப்பப்பட்டது' : 'OTP Resent',
        res.message
      );
      inputRefs.current[0]?.focus();
    } catch {
      Alert.alert('Error', 'Failed to resend OTP.');
    }
  };

  // Quick 1-tap test shortcuts
  const handleDirectBuyer = async () => {
    await login('mock-quick-buyer-token', 'buyer');
    router.replace('/(buyer)/(tabs)');
  };

  const handleDirectSeller = async () => {
    await login('mock-quick-seller-token', 'seller');
    router.replace('/(seller)/(tabs)');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* AppHeader with Back support and Language toggle */}
      <AppHeader
        showBack={mode === 'otp'}
        title={mode === 'otp' ? (language === 'ta' ? 'சரிபார்ப்பு' : 'Verification') : 'FarmKart'}
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
          {mode === 'phone' ? (
            /* ================= STEP 1: MOBILE NUMBER INPUT ================= */
            <View style={styles.stepContainer}>
              <View style={styles.titleSection}>
                <View style={styles.iconCircle}>
                  <MaterialCommunityIcons
                    name="phone-check-outline"
                    size={40}
                    color={colors.primary}
                  />
                </View>

                <Text style={styles.mainTitle}>
                  {language === 'ta' ? 'உள்நுழையவும்' : 'Enter Mobile Number'}
                </Text>

                <Text style={styles.subText}>
                  {language === 'ta'
                    ? 'உங்கள் 10 இலக்க இந்திய தொலைபேசி எண்ணிற்கு OTP குறியீடு அனுப்பப்படும்.'
                    : 'We will send a 6-digit verification code to your Indian mobile number.'}
                </Text>
              </View>

              <Card style={styles.formCard}>
                <Text style={styles.fieldLabel}>
                  {language === 'ta' ? 'மொபைல் எண்' : 'Indian Mobile Number'}
                </Text>

                <View
                  style={[
                    styles.phoneInputRow,
                    phoneError ? styles.inputErrorBorder : null,
                  ]}>
                  <View style={styles.prefixBox}>
                    <Text style={styles.flagEmoji}>🇮🇳</Text>
                    <Text style={styles.prefixText}>+91</Text>
                  </View>

                  <TextInput
                    style={styles.phoneInput}
                    placeholder="98765 43210"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="number-pad"
                    maxLength={10}
                    value={phone}
                    onChangeText={(txt) => {
                      setPhone(txt);
                      if (phoneError) setPhoneError('');
                    }}
                  />
                </View>

                {phoneError ? (
                  <Text style={styles.errorText}>
                    <MaterialCommunityIcons
                      name="alert-circle-outline"
                      size={13}
                      color={colors.error}
                    />{' '}
                    {phoneError}
                  </Text>
                ) : (
                  <Text style={styles.helperText}>
                    Must be 10 digits starting with 6, 7, 8, or 9
                  </Text>
                )}

                <PrimaryButton
                  title={language === 'ta' ? 'OTP அனுப்பவும்' : 'Send Verification OTP'}
                  icon="arrow-right"
                  loading={sendingOtp}
                  onPress={handleSendOtp}
                  style={styles.actionBtn}
                />
              </Card>

              {/* Quick Testing Shortcuts */}
              <View style={styles.testingBox}>
                <Text style={styles.testingHeading}>
                  {language === 'ta' ? 'நேரடி சோதனை குறுக்குவழி:' : 'Instant Demo Shortcuts:'}
                </Text>
                <View style={styles.testingRow}>
                  <Pressable
                    style={styles.testBuyerBtn}
                    onPress={handleDirectBuyer}>
                    <MaterialCommunityIcons
                      name="basket"
                      size={18}
                      color={colors.accent}
                    />
                    <Text style={styles.testBuyerText}>Buyer Demo</Text>
                  </Pressable>

                  <Pressable
                    style={styles.testSellerBtn}
                    onPress={handleDirectSeller}>
                    <MaterialCommunityIcons
                      name="tractor"
                      size={18}
                      color={colors.white}
                    />
                    <Text style={styles.testSellerText}>Farmer Demo</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          ) : (
            /* ================= STEP 2: 6-BOX OTP VERIFICATION ================= */
            <View style={styles.stepContainer}>
              <View style={styles.titleSection}>
                <View style={[styles.iconCircle, { backgroundColor: colors.accentLight }]}>
                  <MaterialCommunityIcons
                    name="shield-key-outline"
                    size={40}
                    color={colors.accent}
                  />
                </View>

                <Text style={styles.mainTitle}>
                  {language === 'ta' ? 'OTP சரிபார்ப்பு' : 'Verify Mobile OTP'}
                </Text>

                <View style={styles.phoneChangeRow}>
                  <Text style={styles.subText}>
                    Sent to{' '}
                    <Text style={styles.phoneBold}>+91 {phone}</Text>
                  </Text>

                  <Pressable
                    style={styles.editBtn}
                    onPress={() => setMode('phone')}>
                    <Text style={styles.editText}>
                      {language === 'ta' ? 'மாற்று' : 'Edit'}
                    </Text>
                  </Pressable>
                </View>
              </View>

              <Card style={styles.formCard}>
                <Text style={styles.fieldLabel}>
                  {language === 'ta' ? '6-இலக்க குறியீடு' : 'Enter 6-Digit Code'}
                </Text>

                {/* 6 OTP Input Boxes */}
                <View style={styles.otpGrid}>
                  {otp.map((digit, index) => (
                    <TextInput
                      key={index}
                      ref={(el) => {
                        inputRefs.current[index] = el;
                      }}
                      style={[
                        styles.otpBox,
                        digit ? styles.otpBoxFilled : null,
                      ]}
                      keyboardType="number-pad"
                      maxLength={1}
                      value={digit}
                      onChangeText={(val) => handleOtpChange(val, index)}
                      onKeyPress={({ nativeEvent }) =>
                        handleOtpKeyPress(nativeEvent.key, index)
                      }
                      selectTextOnFocus
                    />
                  ))}
                </View>

                {/* 30s Countdown Timer / Resend Button */}
                <View style={styles.timerRow}>
                  {canResend ? (
                    <Pressable onPress={handleResend} style={styles.resendAction}>
                      <MaterialCommunityIcons
                        name="refresh"
                        size={16}
                        color={colors.primary}
                      />
                      <Text style={styles.resendActiveText}>
                        {language === 'ta' ? 'மீண்டும் OTP அனுப்புக' : 'Resend OTP'}
                      </Text>
                    </Pressable>
                  ) : (
                    <Text style={styles.timerMutedText}>
                      <MaterialCommunityIcons
                        name="clock-outline"
                        size={14}
                        color={colors.textMuted}
                      />{' '}
                      {language === 'ta'
                        ? `${resendTimer} வினாடிகளில் மீண்டும் அனுப்பலாம்`
                        : `Resend code in ${resendTimer}s`}
                    </Text>
                  )}
                </View>

                <PrimaryButton
                  title={language === 'ta' ? 'சரிபார்த்து தொடர்க' : 'Verify & Continue'}
                  icon="check-circle-outline"
                  loading={verifying}
                  onPress={handleVerifyOtp}
                  style={styles.actionBtn}
                />
              </Card>

              {/* Developer Hint */}
              <View style={styles.devHintBox}>
                <MaterialCommunityIcons
                  name="information-outline"
                  size={16}
                  color={colors.primaryDark}
                />
                <Text style={styles.devHintText}>
                  Testing Mode: Enter any 6 digits (e.g.{' '}
                  <Text style={{ fontWeight: '700' }}>123456</Text>) to proceed.
                </Text>
              </View>
            </View>
          )}
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
  stepContainer: {
    gap: spacing.md,
  },
  titleSection: {
    alignItems: 'center',
    marginVertical: spacing.sm,
    gap: 4,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  mainTitle: {
    fontSize: fontSizes.xl + 2,
    fontWeight: '800',
    color: colors.primaryDark,
    textAlign: 'center',
  },
  subText: {
    fontSize: fontSizes.xs + 1,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 320,
  },
  phoneBold: {
    fontWeight: '700',
    color: colors.text,
  },
  phoneChangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  editBtn: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: colors.primaryLight,
    borderRadius: 6,
  },
  editText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  formCard: {
    gap: spacing.sm + 2,
  },
  fieldLabel: {
    fontSize: fontSizes.xs + 1,
    fontWeight: '700',
    color: colors.text,
  },
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.surfaceSecondary,
    overflow: 'hidden',
  },
  inputErrorBorder: {
    borderColor: colors.error,
  },
  prefixBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 12,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    gap: 4,
    backgroundColor: '#F3F4F6',
  },
  flagEmoji: {
    fontSize: 16,
  },
  prefixText: {
    fontSize: fontSizes.md,
    fontWeight: '700',
    color: colors.text,
  },
  phoneInput: {
    flex: 1,
    fontSize: fontSizes.lg,
    fontWeight: '700',
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    letterSpacing: 1,
  },
  helperText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  errorText: {
    fontSize: 11,
    color: colors.error,
    fontWeight: '600',
  },
  otpGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginVertical: spacing.xs,
  },
  otpBox: {
    flex: 1,
    height: 52,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 10,
    textAlign: 'center',
    fontSize: fontSizes.xl,
    fontWeight: '800',
    color: colors.primaryDark,
    backgroundColor: colors.surfaceSecondary,
  },
  otpBoxFilled: {
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  timerRow: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  timerMutedText: {
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    fontWeight: '500',
  },
  resendAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  resendActiveText: {
    fontSize: fontSizes.xs + 1,
    fontWeight: '700',
    color: colors.primary,
  },
  actionBtn: {
    marginTop: spacing.xs,
  },
  testingBox: {
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  testingHeading: {
    fontSize: fontSizes.xs,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  testingRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  testBuyerBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentLight,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(245, 124, 0, 0.3)',
    gap: 6,
  },
  testBuyerText: {
    fontSize: fontSizes.xs,
    fontWeight: '700',
    color: colors.accent,
  },
  testSellerBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryDark,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  testSellerText: {
    fontSize: fontSizes.xs,
    fontWeight: '700',
    color: colors.white,
  },
  devHintBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    padding: spacing.sm,
    borderRadius: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(46, 125, 50, 0.2)',
  },
  devHintText: {
    fontSize: 11,
    color: colors.primaryDark,
    flex: 1,
    lineHeight: 16,
  },
});
