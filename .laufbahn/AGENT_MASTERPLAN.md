# 🎯 AGENT MASTERPLAN - Internationalisierung & Datenschutz

> **Absolute Pfad:** `/workspaces/abu-abad/.laufbahn/AGENT_MASTERPLAN.md`  
> **Erstellt:** 2026-01-09  
> **Status:** AKTIV - PHASE 1 (Planung abgeschlossen)

---

## 📋 EXECUTIVE SUMMARY

| Dimension | Aktueller Stand | Zielzustand |
|-----------|----------------|-------------|
| **Sprachen** | 1 (Deutsch, hardcoded) | 19 (inkl. RTL) |
| **i18n-Infrastruktur** | ❌ Nicht vorhanden | ✅ react-i18next |
| **Datenschutzerklärung** | ❌ Toter Link (`#`) | ✅ Volltext + Link in allen Sprachen |
| **RTL-Support** | ❌ Nicht vorhanden | ✅ Arabisch, Farsi, Kurdisch (Sorani) |

---

## 1️⃣ KLARES ZIEL (Was genau soll erreicht werden?)

### 1.1 Primärziele
1. **Datenschutzerklärung-Link reparieren**: Der `<a href="#">` in `Register.tsx:224` muss auf eine echte `/privacy`-Seite verlinken
2. **Datenschutzerklärung-Seite erstellen**: Vollständiger DSGVO-konformer Text
3. **19 Sprachen implementieren** (inkl. RTL):
   - 🇩🇪 Deutsch (de) - DEFAULT
   - 🇬🇧 Englisch (en)
   - 🇹🇷 Türkisch (tr)
   - 🇸🇦 Arabisch (ar) - RTL
   - 🇮🇷 Farsi/Persisch (fa) - RTL
   - 🇮🇶 Kurdisch Sorani (ckb) - RTL
   - 🇹🇯 Kurdisch Kurmanci (kmr)
   - 🇷🇺 Russisch (ru)
   - 🇺🇦 Ukrainisch (uk)
   - 🇵🇱 Polnisch (pl)
   - 🇷🇴 Rumänisch (ro)
   - 🇧🇬 Bulgarisch (bg)
   - 🇷🇸 Serbisch (sr)
   - 🇭🇷 Kroatisch (hr)
   - 🇧🇦 Bosnisch (bs)
   - 🇦🇱 Albanisch (sq)
   - 🇬🇷 Griechisch (el)
   - 🇪🇸 Spanisch (es)
   - 🇫🇷 Französisch (fr)

### 1.2 Sekundärziele
- Language-Switcher UI-Komponente (Dropdown mit Flaggen)
- Persistenz der Sprachauswahl (localStorage + User-Profil)
- RTL-Layout-Unterstützung (CSS `dir="rtl"`)

---

## 2️⃣ GERÄTE & METHODIK (Wie wird implementiert?)

### 2.1 Tech-Stack Erweiterung
```json
{
  "neue-dependencies": {
    "i18next": "^23.x",
    "react-i18next": "^14.x",
    "i18next-browser-languagedetector": "^7.x",
    "i18next-http-backend": "^2.x"
  }
}
```

### 2.2 Dateistruktur für Übersetzungen
```
apps/frontend/
├── public/
│   └── locales/
│       ├── de/
│       │   ├── common.json       # Allgemeine UI-Strings
│       │   ├── auth.json         # Login/Register
│       │   └── privacy.json      # Datenschutzerklärung (VOLLTEXT)
│       ├── en/
│       │   ├── common.json
│       │   ├── auth.json
│       │   └── privacy.json
│       ├── ar/                   # RTL
│       │   ├── common.json
│       │   ├── auth.json
│       │   └── privacy.json
│       └── [weitere 16 Sprachen...]
├── src/
│   ├── i18n/
│   │   ├── index.ts              # i18next Konfiguration
│   │   └── rtlLanguages.ts       # RTL-Detection Helper
│   ├── components/
│   │   └── LanguageSwitcher.tsx  # UI-Komponente
│   └── pages/
│       └── Privacy.tsx           # Neue Datenschutz-Seite
```

