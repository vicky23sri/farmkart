/* eslint-disable import/no-named-as-default-member */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import ta from './locales/ta.json';

// Translation resources mapping
const resources = {
  en: { translation: en },
  ta: { translation: ta },
};

// Initialize i18next for React Native
i18n.use(initReactI18next).init({
  resources,
  lng: 'en', // Default language is English
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false, // React already escapes values safely
  },
  compatibilityJSON: 'v4', // Ensures compatibility with React Native environments
});

export default i18n;
