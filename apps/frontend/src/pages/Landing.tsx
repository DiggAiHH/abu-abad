import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { track } from '../utils/analytics';
import Layout from '../components/Layout';

export default function Landing() {
  const { t } = useTranslation('pages');

  useEffect(() => {
    document.title = t('landing.title');
    track('page_view', { path: '/', page: 'landing' });
  }, [t]);

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50">
        <header className="border-b bg-white">
          <div className="mx-auto max-w-5xl px-4 py-4 flex items-center justify-between">
            <div className="font-semibold text-gray-900">Abu-Abbad</div>
            <div className="flex items-center gap-3">
              <Link
                to="/login"
                className="text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                {t('landing.header.login')}
              </Link>
              <Link
                to="/register"
                className="text-sm font-medium bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                {t('landing.header.tryFree')}
              </Link>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-5xl px-4 py-12">
          <div className="grid gap-10 md:grid-cols-2 md:items-center">
            <div>
              <h1 className="text-4xl font-bold tracking-tight text-gray-900">
                {t('landing.hero.headline')}
              </h1>
              <p className="mt-4 text-gray-600">
                {t('landing.hero.description')}
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  to="/register"
                  className="bg-blue-600 text-white px-5 py-3 rounded-lg font-medium hover:bg-blue-700"
                >
                  {t('landing.cta.start')}
                </Link>
                <Link
                  to="/login"
                  className="bg-white text-gray-900 px-5 py-3 rounded-lg font-medium border border-gray-200 hover:bg-gray-50"
                >
                  {t('landing.cta.hasAccount')}
                </Link>
              </div>

              <ul className="mt-8 space-y-2 text-sm text-gray-700">
                <li>• {t('landing.features.encryption')}</li>
                <li>• {t('landing.features.video')}</li>
                <li>• {t('landing.features.questionnaires')}</li>
                <li>• {t('landing.features.pwa')}</li>
              </ul>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-gray-900">{t('landing.quickTest.title')}</h2>
              <p className="mt-2 text-sm text-gray-600">
                {t('landing.quickTest.description')}
              </p>
              <div className="mt-4 grid gap-3">
                <Link
                  to="/login"
                  className="w-full text-center bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 font-medium"
                >
                  {t('landing.quickTest.login')}
                </Link>
                <Link
                  to="/register"
                  className="w-full text-center bg-white text-gray-900 py-3 rounded-lg border border-gray-200 hover:bg-gray-50 font-medium"
                >
                  {t('landing.quickTest.register')}
                </Link>
              </div>

              <div className="mt-6 text-xs text-gray-500">
                {t('landing.quickTest.note')}
              </div>
            </div>
          </div>
        </main>

        <footer className="border-t bg-white">
          <div className="mx-auto max-w-5xl px-4 py-6 text-xs text-gray-500">
            © {new Date().getFullYear()} Abu-Abbad
          </div>
        </footer>
      </div>
    </Layout>
  );
}