### 2.3 Implementierungs-Methodik
| Phase | Aktion | Dateien | Verifizierung |
|-------|--------|---------|---------------|
| **A** | Dependencies installieren | `package.json` | `npm ls i18next` |
| **B** | i18n-Infrastruktur aufsetzen | `src/i18n/index.ts` | Console: "i18n initialized" |
| **C** | Deutsche Strings extrahieren | `public/locales/de/*.json` | `wc -l` > 100 Keys |
| **D** | Register.tsx refactoren | `src/pages/Register.tsx` | `useTranslation` Hook |
| **E** | Privacy-Seite erstellen | `src/pages/Privacy.tsx` | Route `/privacy` erreichbar |
| **F** | Übersetzungen für 18 Sprachen | `public/locales/{lang}/*` | 19 Ordner mit identischen Keys |
| **G** | RTL-CSS implementieren | `src/index.css`, `App.tsx` | `dir="rtl"` bei ar/fa/ckb |
| **H** | Language-Switcher | `src/components/LanguageSwitcher.tsx` | UI sichtbar, Wechsel funktioniert |
| **I** | Integration in alle Pages | `src/pages/*.tsx` | Keine hardcoded Strings |

---

## 3️⃣ SPRACHEN (Welche Sprachen, welche Reihenfolge?)

### 3.1 Priorisierung nach Zielgruppe
```
TIER 1 (Kernsprachen - zuerst):
├── de (Deutsch) - Default, bereits vorhanden
├── ar (Arabisch) - RTL, größte Migrantengruppe
├── tr (Türkisch) - zweitgrößte Migrantengruppe
├── fa (Farsi) - RTL, Afghanistan/Iran
└── kmr (Kurmanci) - Nordkurdisch

TIER 2 (Europäische Sprachen):
├── en (Englisch) - Lingua Franca
├── ru (Russisch) - Osteuropa
├── uk (Ukrainisch) - Geflüchtete
├── pl (Polnisch)
├── ro (Rumänisch)
└── bg (Bulgarisch)

TIER 3 (Balkan + Weitere):
├── sr (Serbisch)
├── hr (Kroatisch)
├── bs (Bosnisch)
├── sq (Albanisch)
├── el (Griechisch)
├── ckb (Sorani) - RTL, Zentralkurdisch
├── es (Spanisch)
└── fr (Französisch)
```

### 3.2 RTL-Sprachen (KRITISCH)
| Sprache | Code | Schriftsystem | CSS-Klasse |
|---------|------|---------------|------------|
| Arabisch | `ar` | Arabisch | `rtl` |
| Farsi | `fa` | Persisch-Arabisch | `rtl` |
| Kurdisch Sorani | `ckb` | Arabisch | `rtl` |

**RTL-Implementation:**
```tsx
// App.tsx
const rtlLanguages = ['ar', 'fa', 'ckb'];
const isRTL = rtlLanguages.includes(i18n.language);
document.dir = isRTL ? 'rtl' : 'ltr';
```

---

## 4️⃣ STRUKTUR (Wie ist der Code organisiert?)

### 4.1 i18n Konfiguration
```typescript
// src/i18n/index.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import Backend from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';

i18n
  .use(Backend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'de',
    supportedLngs: [
      'de', 'en', 'tr', 'ar', 'fa', 'kmr', 'ckb',
      'ru', 'uk', 'pl', 'ro', 'bg', 'sr', 'hr',
      'bs', 'sq', 'el', 'es', 'fr'
    ],
    ns: ['common', 'auth', 'privacy'],
    defaultNS: 'common',
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json'
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage']
    }
  });

export default i18n;
```

### 4.2 Namespace-Struktur
```json
// public/locales/de/common.json
{
  "nav": {
    "dashboard": "Dashboard",
    "logout": "Abmelden",
    "settings": "Einstellungen"
  },
  "buttons": {
    "save": "Speichern",
    "cancel": "Abbrechen",
    "submit": "Absenden"
  },
  "errors": {
    "required": "Pflichtfeld",
    "invalidEmail": "Ungültige E-Mail-Adresse"
  }
}

// public/locales/de/auth.json
{
  "login": {
    "title": "Anmelden",
    "email": "E-Mail-Adresse",
    "password": "Passwort",
    "submit": "Anmelden",
    "forgotPassword": "Passwort vergessen?",
    "noAccount": "Noch kein Konto?"
  },
  "register": {
    "title": "Registrierung",
    "firstName": "Vorname",
    "lastName": "Nachname",
    "confirmPassword": "Passwort bestätigen",
    "gdprConsent": "Ich akzeptiere die",
    "gdprLink": "Datenschutzerklärung",
    "gdprSuffix": "(DSGVO) und stimme der Verarbeitung meiner Daten zu medizinischen Zwecken zu.",
    "submit": "Registrieren",
    "hasAccount": "Bereits registriert?"
  }
}

// public/locales/de/privacy.json
{
  "title": "Datenschutzerklärung",
  "lastUpdated": "Stand: Januar 2026",
  "sections": {
    "intro": {
      "title": "1. Verantwortlicher",
      "content": "Verantwortlich für die Datenverarbeitung ist Abu-Abbad Teletherapie GmbH..."
    },
    "dataCollection": {
      "title": "2. Welche Daten wir erheben",
      "content": "Wir erheben folgende personenbezogene Daten..."
    },
    // ... weitere DSGVO-Sektionen
  }
}
```

