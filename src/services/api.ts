/**
 * API Service Client
 * Configured Axios instance connecting to the FastAPI backend.
 * Features:
 * - BaseURL from process.env.EXPO_PUBLIC_API_URL
 * - Auto-attaches JWT Bearer token from useAuthStore
 * - Handles 401 Unauthorized by logging out and navigating to login
 * - Extracts friendly user-facing error messages
 */

/* eslint-disable import/no-named-as-default-member */
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { router } from 'expo-router';

import { useAuthStore } from '@/store';

// Default to LAN IP or localhost
export const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || 'http://172.16.16.45:8000';

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Attach JWT Bearer token from secure auth store
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    try {
      const token = useAuthStore.getState().token;
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (err) {
      console.warn('[API Client] Error attaching authorization token:', err);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Handle 401 Unauthenticated and format friendly errors
apiClient.interceptors.response.use(
  (response) => response.data,
  async (error: AxiosError<{ detail?: string | { msg: string }[]; message?: string }>) => {
    // 1. Handle Token Expiry / 401 Unauthorized
    if (error.response?.status === 401) {
      console.warn('[API Client] 401 Unauthorized. Session expired, logging out.');
      try {
        await useAuthStore.getState().logout();
        router.replace('/(auth)/login');
      } catch (logoutErr) {
        console.warn('[API Client] Error during auto-logout:', logoutErr);
      }
    }

    // 2. Extract friendly user-facing error messages
    let friendlyMessage = 'An unexpected server error occurred. Please try again.';

    if (error.response?.data) {
      const { detail, message } = error.response.data;
      if (typeof detail === 'string') {
        friendlyMessage = detail;
      } else if (Array.isArray(detail) && detail.length > 0) {
        // FastAPI / Pydantic validation error array
        friendlyMessage = detail.map((d) => d.msg || JSON.stringify(d)).join(', ');
      } else if (typeof message === 'string') {
        friendlyMessage = message;
      }
    } else if (error.message) {
      if (error.message.includes('Network Error')) {
        friendlyMessage = `Cannot connect to server at ${BASE_URL}. Check your Wi-Fi and backend status.`;
      } else if (error.message.includes('timeout')) {
        friendlyMessage = 'Request timed out. Please check your internet connection.';
      } else {
        friendlyMessage = error.message;
      }
    }

    return Promise.reject(new Error(friendlyMessage));
  }
);

export default apiClient;
