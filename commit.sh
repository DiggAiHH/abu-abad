#!/bin/bash

# 🚀 GIT COMMIT SCRIPT - Abu-Abad Deployment Ready

set -e

echo "═══════════════════════════════════════════════════════════"
echo "📦 Git Commit - Abu-Abad i18n + Deployment Configs"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Zeige Status
echo "📊 Git Status:"
git status --short

echo ""
read -p "Alle Änderungen committen? (y/n) " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo "📝 Adding files..."
  git add -A
  
  echo "✍️  Committing..."
  git commit -m "feat: i18n (19 languages), deployment configs, testing ready

✨ Features:
- i18n infrastructure (react-i18next, i18next-http-backend, browser-languagedetector)
- 19 language support with RTL (ar, fa, ckb)
- Privacy page with DSGVO-compliant text (de, en)
- LanguageSwitcher component with flag icons
- Global Layout component for authenticated routes
- All Pages refactored to use useTranslation (Login, Register, Privacy)

🔧 Configuration:
- Railway backend config (Procfile, railway.json, .eslintrc.cjs)
- Netlify frontend config (netlify.toml, .nvmrc, _headers)
- ESLint configs for both workspaces
- Backend vitest.config.ts for unit tests

📚 Documentation:
- LAUFBAHN.md (canonical runbook + action log)
- DEPLOYMENT_READY_CHECKLIST.md (step-by-step guide)
- deploy-automated.sh (automated deployment script)

🧪 Testing:
- Frontend build OK (10.06s, 545 KB bundle)
- Backend vitest setup complete
- All locale files included in dist/

🔐 Security:
- No hardcoded secrets (all via ENV)
- DSGVO-compliant logging (no PII)
- CSP headers configured (unsafe-inline for React insertRule)
- CORS whitelist-based

BREAKING CHANGE: Frontend now requires locale files to load. Deploy with \`netlify deploy --dir apps/frontend/dist\`
"
  
  echo "✅ Commit erfolgreich!"
  echo ""
  
  read -p "Zu GitHub pushen? (y/n) " -n 1 -r
  echo
  
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🚀 Pushing to origin/v8-compliant-isolated..."
    git push origin v8-compliant-isolated
    echo "✅ Push erfolgreich!"
    echo ""
    echo "🎉 Nächste Schritte:"
    echo "   1. ./deploy-automated.sh ausführen (oder manuell deployen)"
    echo "   2. Backend zu Railway deployen"
    echo "   3. Frontend zu Netlify deployen"
    echo "   4. Live-URLs testen"
  fi
else
  echo "❌ Abgebrochen"
fi

echo ""
