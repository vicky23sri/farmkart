/**
 * Authentication Service
 * Calls the FastAPI backend /auth/* endpoints for mobile OTP and role selection.
 */

import { apiClient } from './api';

export interface SendOtpResponse {
  success: boolean;
  message: string;
}

export interface VerifyOtpResponse {
  success: boolean;
  token?: string;
  role?: 'buyer' | 'seller' | null;
  isNewUser?: boolean;
  message?: string;
  user?: {
    id: string;
    email?: string;
    phone?: string;
    name?: string;
    role?: string | null;
  };
}

export interface UserProfile {
  id: number;
  email?: string;
  mobile?: string;
  role: 'buyer' | 'seller' | null;
  name?: string;
  avatar_url?: string;
  lat?: number;
  lng?: number;
  address?: string;
  upi_id?: string | null;
}

export const authService = {
  /**
   * Register a new user with email and password.
   */
  async register(data: {
    name: string;
    email: string;
    password: string;
    mobile?: string;
    role?: 'buyer' | 'seller';
  }): Promise<VerifyOtpResponse> {
    try {
      const res = (await apiClient.post('/auth/register', data)) as {
        access_token: string;
        user_id: number;
        role: 'buyer' | 'seller' | null;
        is_new_user: boolean;
      };
      return {
        success: true,
        token: res.access_token,
        role: res.role,
        isNewUser: res.is_new_user,
        user: {
          id: String(res.user_id),
          email: data.email,
          phone: data.mobile || '',
          name: data.name,
          role: res.role,
        },
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Registration failed. Please try again.',
      };
    }
  },

  /**
   * Login with email or mobile number and password.
   */
  async loginWithPassword(data: {
    emailOrMobile: string;
    password: string;
  }): Promise<VerifyOtpResponse> {
    try {
      const res = (await apiClient.post('/auth/login', {
        email_or_mobile: data.emailOrMobile.trim(),
        password: data.password,
      })) as {
        access_token: string;
        user_id: number;
        role: 'buyer' | 'seller' | null;
        is_new_user: boolean;
      };
      return {
        success: true,
        token: res.access_token,
        role: res.role,
        isNewUser: res.is_new_user,
        user: {
          id: String(res.user_id),
          phone: '',
          role: res.role,
        },
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Invalid email/mobile or password.',
      };
    }
  },

  /**
   * Authenticate or register using Google OAuth.
   */
  async googleAuth(data: {
    idToken?: string;
    accessToken?: string;
    role?: 'buyer' | 'seller';
  }): Promise<VerifyOtpResponse> {
    try {
      const res = (await apiClient.post('/auth/google', {
        id_token: data.idToken,
        access_token: data.accessToken,
        role: data.role,
      })) as {
        access_token: string;
        user_id: number;
        role: 'buyer' | 'seller' | null;
        is_new_user: boolean;
      };
      return {
        success: true,
        token: res.access_token,
        role: res.role,
        isNewUser: res.is_new_user,
        user: {
          id: String(res.user_id),
          phone: '',
          role: res.role,
        },
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Google authentication failed.',
      };
    }
  },

  /**
   * Validates if a string is a valid UPI ID (e.g., name@bank).
   * Regex: ^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$
   */
  isValidUpiId(upiId: string): boolean {
    const upiRegex = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;
    return upiRegex.test(upiId.trim());
  },

  /**
   * Validates if a string is a valid 10-digit Indian mobile number.
   * Standard Indian numbers start with digits 6, 7, 8, or 9.
   */
  isValidIndianMobile(phone: string): boolean {
    const cleanNumber = phone.replace(/\D/g, '');
    const indianMobileRegex = /^[6-9]\d{9}$/;
    return indianMobileRegex.test(cleanNumber);
  },

  /**
   * Request a 6-digit OTP code from FastAPI backend.
   * In development, the OTP is printed to the FastAPI server console.
   */
  async sendOtp(phone: string): Promise<SendOtpResponse> {
    const cleanPhone = phone.replace(/\D/g, '');

    if (!this.isValidIndianMobile(cleanPhone)) {
      return {
        success: false,
        message: 'Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.',
      };
    }

    try {
      const res = (await apiClient.post('/auth/send-otp', {
        mobile: cleanPhone,
      })) as { message: string; mobile: string };

      return {
        success: true,
        message: res.message || `OTP sent to +91 ${cleanPhone}. Check backend server console.`,
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Failed to send OTP. Please verify server connection.',
      };
    }
  },

  /**
   * Verify the 6-digit OTP code and retrieve the JWT access token.
   */
  async verifyOtp(phone: string, otp: string): Promise<VerifyOtpResponse> {
    const cleanPhone = phone.replace(/\D/g, '');
    const cleanOtp = otp.trim();

    if (!/^\d{6}$/.test(cleanOtp)) {
      return {
        success: false,
        message: 'Invalid OTP. Please enter a 6-digit verification code.',
      };
    }

    try {
      const res = (await apiClient.post('/auth/verify-otp', {
        mobile: cleanPhone,
        otp: cleanOtp,
      })) as {
        access_token: string;
        token_type: string;
        user_id: number;
        role: 'buyer' | 'seller' | null;
        is_new_user: boolean;
      };

      return {
        success: true,
        token: res.access_token,
        role: res.role,
        isNewUser: res.is_new_user,
        user: {
          id: String(res.user_id),
          phone: cleanPhone,
          role: res.role,
        },
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Verification failed. Please check the code and try again.',
      };
    }
  },

  /**
   * Resend an OTP.
   */
  async resendOtp(phone: string): Promise<SendOtpResponse> {
    return this.sendOtp(phone);
  },

  /**
   * Set user role on the backend ("buyer" or "seller").
   */
  async setRole(role: 'buyer' | 'seller'): Promise<UserProfile> {
    const res = (await apiClient.post('/auth/set-role', { role })) as UserProfile;
    return res;
  },

  /**
   * Get current authenticated user profile.
   */
  async getProfile(): Promise<UserProfile> {
    const res = (await apiClient.get('/auth/me')) as UserProfile;
    return res;
  },

  /**
   * Update user profile information.
   */
  async updateProfile(data: {
    name?: string;
    lat?: number;
    lng?: number;
    address?: string;
    upi_id?: string;
  }): Promise<UserProfile> {
    const res = (await apiClient.put('/auth/profile', data)) as UserProfile;
    return res;
  },

  /**
   * Permanently delete user account and anonymize personal information.
   */
  async deleteAccount(): Promise<{ success: boolean; message: string }> {
    try {
      const res = (await apiClient.delete('/auth/me')) as { message: string };
      return {
        success: true,
        message: res.message || 'Your account has been deleted successfully.',
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Failed to delete account. Please try again.',
      };
    }
  },
};

export default authService;