### 4.3 Privacy-Seite Struktur
```tsx
// src/pages/Privacy.tsx
import { useTranslation } from 'react-i18next';

export default function Privacy() {
  const { t } = useTranslation('privacy');
  
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold">{t('title')}</h1>
      <p className="text-gray-500">{t('lastUpdated')}</p>
      
      {/* Dynamisch alle Sektionen rendern */}
      {Object.entries(t('sections', { returnObjects: true })).map(([key, section]) => (
        <section key={key} className="mt-8">
          <h2 className="text-xl font-semibold">{section.title}</h2>
          <p className="mt-2 text-gray-700">{section.content}</p>
        </section>
      ))}
    </div>
  );
}
```

---

## 5️⃣ QUALITÄT & MUSTER (Welche Standards gelten?)

### 5.1 Code-Qualität
| Regel | Beschreibung | Enforcement |
|-------|--------------|-------------|
| **Keine hardcoded Strings** | Alle UI-Texte via `t()` | ESLint Rule (optional) |
| **Namespace-Trennung** | `common`, `auth`, `privacy` pro Feature | Review |
| **Fallback-Kette** | `de` als Ultimate Fallback | i18n Config |
| **TypeScript Keys** | Typisierte Translation Keys | `typeof resources` |

### 5.2 DSGVO-Compliance Muster
```tsx
// ✅ RICHTIG: Datenschutz-Consent mit echtem Link
<label>
  <input type="checkbox" checked={consent} onChange={...} />
  {t('auth:register.gdprConsent')}{' '}
  <Link to="/privacy" className="text-primary-600 hover:underline">
    {t('auth:register.gdprLink')}
  </Link>{' '}
  {t('auth:register.gdprSuffix')}
</label>

// ❌ FALSCH: Toter Link
<a href="#">Datenschutzerklärung</a>
```

### 5.3 RTL-Muster
```css
/* src/index.css */
[dir="rtl"] .text-left { text-align: right; }
[dir="rtl"] .pl-4 { padding-left: 0; padding-right: 1rem; }
[dir="rtl"] .mr-2 { margin-right: 0; margin-left: 0.5rem; }
```

### 5.4 Test-Muster
```typescript
// __tests__/i18n.test.ts
describe('i18n', () => {
  it('should have all keys in all languages', async () => {
    const deKeys = await loadKeys('de');
    const arKeys = await loadKeys('ar');
    expect(Object.keys(arKeys)).toEqual(Object.keys(deKeys));
  });
  
  it('should detect RTL languages', () => {
    expect(isRTL('ar')).toBe(true);
    expect(isRTL('de')).toBe(false);
  });
});
```

---

## 6️⃣ AGENT-WORKFLOW (Schritt-für-Schritt)

### Phase A: Foundation (Dependencies)
```bash
# Schritt A1: Dependencies installieren
cd apps/frontend
npm install i18next react-i18next i18next-browser-languagedetector i18next-http-backend
```

### Phase B: i18n Setup
```
# Schritt B1: Erstelle src/i18n/index.ts
# Schritt B2: Importiere i18n in main.tsx
# Schritt B3: Erstelle public/locales/de/common.json
```

### Phase C: Deutsche Strings Extraktion
```
# Schritt C1: Scanne alle .tsx Dateien
# Schritt C2: Extrahiere alle deutschen Strings
# Schritt C3: Strukturiere in JSON-Namespaces
```

