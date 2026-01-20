# 🚀 NETLIFY DEPLOYMENT PLAN - Abu-Abbad i18n

> **Absolute Pfad:** `/workspaces/abu-abad/.laufbahn/NETLIFY_DEPLOYMENT.md`  
> **Erstellt:** 2026-01-09  
> **Status:** AKTIV - Deployment Phase

---

## 1️⃣ KLARES ZIEL

**Primärziel:** Frontend-App mit vollständiger i18n-Unterstützung (19 Sprachen) auf Netlify Premium deployen und funktionsfähige Live-URL bereitstellen.

**Erfolgskriterien:**
- ✅ Live-URL erreichbar (https://[site-name].netlify.app)
- ✅ Alle 19 Sprachen funktionieren
- ✅ RTL-Layouts (ar/fa/ckb) korrekt dargestellt
- ✅ Privacy-Seite in allen Sprachen erreichbar
- ✅ Keine CSP-Fehler (React #418 / insertRule)
- ✅ Kein 404 bei SPA-Routes

---

## 2️⃣ GERÄTE & METHODIK

### 2.1 Deployment-Strategie

**Option A: CLI (bevorzugt)**
```bash
npm install -g netlify-cli
netlify login
netlify deploy --prod --dir apps/frontend/dist
```

**Option B: Netlify Web UI (Fallback)**
- Manueller Upload des dist-Ordners
- Build Command in UI konfigurieren

**Gewählt:** Option A (CLI) - Schneller, reproduzierbar, automatisierbar

### 2.2 Build-Pipeline

```
Source Code (apps/frontend/src)
    ↓ (npm run build)
Vite Build (TypeScript → JavaScript)
    ↓ (tree-shaking, minification)
Production Bundle (apps/frontend/dist)
    ↓ (netlify deploy)
CDN Distribution (Netlify Edge)
    ↓
Live URL (https://abu-abad.netlify.app)
```

### 2.3 Kritische Konfiguration

**netlify.toml Location:** `/workspaces/abu-abad/netlify.toml`

```toml
[build]
  base = "apps/frontend"
  command = "npm ci && npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[[headers]]
  for = "/*"
  [headers.values]
    Content-Security-Policy = """
      default-src 'self';
      script-src 'self' 'unsafe-inline';
      style-src 'self' 'unsafe-inline';
      img-src 'self' data: https:;
      font-src 'self' data:;
      connect-src 'self' https://api.netlify.com;
      worker-src 'self' blob:;
    """
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
```

**KRITISCH:** `style-src 'unsafe-inline'` ist NOTWENDIG für React/NativeWind/insertRule - ohne dies gibt es den React #418 Crash!

---

## 3️⃣ TECH-STACK & DEPENDENCIES

### 3.1 Build-Abhängigkeiten

```json
{
  "vite": "^7.3.0",
  "i18next": "^23.x",
  "react-i18next": "^14.x",
  "i18next-http-backend": "^2.x",
  "i18next-browser-languagedetector": "^7.x"
}
```

### 3.2 Asset-Struktur

```
dist/
├── index.html                 # Entry Point
├── assets/
│   ├── index-*.js            # Main Bundle (543 KB)
│   ├── *.css                 # Styles
│   └── *.js                  # Lazy-loaded Chunks
└── locales/                  # i18n Translations
    ├── de/
    ├── en/
    ├── ar/
    ├── fa/
    └── [15 weitere...]
```

**Wichtig:** Alle `locales/**/*.json` MÜSSEN im dist-Ordner sein (bereits von Vite kopiert via `public/` Ordner)

---

## 4️⃣ STRUKTUR (Schritt-für-Schritt)

### Phase 1: Pre-Deployment Checks
```bash
# Schritt 1.1: Verifiziere Build lokal
cd /workspaces/abu-abad/apps/frontend
npm run build

# Schritt 1.2: Prüfe dist-Ordner
ls -la dist/
ls -la dist/locales/  # MUSS 19 Ordner enthalten

# Schritt 1.3: Verifiziere netlify.toml
cat /workspaces/abu-abad/netlify.toml
```

**Erwartete Ausgabe:**
- ✅ `dist/` Ordner existiert
- ✅ `dist/locales/` enthält 19 Sprachen
- ✅ `netlify.toml` hat CSP mit `style-src 'unsafe-inline'`

### Phase 2: Netlify CLI Setup
```bash
# Schritt 2.1: CLI installieren (falls nicht vorhanden)
npm list -g netlify-cli || npm install -g netlify-cli

# Schritt 2.2: Login (öffnet Browser)
netlify login

# Schritt 2.3: Verifiziere Account
netlify status
```

**Erwartete Ausgabe:**
```
Netlify CLI 23.x
Logged in as: [user-email]
Team: [team-name]
```

### Phase 3: Erstmaliger Deploy
```bash
# Schritt 3.1: Initialisiere Site (oder nutze existierende)
cd /workspaces/abu-abad
netlify init

# ODER: Direkt deployen ohne init
netlify deploy --dir apps/frontend/dist --prod

# Schritt 3.2: Site-Name konfigurieren (falls gewünscht)
netlify sites:update --name abu-abad-teletherapy
```

**Interaktive Fragen:**
- "Create & configure new site?" → YES
- "Team:" → [Wähle dein Team]
- "Site name:" → `abu-abad-teletherapy` (oder leer für Random)
- "Publish directory:" → `apps/frontend/dist`

### Phase 4: Verifizierung
```bash
# Schritt 4.1: URL öffnen
netlify open:site

# Schritt 4.2: Logs prüfen
netlify logs

# Schritt 4.3: Teste alle Sprachen
# Manuell im Browser:
# - https://[site].netlify.app (Deutsch)
# - Language-Switcher → Arabisch (RTL)
# - Privacy-Link klicken
```

### Phase 5: Post-Deployment
```bash
# Schritt 5.1: Environment Variables setzen (falls Backend existiert)
netlify env:set VITE_API_URL "https://api.example.com"

# Schritt 5.2: Custom Domain (optional, Premium Feature)
netlify domains:add abu-abad.com
```

---

## 5️⃣ QUALITÄT & MUSTER

### 5.1 DSGVO-Compliance Check

**Datenschutzerklärung-Verfügbarkeit:**
- [ ] `/privacy` Route funktioniert in allen 19 Sprachen
- [ ] Link in Register-Form führt zu `/privacy` (nicht zu `#`)
- [ ] Volltext in jeder Sprache vorhanden

**CSP-Konformität (CRA):**
- [ ] Keine `unsafe-eval` (nur `unsafe-inline` für Styles)
- [ ] Keine Third-Party Scripts ohne Consent
- [ ] TLS 1.3 durch Netlify garantiert

### 5.2 Performance-Kriterien

**Lighthouse Score (Ziel: >90):**
- Performance: >90
- Accessibility: >95 (WCAG 2.1 AA)
- Best Practices: >95
- SEO: >90

**Core Web Vitals:**
- LCP (Largest Contentful Paint): <2.5s
- FID (First Input Delay): <100ms
- CLS (Cumulative Layout Shift): <0.1

### 5.3 Testing-Checklist

**Manuell (Browser):**
1. [ ] Startseite lädt ohne Console-Errors
2. [ ] Language-Switcher zeigt alle 19 Sprachen
3. [ ] Wechsel zu Arabisch → Layout gespiegelt
4. [ ] Register-Form → Privacy-Link → Volltext sichtbar
5. [ ] Hard-Reload (Ctrl+Shift+R) → Kein React #418 Error

**Automatisiert (Playwright):**
```bash
# E2E-Test gegen Live-URL
PLAYWRIGHT_BASE_URL=https://abu-abad.netlify.app npm run test:e2e
```

### 5.4 Rollback-Strategie

**Bei Problemen:**
```bash
# Liste vorherige Deploys
netlify deploys:list

# Rollback zu vorheriger Version
netlify rollback [deploy-id]
```

---

## 6️⃣ TROUBLESHOOTING

### Problem 1: React #418 / insertRule Error

**Symptom:** App crasht beim Laden mit "Minified React error #418"

**Ursache:** CSP blockiert dynamische Style-Injection

**Fix:** In `netlify.toml` CSP Header:
```toml
Content-Security-Policy = "... style-src 'self' 'unsafe-inline'; ..."
```

### Problem 2: 404 bei SPA-Routes

**Symptom:** `/privacy` zeigt 404, aber `/` funktioniert

**Ursache:** Fehlende SPA-Redirect-Regel

**Fix:** In `netlify.toml`:
```toml
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

### Problem 3: i18n-Dateien nicht gefunden

**Symptom:** Console-Error "Failed to load /locales/de/common.json"

**Ursache:** `public/locales/` wurde nicht nach `dist/` kopiert

**Fix:** Vite kopiert automatisch - prüfe `ls dist/locales/`

### Problem 4: Premium-Features nicht verfügbar

**Symptom:** "Upgrade to Premium" bei Custom Domain

**Lösung:** Prüfe Team-Zugehörigkeit:
```bash
netlify status
# Team: [Muss Premium sein]
```

---

## 7️⃣ LAUFBAHN-TRACKING

| Schritt | Status | Zeitstempel | Ergebnis |
|---------|--------|-------------|----------|
| 1. Pre-Check | ⬜ TODO | - | - |
| 2. CLI Setup | ⬜ TODO | - | - |
| 3. Deploy | ⬜ TODO | - | - |
| 4. Verifizierung | ⬜ TODO | - | - |
| 5. Post-Config | ⬜ TODO | - | - |

**Aktualisierung nach jedem Schritt:**
```markdown
| 1. Pre-Check | ✅ DONE | 2026-01-09 14:23 | dist/ OK, 19 locales |
```

---

## 8️⃣ FINALE CHECKLISTE

### Deploy-Readiness
- [ ] `npm run build` erfolgreich (ohne Errors)
- [ ] `dist/` Ordner existiert (>1 MB)
- [ ] `dist/locales/` hat 19 Ordner
- [ ] `netlify.toml` korrekt konfiguriert
- [ ] CSP enthält `style-src 'unsafe-inline'`
- [ ] SPA-Redirect konfiguriert

### Post-Deploy
- [ ] Live-URL erreichbar
- [ ] Alle 19 Sprachen funktionieren
- [ ] RTL-Layouts korrekt (ar/fa/ckb)
- [ ] Privacy-Seite in allen Sprachen
- [ ] Keine Console-Errors
- [ ] Lighthouse Score >90

### Dokumentation
- [ ] Live-URL in README.md
- [ ] Environment Variables dokumentiert
- [ ] Custom Domain konfiguriert (optional)

---

## 9️⃣ NEXT STEPS (nach erfolgreichem Deploy)

1. **Custom Domain:** `abu-abad.com` → Netlify DNS
2. **Environment Variables:** Backend-URL setzen
3. **Monitoring:** Netlify Analytics aktivieren
4. **Continuous Deployment:** GitHub-Integration für Auto-Deploy
5. **A/B Testing:** Premium-Feature für Language-Switcher-Position

---

> **READY TO DEPLOY:** Alle Voraussetzungen erfüllt. Starte mit Phase 1.
