# 🎯 FULL i18n IMPLEMENTATION PLAN - Zero Warnings + 20 Sprachen

> **Absoluter Pfad:** `/workspaces/abu-abad/.laufbahn/FULL_I18N_IMPLEMENTATION.md`  
> **Erstellt:** 2026-01-18  
> **Status:** AKTIV - Ready für Ausführung

---

## 📋 EXECUTIVE SUMMARY

| Dimension | IST-Stand | ZIEL-Stand |
|-----------|-----------|------------|
| **ESLint Warnungen** | ~270 (geschätzt) | **0** |
| **TypeScript Errors** | 0 (Build OK) | **0** |
| **i18n Pages mit useTranslation** | 3 (Login, Register, Privacy) | **25** (alle Pages) |
| **Sprachen** | 19 | **20** (+ Portugiesisch) |
| **Language Switcher** | 3 Pages | **Global** (App.tsx Layout) |
| **Privacy-Text Vollständig** | 2 Sprachen (de, en) | **20 Sprachen** |
| **Hardcoded Strings** | ~500+ | **0** |

---

## 1️⃣ KLARES ZIEL

### 1.1 Primärziele (in Reihenfolge)

1. **ESLint Config erstellen** → 0 Warnings, 0 Errors
2. **TypeScript strict mode** → Build ohne Warnings
3. **Language Switcher global** → In App Layout (jede Page)
4. **Alle Pages i18n-fähig** → useTranslation in allen 25 Pages
5. **Privacy-Text 20 Sprachen** → Vollständige DSGVO-Texte
6. **Alle UI-Strings → Labels** → Kein hardcoded Text
7. **Commit + PR** → Ready for Netlify Testing

### 1.2 Definition of Done

- [x] `npm run lint` → 0 Warnings, 0 Errors
- [x] `npm run build` → Erfolgreich ohne Warnings
- [x] Language Switcher in Navigation sichtbar (alle Pages)
- [x] Sprachwechsel funktioniert ohne Page-Reload
- [x] Alle 20 Sprachen haben identische JSON-Key-Struktur
- [x] Privacy-Seite zeigt vollständigen DSGVO-Text in allen 20 Sprachen
- [x] RTL funktioniert (ar, fa, ckb)
- [x] Git Commit + PR erstellt

---

## 2️⃣ GERÄTE & METHODIK

### 2.1 ESLint-Strategie

**Problem:** ESLint findet keine Config in `apps/frontend/` und `apps/backend/`

**Lösung:** Erstelle `.eslintrc.cjs` in beiden Workspaces

```javascript
// apps/frontend/.eslintrc.cjs
module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs'],
  parser: '@typescript-eslint/parser',
  plugins: ['react-refresh'],
  rules: {
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'warn',
  },
};
```

### 2.2 i18n-Strategie

**Aktuell:**
- i18n Setup existiert in `src/i18n/index.ts`
- LanguageSwitcher existiert in `src/components/LanguageSwitcher.tsx`
- Nur 3 Pages nutzen `useTranslation`
- 19 Sprachen in `public/locales/`

**Ziel:**
- LanguageSwitcher in App-Layout (Header/Navigation)
- Alle 25 Pages nutzen `useTranslation`
- 20 Sprachen (+ Portugiesisch `pt`)
- Alle Strings in JSON-Files

### 2.3 Namespace-Struktur (Erweitert)

```
public/locales/{lang}/
├── common.json      # ✅ Existiert (erweitern)
├── auth.json        # ✅ Existiert (erweitern)
├── privacy.json     # ✅ Existiert (20 Sprachen)
├── dashboard.json   # 🆕 NEU: Therapist/Patient Dashboard
├── appointments.json # 🆕 NEU: Termine, Wartezimmer
├── therapy.json     # 🆕 NEU: Notes, Screening, Crisis
├── materials.json   # 🆕 NEU: Materialien, Dokumente
├── health.json      # 🆕 NEU: Symptome, Medikamente, Übungen
├── billing.json     # 🆕 NEU: Abrechnung, Reports
└── errors.json      # 🆕 NEU: Fehlermeldungen
```

---

## 3️⃣ SPRACHEN (20 Sprachen)

### 3.1 Aktuelle Sprachen (19)

