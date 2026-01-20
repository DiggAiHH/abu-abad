/**
 * Privacy Policy Page
 * 
 * Displays full GDPR-compliant privacy policy in user's selected language.
 * @security Complies with DSGVO Art. 12-14 transparency requirements
 */
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowLeft, Shield, Lock, FileText } from 'lucide-react';
import LanguageSwitcher from '../components/LanguageSwitcher';

export default function Privacy() {
  const { t } = useTranslation('privacy');
  
  // Get all sections from translations
  const sections = t('sections', { returnObjects: true }) as Record<
    string,
    { title: string; content: string }
  >;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      {/* Language Switcher - Top Right */}
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>

      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-xl p-8 mb-8">
          <Link
            to="/"
            className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 ltr:mr-2 rtl:ml-2" />
            {t('backToHome')}
          </Link>

          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-blue-100 rounded-full">
              <Shield className="w-8 h-8 text-blue-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{t('title')}</h1>
              <p className="text-gray-500">{t('lastUpdated')}</p>
            </div>
          </div>

          {/* Trust indicators */}
          <div className="flex flex-wrap gap-4 mt-6 pt-6 border-t">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Lock className="w-4 h-4 text-green-600" />
              <span>AES-256 Verschlüsselung</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <FileText className="w-4 h-4 text-green-600" />
              <span>DSGVO-konform</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Shield className="w-4 h-4 text-green-600" />
              <span>EU-Server</span>
            </div>
          </div>
        </div>

        {/* Content Sections */}
        <div className="bg-white rounded-lg shadow-xl p-8 space-y-8">
          {Object.entries(sections).map(([key, section]) => (
            <section key={key} className="scroll-mt-20" id={key}>
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                {section.title}
              </h2>
              <div className="text-gray-700 leading-relaxed whitespace-pre-line">
                {section.content}
              </div>
            </section>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <Link
            to="/register"
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Zurück zur Registrierung
          </Link>
        </div>
      </div>
    </div>
  );
}
