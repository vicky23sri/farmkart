/**
 * Auth Store
 * Manages user authentication state, authentication token, and active role ("buyer" | "seller").
 * Persists credentials securely using expo-secure-store.
 */

import { create } from 'zustand';

import { storage } from '@/utils/storage';

export type UserRole = 'buyer' | 'seller';

interface AuthState {
  isLoggedIn: boolean;
  token: string | null;
  role: UserRole | null;
  isLoading: boolean;

  /** Login user with token and optional initial role */
  login: (token: string, role?: UserRole) => Promise<void>;

  /** Switch or assign the user's role ("buyer" | "seller") */
  setRole: (role: UserRole) => Promise<void>;

  /** Logout and clear all persisted authentication data */
  logout: () => Promise<void>;

  /** Restore auth state from storage on app launch */
  loadSavedAuth: () => Promise<void>;
}

const TOKEN_KEY = 'farmkart_auth_token';
const ROLE_KEY = 'farmkart_user_role';

export const useAuthStore = create<AuthState>((set, get) => ({
  isLoggedIn: false,
  token: null,
  role: null,
  isLoading: true,

  login: async (token: string, role?: UserRole) => {
    try {
      await storage.setItem(TOKEN_KEY, token);
      if (role) {
        await storage.setItem(ROLE_KEY, role);
      }
      set({
        isLoggedIn: true,
        token,
        role: role ?? null,
      });
    } catch (error) {
      console.warn('[useAuthStore] Failed to save login credentials:', error);
    }
  },

  setRole: async (role: UserRole) => {
    try {
      await storage.setItem(ROLE_KEY, role);
      set({ role });
    } catch (error) {
      console.warn('[useAuthStore] Failed to save role:', error);
    }
  },

  logout: async () => {
    const previousToken = get().token;
    // 1. Always clear the local session first, so logout works offline and can never loop
    set({ isLoggedIn: false, token: null, role: null });
    await storage.removeItem(TOKEN_KEY);
    await storage.removeItem(ROLE_KEY);

    // 2. Best-effort server/device cleanup
    try {
      const { notificationService } = await import('@/services/notificationService');
      const { useNotificationStore } = await import('./useNotificationStore');
      const { useCartStore } = await import('./useCartStore');
      const { useWishlistStore } = await import('./useWishlistStore');
      const { useLocationStore } = await import('./useLocationStore');
      const { queryClient } = await import('@/services/queryClient');
      const pushToken = useNotificationStore.getState().pushToken;
      useNotificationStore.getState().setPushToken(null);
      useNotificationStore.getState().resetLocal();
      useCartStore.getState().clearCart();
      useWishlistStore.getState().clearWishlist();
      useLocationStore.getState().reset();
      queryClient.clear();
      const { signOutOfGoogle } = await import('@/services/googleSignIn');
      void signOutOfGoogle();
      if (pushToken && previousToken) {
        await notificationService.unregisterToken(pushToken, previousToken);
      }
    } catch (error) {
      console.warn('[useAuthStore] Post-logout cleanup failed:', error);
    }
  },

  loadSavedAuth: async () => {
    try {
      const token = await storage.getItem(TOKEN_KEY);
      const savedRole = (await storage.getItem(ROLE_KEY)) as UserRole | null;

      const isValidRole = savedRole === 'buyer' || savedRole === 'seller';

      if (token) {
        set({
          isLoggedIn: true,
          token,
          role: isValidRole ? savedRole : null,
          isLoading: false,
        });
      } else {
        set({
          isLoggedIn: false,
          token: null,
          role: null,
          isLoading: false,
        });
      }
    } catch (error) {
      console.warn('[useAuthStore] Failed to load saved credentials:', error);
      set({ isLoading: false });
    }
  },
}));

export default useAuthStore;
