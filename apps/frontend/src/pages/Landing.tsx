import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { track } from '../utils/analytics';

export default function Landing() {
  useEffect(() => {
    document.title = 'Abu-Abbad – DSGVO-konforme Teletherapie';
    track('page_view', { path: '/', page: 'landing' });
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="mx-auto max-w-5xl px-4 py-4 flex items-center justify-between">
          <div className="font-semibold text-gray-900">Abu-Abbad</div>
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              Anmelden
            </Link>
            <Link
              to="/register"
              className="text-sm font-medium bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              Kostenlos testen
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-12">
        <div className="grid gap-10 md:grid-cols-2 md:items-center">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-gray-900">
              Teletherapie, die sich sicher anfühlt.
            </h1>
            <p className="mt-4 text-gray-600">
              DSGVO-konforme Plattform für Therapeut:innen und Patient:innen – mit Terminverwaltung,
              sicherer Kommunikation und Videosprechstunde.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/register"
                className="bg-blue-600 text-white px-5 py-3 rounded-lg font-medium hover:bg-blue-700"
              >
                Jetzt starten
              </Link>
              <Link
                to="/login"
                className="bg-white text-gray-900 px-5 py-3 rounded-lg font-medium border border-gray-200 hover:bg-gray-50"
              >
                Ich habe schon einen Zugang
              </Link>
            </div>

            <ul className="mt-8 space-y-2 text-sm text-gray-700">
              <li>• Verschlüsselung & Privacy by Design</li>
              <li>• Video- & Audio-Termine (WebRTC)</li>
              <li>• Fragebögen, Materialien, Dokumente</li>
              <li>• Für Tests als PWA installierbar</li>
            </ul>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-gray-900">Schnell testen</h2>
            <p className="mt-2 text-sm text-gray-600">
              Für den Testbetrieb kannst du dich direkt anmelden oder ein neues Konto erstellen.
            </p>
            <div className="mt-4 grid gap-3">
              <Link
                to="/login"
                className="w-full text-center bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 font-medium"
              >
                Login
              </Link>
              <Link
                to="/register"
                className="w-full text-center bg-white text-gray-900 py-3 rounded-lg border border-gray-200 hover:bg-gray-50 font-medium"
              >
                Registrierung
              </Link>
            </div>

            <div className="mt-6 text-xs text-gray-500">
              Hinweis: Im Produktivbetrieb gehören Impressum/Datenschutz dazu. Für Testing ist das
              bewusst schlank gehalten.
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
  );
}