| Code | Sprache | Status | RTL |
|------|---------|--------|-----|
| de | Deutsch | ✅ | - |
| en | English | ✅ | - |
| tr | Türkisch | ✅ | - |
| ar | Arabisch | ✅ | ✅ |
| fa | Farsi | ✅ | ✅ |
| kmr | Kurmanci | ✅ | - |
| ckb | Sorani | ✅ | ✅ |
| ru | Russisch | ✅ | - |
| uk | Ukrainisch | ✅ | - |
| pl | Polnisch | ✅ | - |
| ro | Rumänisch | ✅ | - |
| bg | Bulgarisch | ✅ | - |
| sr | Serbisch | ✅ | - |
| hr | Kroatisch | ✅ | - |
| bs | Bosnisch | ✅ | - |
| sq | Albanisch | ✅ | - |
| el | Griechisch | ✅ | - |
| es | Spanisch | ✅ | - |
| fr | Französisch | ✅ | - |

### 3.2 Neue Sprache (20. Sprache)

| Code | Sprache | Status | RTL |
|------|---------|--------|-----|
| pt | Portugiesisch | 🆕 NEU | - |

---

## 4️⃣ STRUKTUR (Implementierungs-Phasen)

### Phase A: ESLint & TypeScript (Prio 1)

| Schritt | Datei | Aktion |
|---------|-------|--------|
| A.1 | `apps/frontend/.eslintrc.cjs` | ESLint Config erstellen |
| A.2 | `apps/backend/.eslintrc.cjs` | ESLint Config erstellen |
| A.3 | `npm run lint --workspaces` | Alle Warnings fixen |
| A.4 | `npm run build --workspaces` | Verify 0 Errors |

### Phase B: Global Language Switcher (Prio 2)

| Schritt | Datei | Aktion |
|---------|-------|--------|
| B.1 | `src/components/Layout.tsx` | Layout mit Header + LanguageSwitcher |
| B.2 | `src/App.tsx` | Layout um alle authentifizierten Routes |
| B.3 | `src/components/LanguageSwitcher.tsx` | 20. Sprache (pt) hinzufügen |

### Phase C: 20. Sprache Portugiesisch (Prio 3)

| Schritt | Datei | Aktion |
|---------|-------|--------|
| C.1 | `public/locales/pt/` | Ordner erstellen |
| C.2 | `public/locales/pt/common.json` | Übersetzung |
| C.3 | `public/locales/pt/auth.json` | Übersetzung |
| C.4 | `public/locales/pt/privacy.json` | DSGVO-Text Portugiesisch |

### Phase D: Alle Pages i18n (Prio 4)

**Pages ohne i18n (22 Pages):**

| Page | Namespace | Komplexität |
|------|-----------|-------------|
| Landing.tsx | common, auth | Medium |
| Share.tsx | common | Low |
| NotFound.tsx | common | Low |
| TherapistDashboard.tsx | dashboard | High |
| PatientDashboard.tsx | dashboard | High |
| VideoCall.tsx | appointments | High |
| PatientMaterials.tsx | materials | Medium |
| QuestionnaireBuilder.tsx | therapy | High |
| PatientQuestionnaires.tsx | therapy | Medium |
| DocumentRequests.tsx | materials | Medium |
| SymptomDiary.tsx | health | Medium |
| TherapyNotes.tsx | therapy | High |
| PsychScreenings.tsx | therapy | High |
| CrisisPlan.tsx | therapy | Medium |
| MedicationTracker.tsx | health | Medium |
| Exercises.tsx | health | Medium |
| ReminderSettings.tsx | common | Low |
| Reports.tsx | billing | Medium |
| WaitingRoom.tsx | appointments | Medium |
| TherapistQueue.tsx | appointments | Medium |
| Billing.tsx | billing | High |

### Phase E: Privacy-Texte 20 Sprachen (Prio 5)

**Fehlende Sprachen für privacy.json:**

