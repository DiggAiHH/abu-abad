import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from './LanguageSwitcher';

interface LayoutProps {
  children: ReactNode;
  showLanguageSwitcher?: boolean;
  className?: string;
}

/**
 * Global Layout component with persistent Language Switcher
 * @description Wraps all authenticated and public routes with consistent UI
 * @security No PII logged, DSGVO-compliant
 */
export default function Layout({ 
  children, 
  showLanguageSwitcher = true,
  className = '' 
}: LayoutProps) {
  const { t } = useTranslation('common');

  return (
    <div className={`min-h-screen bg-gray-50 ${className}`}>
      {/* Fixed Language Switcher - Always accessible */}
      {showLanguageSwitcher && (
        <div 
          className="fixed top-4 right-4 z-50"
          aria-label={t('accessibility.languageSelector', 'Language selector')}
        >
          <LanguageSwitcher />
        </div>
      )}
      
      {/* Main Content */}
      <main className="relative">
        {children}
      </main>
    </div>
  );
}
