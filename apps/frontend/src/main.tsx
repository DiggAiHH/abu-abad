import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { GlobalErrorBoundary } from './components/GlobalErrorBoundary';

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // best-effort: SW ist optional
    });
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <GlobalErrorBoundary>
      <App />
    </GlobalErrorBoundary>
  </React.StrictMode>,
);
