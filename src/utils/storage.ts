/**
 * Storage Utility
 * Safe wrapper around expo-secure-store with web fallback for seamless cross-platform support.
 */

import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export const storage = {
  /**
   * Save a string value by key
   */
  async setItem(key: string, value: string): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(key, value);
        }
        return;
      }
      await SecureStore.setItemAsync(key, value);
    } catch (error) {
      console.warn(`[storage] Failed to set item for key: ${key}`, error);
    }
  },

  /**
   * Get a string value by key
   */
  async getItem(key: string): Promise<string | null> {
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          return window.localStorage.getItem(key);
        }
        return null;
      }
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      console.warn(`[storage] Failed to get item for key: ${key}`, error);
      return null;
    }
  },

  /**
   * Remove a value by key
   */
  async removeItem(key: string): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.removeItem(key);
        }
        return;
      }
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.warn(`[storage] Failed to remove item for key: ${key}`, error);
    }
  },
};
