/**
 * RTL (Right-to-Left) Language Support
 * Manages text direction for Arabic script languages
 */

export const RTL_LANGUAGES = ['ar', 'fa', 'ckb'] as const;

export type RTLLanguage = typeof RTL_LANGUAGES[number];

/**
 * Check if a language code requires RTL layout
 */
export function isRTL(languageCode: string): boolean {
  return RTL_LANGUAGES.includes(languageCode as RTLLanguage);
}

/**
 * Get the text direction for a language
 */
export function getDirection(languageCode: string): 'rtl' | 'ltr' {
  return isRTL(languageCode) ? 'rtl' : 'ltr';
}

/**
 * Apply RTL direction to the document
 */
export function applyDirection(languageCode: string): void {
  const dir = getDirection(languageCode);
  document.documentElement.dir = dir;
  document.documentElement.lang = languageCode;
}

/**
 * Get CSS class for RTL-aware styling
 */
export function getRTLClass(languageCode: string): string {
  return isRTL(languageCode) ? 'rtl' : 'ltr';
}
