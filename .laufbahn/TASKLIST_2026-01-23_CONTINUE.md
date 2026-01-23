# TASKLIST 2026-01-23 CONTINUE

Ziel: Netlify "Page not found" beheben, Build/Deploy stabilisieren, Audit-/Deploy‑Evidence erzeugen.

1. Netlify Build-Konfiguration auf Monorepo-Frontend ausrichten (base/publish/command).
2. SPA-Routing für Netlify (Redirects) verifizieren.
3. Deployment-Dokumentation für Netlify konsistent machen.
4. Frontend-Production-Build ausführen und Evidence-Log in buildLogs/ erzeugen.
5. LAUFBAHN Action Log aktualisieren.

Verification:
- netlify.toml: base=apps/frontend, publish=dist, command=\"npm ci && npm run build\"
- SPA Redirects: apps/frontend/public/_redirects vorhanden
- Build-Log: buildLogs/frontend-build-<timestamp>.log