| Sprache | Status | Aktion |
|---------|--------|--------|
| de | ✅ Vollständig | - |
| en | ✅ Vollständig | - |
| tr | ⚠️ Prüfen | Vollständiger DSGVO-Text |
| ar | ⚠️ Prüfen | Vollständiger DSGVO-Text (RTL) |
| fa | ⚠️ Prüfen | Vollständiger DSGVO-Text (RTL) |
| kmr | ⚠️ Prüfen | Vollständiger DSGVO-Text |
| ckb | ⚠️ Prüfen | Vollständiger DSGVO-Text (RTL) |
| ru | ⚠️ Prüfen | Vollständiger DSGVO-Text |
| uk | ⚠️ Prüfen | Vollständiger DSGVO-Text |
| pl | ⚠️ Prüfen | Vollständiger DSGVO-Text |
| ro | ⚠️ Prüfen | Vollständiger DSGVO-Text |
| bg | ⚠️ Prüfen | Vollständiger DSGVO-Text |
| sr | ⚠️ Prüfen | Vollständiger DSGVO-Text |
| hr | ⚠️ Prüfen | Vollständiger DSGVO-Text |
| bs | ⚠️ Prüfen | Vollständiger DSGVO-Text |
| sq | ⚠️ Prüfen | Vollständiger DSGVO-Text |
| el | ⚠️ Prüfen | Vollständiger DSGVO-Text |
| es | ⚠️ Prüfen | Vollständiger DSGVO-Text |
| fr | ⚠️ Prüfen | Vollständiger DSGVO-Text |
| pt | 🆕 NEU | Vollständiger DSGVO-Text |

### Phase F: Commit & PR (Prio 6)

| Schritt | Aktion |
|---------|--------|
| F.1 | `git add -A` |
| F.2 | `git commit -m "feat(i18n): Complete internationalization with 20 languages, global language switcher, zero ESLint warnings"` |
| F.3 | `git push origin v8-compliant-isolated` |
| F.4 | PR erstellen: `v8-compliant-isolated` → `main` |

---

## 5️⃣ QUALITÄT & MUSTER

### 5.1 i18n-Muster (Verbindlich)

```tsx
// ✅ RICHTIG: Alle Strings via t()
import { useTranslation } from 'react-i18next';

export default function MyPage() {
  const { t } = useTranslation(['common', 'dashboard']);
  
  return (
    <div>
      <h1>{t('dashboard:title')}</h1>
      <button>{t('common:buttons.save')}</button>
    </div>
  );
}

// ❌ FALSCH: Hardcoded Strings
<h1>Dashboard</h1>
<button>Speichern</button>
```

### 5.2 Layout-Muster (Global Switcher)

```tsx
// src/components/Layout.tsx
import LanguageSwitcher from './LanguageSwitcher';

export default function Layout({ children }) {
  return (
    <div className="min-h-screen">
      <header className="fixed top-0 right-0 z-50 p-4">
        <LanguageSwitcher />
      </header>
      <main>{children}</main>
    </div>
  );
}
```

### 5.3 ESLint Rules (Verbindlich)

```javascript
// Keine unused vars (außer mit _ prefix)
'@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }]

// Keine explicit any (warnen, nicht blockieren)
'@typescript-eslint/no-explicit-any': 'warn'

// React Fast Refresh kompatibel
'react-refresh/only-export-components': ['warn', { allowConstantExport: true }]
```

### 5.4 DSGVO-Compliance Muster

```json
// privacy.json - Vollständige Struktur
{
  "title": "...",
  "lastUpdated": "...",
  "backToHome": "...",
  "sections": {
    "responsible": { "title": "...", "content": "..." },
    "dataCollection": { "title": "...", "content": "..." },
    "purpose": { "title": "...", "content": "..." },
    "storage": { "title": "...", "content": "..." },
    "retention": { "title": "...", "content": "..." },
    "rights": { "title": "...", "content": "..." },
    "thirdParties": { "title": "...", "content": "..." },
    "cookies": { "title": "...", "content": "..." },
    "changes": { "title": "...", "content": "..." },
    "contact": { "title": "...", "content": "..." }
  }
}
```

---

## 6️⃣ LAUFBAHN (Tracking)

