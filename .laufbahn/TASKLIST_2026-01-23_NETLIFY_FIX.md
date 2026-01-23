# TASKLIST 2026-01-23 NETLIFY FIX

Ziel: Netlify-Deployment fixen ("Page not found"), Build verifizieren, Links bereitstellen.

1. Kontext prüfen: Netlify/Vite Routing + Output-Struktur.
2. SPA Redirect/Headers in netlify.toml verifizieren/anpassen.
3. Frontend-Build lokal ausführen und dist/ prüfen.
4. Deployment-Guide aktualisieren (Netlify Drop/CI) + Link-Ausgabe.
5. Smoke-Check Hinweise (base path, 404).
6. Action Log aktualisieren.

Verification:
- Frontend Build: apps/frontend/dist existiert
- Netlify Redirects: 200 -> /index.html
- Evidence: buildLogs/frontend-build-<timestamp>.log
