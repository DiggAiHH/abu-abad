import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';
import { logger } from '../utils/logger';

export default function Register() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    role: 'patient' as 'therapist' | 'patient',
    phone: '',
    gdprConsent: false,
  });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const register = useAuthStore((state) => state.register);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Client-side validation
    if (!formData.email || !formData.password || !formData.firstName || !formData.lastName) {
      toast.error('Bitte füllen Sie alle Pflichtfelder aus');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwörter stimmen nicht überein');
      return;
    }

    if (formData.password.length < 8) {
      toast.error('Passwort muss mindestens 8 Zeichen haben');
      return;
    }

    if (!formData.gdprConsent) {
      toast.error('Bitte akzeptieren Sie die Datenschutzerklärung');
      return;
    }

    setLoading(true);

    try {
      const { confirmPassword, ...registerData } = formData;
      await register(registerData);
      toast.success('Registrierung erfolgreich!');
      navigate('/dashboard');
    } catch (error: any) {
      logger.error('Register: error', error);
      
      if (error?.response?.status === 409) {
        toast.error('Diese E-Mail-Adresse existiert bereits');
      } else if (error?.response?.status === 400) {
        const errorMessage = error.response?.data?.error || 'Ungültige Eingabedaten';
        toast.error(errorMessage);
      } else if (!error?.response) {
        toast.error('Keine Verbindung zum Server möglich');
      } else if (error?.code === 'ECONNABORTED') {
        toast.error('Zeitüberschreitung. Bitte versuchen Sie es erneut.');
      }
      // Andere Fehler werden vom Axios Interceptor behandelt
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4 py-12">
      <div className="max-w-2xl w-full bg-white rounded-lg shadow-xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Abu-Abbad Registrierung</h1>
          <p className="text-gray-600 mt-2">Willkommen bei Abu-Abbad - Ihrer DSGVO-konformen Therapeuten-Plattform</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Vorname *
              </label>
              <input
                type="text"
                name="given-name"
                autoComplete="given-name"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                required
                placeholder="Vorname"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-600"
                data-testid="register-firstname"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nachname *
              </label>
              <input
                type="text"
                name="family-name"
                autoComplete="family-name"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                required
                placeholder="Nachname"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              E-Mail *
            </label>
            <input
              type="email"
              name="email"
              autoComplete="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-600"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Telefon (optional)
            </label>
            <input
              type="tel"
              name="tel"
              autoComplete="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-600"
            />
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Passwort *
              </label>
              <input
                type="password"
                name="new-password"
                autoComplete="new-password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                minLength={8}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-600"
                placeholder="Min. 8 Zeichen"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Passwort bestätigen *
              </label>
              <input
                type="password"
                name="new-password-confirm"
                autoComplete="new-password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                required
                placeholder="Passwort bestätigen"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Ich bin... *
            </label>
            <div className="flex gap-6" role="radiogroup" aria-label="Benutzerrolle auswählen">
              <label className="flex items-center cursor-pointer group">
                <input
                  type="radio"
                  value="patient"
                  checked={formData.role === 'patient'}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as 'patient' })}
                  className="w-4 h-4 mr-3 text-primary-600 focus:ring-2 focus:ring-primary-600 focus:ring-offset-2"
                  aria-label="Patient"
                />
                <span className="text-base font-medium text-gray-900 group-hover:text-primary-600 transition-colors">
                  Patient
                </span>
              </label>
              <label className="flex items-center cursor-pointer group">
                <input
                  type="radio"
                  value="therapist"
                  checked={formData.role === 'therapist'}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as 'therapist' })}
                  className="w-4 h-4 mr-3 text-primary-600 focus:ring-2 focus:ring-primary-600 focus:ring-offset-2"
                  aria-label="Therapeut"
                />
                <span className="text-base font-medium text-gray-900 group-hover:text-primary-600 transition-colors">
                  Therapeut
                </span>
              </label>
            </div>
          </div>

          <div className="bg-blue-50 p-4 rounded-lg">
            <label className="flex items-start">
              <input
                type="checkbox"
                checked={formData.gdprConsent}
                onChange={(e) => setFormData({ ...formData, gdprConsent: e.target.checked })}
                required
                className="mt-1 mr-3"
              />
              <span className="text-sm text-gray-700">
                Ich akzeptiere die <a href="#" className="text-primary-600 hover:underline">Datenschutzerklärung</a> (DSGVO) 
                und stimme der Verarbeitung meiner Daten zu medizinischen Zwecken zu. *
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 font-medium"
            data-testid="register-submit"
          >
            {loading ? 'Wird registriert...' : 'Registrieren'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-600">
          Bereits registriert?{' '}
          <Link to="/login" className="text-blue-600 hover:text-blue-700 font-medium">
            Jetzt anmelden
          </Link>
        </p>
      </div>
    </div>
  );
}
