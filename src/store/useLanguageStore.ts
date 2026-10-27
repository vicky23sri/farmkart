/**
 * Language Store
 * Manages active language state using Zustand, synchronizes with i18next,
 * and persists the user preference across app restarts.
 */

import { create } from 'zustand';

import i18n from '@/i18n';
import { storage } from '@/utils/storage';

export type SupportedLanguage = 'en' | 'ta';

interface LanguageState {
  language: SupportedLanguage;
  isLoading: boolean;
  setLanguage: (lang: SupportedLanguage) => Promise<void>;
  loadSavedLanguage: () => Promise<void>;
}

const STORAGE_KEY = 'farmkart_preferred_language';

export const useLanguageStore = create<LanguageState>((set) => ({
  // Default language is English
  language: 'en',
  isLoading: true,

  // Change active language, update i18next, and persist preference
  setLanguage: async (lang: SupportedLanguage) => {
    try {
      await i18n.changeLanguage(lang);
      set({ language: lang });
      await storage.setItem(STORAGE_KEY, lang);
    } catch (error) {
      console.warn('Error changing language:', error);
    }
  },

  // Read saved language from storage when the app loads
  loadSavedLanguage: async () => {
    try {
      const savedLang = await storage.getItem(STORAGE_KEY);
      if (savedLang === 'en' || savedLang === 'ta') {
        await i18n.changeLanguage(savedLang);
        set({ language: savedLang, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },
}));