| ID | Phase | Aktion | Status | Timestamp | Ergebnis |
|----|-------|--------|--------|-----------|----------|
| A.1 | ESLint | Frontend .eslintrc.cjs | ⏳ TODO | - | - |
| A.2 | ESLint | Backend .eslintrc.cjs | ⏳ TODO | - | - |
| A.3 | ESLint | Fix alle Warnings | ⏳ TODO | - | 0 Warnings |
| A.4 | Build | Verify 0 Errors | ⏳ TODO | - | - |
| B.1 | Layout | Layout.tsx erstellen | ⏳ TODO | - | - |
| B.2 | Layout | App.tsx integrieren | ⏳ TODO | - | - |
| B.3 | i18n | 20. Sprache (pt) | ⏳ TODO | - | - |
| C.1 | i18n | pt/common.json | ⏳ TODO | - | - |
| C.2 | i18n | pt/auth.json | ⏳ TODO | - | - |
| C.3 | i18n | pt/privacy.json | ⏳ TODO | - | DSGVO PT |
| D.x | Pages | 22 Pages i18n | ⏳ TODO | - | - |
| E.x | Privacy | 20 Sprachen | ⏳ TODO | - | - |
| F.1 | Git | Commit | ⏳ TODO | - | - |
| F.2 | Git | Push | ⏳ TODO | - | - |
| F.3 | Git | PR erstellen | ⏳ TODO | - | - |

---

## 7️⃣ GESCHÄTZTE AUFWAND

| Phase | Tasks | Geschätzte Zeit |
|-------|-------|-----------------|
| A: ESLint | 4 | 15 Min |
| B: Global Switcher | 3 | 20 Min |
| C: 20. Sprache | 3 | 30 Min |
| D: Pages i18n | 22 | 120 Min |
| E: Privacy 20 Sprachen | 18 | 60 Min |
| F: Commit/PR | 3 | 10 Min |
| **TOTAL** | **53** | **~4 Stunden** |

---

## 8️⃣ VERTRAUENS-UX FÜR SKEPTISCHE ZIELGRUPPE

### 8.1 "Direkt auf den Punkt" Prinzipien

- **Keine unnötigen Klicks** → Alle wichtigen Aktionen auf Dashboard-Ebene
- **Klare Sprache** → Medizinische Begriffe mit Tooltip-Erklärung
- **Transparente Prozesse** → Fortschrittsanzeigen bei allen Aktionen
- **Minimaler Kontakt** → Self-Service wo möglich (Fragebogen, Materialien)

### 8.2 Vertrauens-Elemente (i18n-Labels)

```json
// common.json - Trust Badges
{
  "trust": {
    "encryption": "🔒 AES-256 Verschlüsselung",
    "gdprCompliant": "✓ DSGVO-konform",
    "euServers": "🇪🇺 Server in der EU",
    "noTracking": "Kein Tracking",
    "dataMinimization": "Nur notwendige Daten"
  }
}
```

### 8.3 Ältere Nutzer (Accessibility)

- **Große Schrift** → min 16px, skalierbar
- **Hoher Kontrast** → WCAG AA mindestens
- **Einfache Navigation** → Max 3 Klicks zum Ziel
- **Sprachauswahl prominent** → Oben rechts, immer sichtbar

---

## 9️⃣ SUCCESS CRITERIA

### Technisch
- [ ] `npm run lint` = 0 Warnings, 0 Errors
- [ ] `npm run build` = Erfolgreich
- [ ] 20 Sprachen in `public/locales/`
- [ ] Alle 25 Pages nutzen `useTranslation`
- [ ] LanguageSwitcher in globalem Layout

### Funktional
- [ ] Sprachwechsel funktioniert in allen Tabs
- [ ] Sprachwechsel ohne Page-Reload
- [ ] RTL-Layout für ar/fa/ckb korrekt
- [ ] Privacy-Seite vollständig in 20 Sprachen
- [ ] localStorage persistiert Sprachwahl

### Deployment
- [ ] Git Commit mit aussagekräftiger Message
- [ ] PR erstellt: v8-compliant-isolated → main
- [ ] CI/CD Pipeline grün (falls konfiguriert)

---

## 🔟 NEXT STEPS (nach PR-Merge)

1. **Netlify Deploy** → Frontend mit 20 Sprachen
2. **Railway Deploy** → Backend
3. **E2E Tests** → Playwright für Sprachwechsel
4. **Performance Audit** → Lighthouse Score > 90
5. **User Testing** → Feedback von Zielgruppe (ältere Nutzer)

---

> **READY FOR IMPLEMENTATION:** Plan vollständig. Agent kann mit Phase A beginnen.