### Phase D: Register.tsx Refactoring
```
# Schritt D1: Import useTranslation
# Schritt D2: Ersetze alle hardcoded Strings
# Schritt D3: Repariere Datenschutz-Link → /privacy
```

### Phase E: Privacy-Seite
```
# Schritt E1: Erstelle src/pages/Privacy.tsx
# Schritt E2: Erstelle public/locales/de/privacy.json (VOLLTEXT)
# Schritt E3: Füge Route in App.tsx hinzu
```

### Phase F: Übersetzungen (18 weitere Sprachen)
```
# Schritt F1: Kopiere de/*.json → en/*.json (manuell übersetzen)
# Schritt F2: Kopiere de/*.json → ar/*.json (manuell übersetzen)
# ... für jede Sprache wiederholen
```

### Phase G: RTL-Support
```
# Schritt G1: Erstelle src/i18n/rtlLanguages.ts
# Schritt G2: Füge dir-Attribut in App.tsx hinzu
# Schritt G3: Füge RTL-CSS-Overrides in index.css hinzu
```

### Phase H: Language-Switcher
```
# Schritt H1: Erstelle src/components/LanguageSwitcher.tsx
# Schritt H2: Integriere in Layout/Navigation
# Schritt H3: Speichere Auswahl in localStorage
```

### Phase I: Full Integration
```
# Schritt I1: Refactore alle Pages (Login, Dashboard, etc.)
# Schritt I2: Teste alle Sprachen
# Schritt I3: E2E-Tests für Sprachwechsel
```

---

## 7️⃣ VERIFIZIERUNG (Wie wird Erfolg gemessen?)

### 7.1 Akzeptanzkriterien
- [ ] `/privacy` zeigt vollständige Datenschutzerklärung
- [ ] Link in Register.tsx führt zu `/privacy` (kein toter `#`-Link)
- [ ] Language-Switcher zeigt 19 Sprachen
- [ ] Arabische Version hat `dir="rtl"` und korrektes Layout
- [ ] Alle 19 Sprachen haben identische JSON-Key-Struktur
- [ ] localStorage speichert Sprachauswahl persistent

### 7.2 Tests
```bash
# Unit-Tests
npm test -- --grep "i18n"

# E2E-Tests
npx playwright test e2e/language-switcher.spec.ts
npx playwright test e2e/privacy-page.spec.ts
```

### 7.3 Manuelle Prüfung
1. Öffne App im Browser
2. Wechsle zu Arabisch
3. Prüfe: Layout gespiegelt? Text rechts-nach-links?
4. Klicke auf Datenschutz-Link
5. Prüfe: Vollständiger Text in Arabisch sichtbar?

---

## 📊 FORTSCHRITTS-TRACKING

| Phase | Status | Beginn | Ende | Bearbeiter |
|-------|--------|--------|------|------------|
| A: Dependencies | ⬜ TODO | - | - | - |
| B: i18n Setup | ⬜ TODO | - | - | - |
| C: String-Extraktion | ⬜ TODO | - | - | - |
| D: Register Refactor | ⬜ TODO | - | - | - |
| E: Privacy-Seite | ⬜ TODO | - | - | - |
| F: Übersetzungen | ⬜ TODO | - | - | - |
| G: RTL-Support | ⬜ TODO | - | - | - |
| H: Language-Switcher | ⬜ TODO | - | - | - |
| I: Full Integration | ⬜ TODO | - | - | - |

---

## 🔒 COMPLIANCE-NOTES

### DSGVO Art. 12-14 (Transparenz)
- Datenschutzerklärung MUSS in verständlicher Sprache vorliegen
- Übersetzungen MÜSSEN rechtlich geprüft werden (Haftung!)
- Bei Übersetzungsfehlern gilt die deutsche Version

### DSGVO Art. 7 (Einwilligung)
- Consent-Checkbox MUSS vor Absenden geprüft werden ✅ (bereits implementiert)
- Link zur Datenschutzerklärung MUSS funktionieren ❌ (aktuell kaputt)

---

## 📎 REFERENZEN

- **Register.tsx:224** - Datenschutz-Link (aktuell `href="#"`)
- **App.tsx** - Routing (Privacy-Route fehlt)
- **package.json** - Dependencies (i18n fehlt)

---

> **NÄCHSTER SCHRITT:** Agent startet mit Phase A (Dependencies installieren)
