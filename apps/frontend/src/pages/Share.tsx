import { useEffect, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { track } from '../utils/analytics';

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

export default function Share() {
  const q = useQuery();
  const title = q.get('title') || '';
  const text = q.get('text') || '';
  const url = q.get('url') || '';

  useEffect(() => {
    document.title = 'Geteilte Inhalte – Abu-Abbad';
    track('share_opened', { hasUrl: Boolean(url), hasText: Boolean(text) });
  }, [text, url]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-lg w-full bg-white border border-gray-200 rounded-xl p-6">
        <h1 className="text-xl font-semibold text-gray-900">Geteilte Inhalte</h1>
        <p className="mt-2 text-sm text-gray-600">
          Du kannst den Link kopieren oder dich anmelden, um Inhalte in der App weiterzuverwenden.
        </p>

        <div className="mt-4 space-y-3">
          {title ? (
            <div>
              <div className="text-xs font-medium text-gray-500">Titel</div>
              <div className="text-sm text-gray-900 break-words">{title}</div>
            </div>
          ) : null}

          {text ? (
            <div>
              <div className="text-xs font-medium text-gray-500">Text</div>
              <div className="text-sm text-gray-900 whitespace-pre-wrap break-words">{text}</div>
            </div>
          ) : null}

          {url ? (
            <div>
              <div className="text-xs font-medium text-gray-500">URL</div>
              <a className="text-sm text-blue-600 hover:underline break-words" href={url} target="_blank" rel="noreferrer">
                {url}
              </a>
            </div>
          ) : (
            <div className="text-sm text-gray-500">Kein Link übergeben.</div>
          )}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to="/login"
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium"
          >
            Anmelden
          </Link>
          <Link
            to="/"
            className="bg-white text-gray-900 px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 font-medium"
          >
            Zur Startseite
          </Link>
        </div>
      </div>
    </div>
  );
}
