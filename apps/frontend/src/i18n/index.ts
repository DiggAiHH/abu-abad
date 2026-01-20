/**
 * i18n Configuration for Abu-Abbad Teletherapie Platform
 * 
 * Supports 20 languages including RTL (Arabic, Farsi, Kurdish Sorani)
 * @security No PII in translation keys
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import Backend from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';

export const SUPPORTED_LANGUAGES = [
  { code: 'de', name: 'Deutsch', flag: '🇩🇪', rtl: false },
  { code: 'en', name: 'English', flag: '🇬🇧', rtl: false },
  { code: 'tr', name: 'Türkçe', flag: '🇹🇷', rtl: false },
  { code: 'ar', name: 'العربية', flag: '🇸🇦', rtl: true },
  { code: 'fa', name: 'فارسی', flag: '🇮🇷', rtl: true },
  { code: 'kmr', name: 'Kurmancî', flag: '🇹🇯', rtl: false },
  { code: 'ckb', name: 'سۆرانی', flag: '🇮🇶', rtl: true },
  { code: 'ru', name: 'Русский', flag: '🇷🇺', rtl: false },
  { code: 'uk', name: 'Українська', flag: '🇺🇦', rtl: false },
  { code: 'pl', name: 'Polski', flag: '🇵🇱', rtl: false },
  { code: 'ro', name: 'Română', flag: '🇷🇴', rtl: false },
  { code: 'bg', name: 'Български', flag: '🇧🇬', rtl: false },
  { code: 'sr', name: 'Српски', flag: '🇷🇸', rtl: false },
  { code: 'hr', name: 'Hrvatski', flag: '🇭🇷', rtl: false },
  { code: 'bs', name: 'Bosanski', flag: '🇧🇦', rtl: false },
  { code: 'sq', name: 'Shqip', flag: '🇦🇱', rtl: false },
  { code: 'el', name: 'Ελληνικά', flag: '🇬🇷', rtl: false },
  { code: 'es', name: 'Español', flag: '🇪🇸', rtl: false },
  { code: 'fr', name: 'Français', flag: '🇫🇷', rtl: false },
  { code: 'pt', name: 'Português', flag: '🇵🇹', rtl: false },
] as const;

export const RTL_LANGUAGES = ['ar', 'fa', 'ckb'];

export const isRTL = (lang: string): boolean => RTL_LANGUAGES.includes(lang);

i18n
  .use(Backend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'de',
    supportedLngs: SUPPORTED_LANGUAGES.map((l) => l.code),
    ns: ['common', 'auth', 'privacy', 'pages'],
    defaultNS: 'common',
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },
    interpolation: {
      escapeValue: false, // React already escapes
    },
    react: {
      useSuspense: true,
    },
  });

// Set document direction on language change
i18n.on('languageChanged', (lng) => {
  document.documentElement.dir = isRTL(lng) ? 'rtl' : 'ltr';
  document.documentElement.lang = lng;
});

export default i18n;
