import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Layout from '../components/Layout';

export default function NotFound() {
  const { t } = useTranslation('pages');

  return (
    <Layout>
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-6xl font-bold text-gray-900">{t('notFound.title')}</h1>
          <p className="text-xl text-gray-600 mt-4">{t('notFound.message')}</p>
          <Link
            to="/dashboard"
            className="mt-6 inline-block bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            {t('notFound.backToDashboard')}
          </Link>
        </div>
      </div>
    </Layout>
  );
}
