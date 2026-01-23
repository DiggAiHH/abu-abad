import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';
import { logger } from '../utils/logger';
import LanguageSwitcher from '../components/LanguageSwitcher';

export default function Login() {
  const { t } = useTranslation('auth');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Client-side validation
    if (!email || !password) {
      toast.error('Bitte füllen Sie alle Felder aus');
      return;
    }
    
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Bitte geben Sie eine gültige E-Mail-Adresse ein');
      return;
    }
    
    setLoading(true);

    try {
      await login(email, password);
      toast.success('Erfolgreich angemeldet!');
      navigate('/dashboard');
    } catch (error: any) {
      logger.error('Login: error', error);
      
      // Spezifische Error-Messages basierend auf Status
      if (error?.response?.status === 401) {
        toast.error('Ungültige E-Mail oder Passwort');
      } else if (error?.response?.status === 429) {
        const errorData = error.response?.data;
        const errorMessage =
          (typeof errorData?.error === 'string' && errorData.error) ||
          (typeof errorData?.message === 'string' && errorData.message) ||
          'Zu viele Anmeldeversuche. Bitte später erneut versuchen.';
        toast.error(errorMessage);
      } else if (error?.response?.status === 403) {
        toast.error('Account deaktiviert. Bitte kontaktieren Sie den Support.');
      } else if (!error?.response) {
        toast.error('Keine Verbindung zum Server möglich. Bitte prüfen Sie Ihre Internetverbindung.');
      } else if (error?.code === 'ECONNABORTED') {
        toast.error('Zeitüberschreitung. Bitte versuchen Sie es erneut.');
      }
      // Andere Fehler werden vom Axios Interceptor behandelt
    } finally {
      setLoading(false); // Wichtig: Immer zurücksetzen!
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      {/* Language Switcher - Top Right */}
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>

      <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">{t('login.title')}</h1>
          <p className="text-gray-600 mt-2">{t('login.subtitle')}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              {t('login.email')}
            </label>
            <input
              id="email"
              type="email"
              name="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-600 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="ihre@email.de"
              data-testid="login-email"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              {t('login.password')}
            </label>
            <input
              id="password"
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-600 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="••••••••"
              data-testid="login-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            data-testid="login-submit"
          >
            {loading ? t('login.submitting', 'Wird angemeldet...') : t('login.submit')}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-600">
          {t('login.noAccount')}{' '}
          <Link to="/register" className="text-blue-600 hover:text-blue-700 font-medium">
            {t('login.registerLink')}
          </Link>
        </p>

        <div className="mt-8 pt-6 border-t border-gray-200">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <p className="text-sm font-semibold text-blue-900 mb-2">🧪 Test-Zugangsdaten:</p>
            <div className="space-y-1 text-xs text-blue-800 font-mono">
              <p><strong>Patient:</strong> patient@test.de / Test123!</p>
              <p><strong>Therapeut:</strong> therapeut@test.de / Test123!</p>
            </div>
          </div>
          <p className="text-xs text-gray-500 text-center">
            Diese Anwendung ist DSGVO-konform und verschlüsselt alle Daten.
          </p>
        </div>
      </div>
    </div>
  );
}
