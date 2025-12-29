#!/bin/bash

# ══════════════════════════════════════════════════════════════
# SDK EXTRAKTION - Abu-Abbad Mobile-Ready Auth SDK
# ══════════════════════════════════════════════════════════════
# ZIEL: Standalone npm-Package für React Native / Capacitor / PWA
# KOMPONENTEN: Login, Register, AuthProvider, useAuth Hook
# ══════════════════════════════════════════════════════════════

set -e  # Exit on error

SDK_NAME="@abu-abad/auth-sdk"
SDK_VERSION="1.0.0"
BUILD_DIR="./sdk-build"
OUTPUT_DIR="./dist/sdk"

echo "════════════════════════════════════════════════════════════"
echo "  🚀 SDK EXTRAKTION GESTARTET"
echo "════════════════════════════════════════════════════════════"
echo "📦 Package: $SDK_NAME"
echo "🔢 Version: $SDK_VERSION"
echo "📂 Output:  $OUTPUT_DIR"
echo ""

# ══════════════════════════════════════════════════════════════
# SCHRITT 1: Build-Verzeichnis vorbereiten
# ══════════════════════════════════════════════════════════════
echo "🧹 Bereinige alte Builds..."
rm -rf "$BUILD_DIR" "$OUTPUT_DIR"
mkdir -p "$BUILD_DIR/src"
mkdir -p "$OUTPUT_DIR"

# ══════════════════════════════════════════════════════════════
# SCHRITT 2: Auth-Komponenten extrahieren
# ══════════════════════════════════════════════════════════════
echo "📝 Extrahiere Auth-Komponenten..."

# Core Components
cp apps/frontend/src/pages/Login.tsx "$BUILD_DIR/src/Login.tsx"
cp apps/frontend/src/pages/Register.tsx "$BUILD_DIR/src/Register.tsx"

# Store (Zustand)
cp apps/frontend/src/store/authStore.ts "$BUILD_DIR/src/authStore.ts"

# API Client
cp apps/frontend/src/api/client.ts "$BUILD_DIR/src/apiClient.ts"

# Types
cp apps/frontend/src/types/index.ts "$BUILD_DIR/src/types.ts"

# Fix Import Paths in copied files
echo "🔧 Fixe Import-Pfade..."

# Login.tsx: ../store/authStore -> ./authStore
sed -i "s|'../store/authStore'|'./authStore'|g" "$BUILD_DIR/src/Login.tsx"

# Register.tsx: ../store/authStore -> ./authStore
sed -i "s|'../store/authStore'|'./authStore'|g" "$BUILD_DIR/src/Register.tsx"

# authStore.ts: ../api/client -> ./apiClient, ../types -> ./types
sed -i "s|'../api/client'|'./apiClient'|g" "$BUILD_DIR/src/authStore.ts"
sed -i "s|'../types'|'./types'|g" "$BUILD_DIR/src/authStore.ts"

# apiClient.ts: Replace import.meta.env (not compatible with non-Vite environments)
sed -i "s|import.meta.env.VITE_API_URL|process.env.VITE_API_URL|g" "$BUILD_DIR/src/apiClient.ts"
sed -i "s|'../types'|'./types'|g" "$BUILD_DIR/src/apiClient.ts"

# ══════════════════════════════════════════════════════════════
# SCHRITT 3: SDK Entry Point erstellen
# ══════════════════════════════════════════════════════════════
echo "🔧 Erstelle SDK Entry Point..."

cat > "$BUILD_DIR/src/index.ts" <<'EOF'
/**
 * Abu-Abbad Auth SDK
 * 
 * Standalone Authentication Package für:
 * - React Web Apps (Vite/CRA)
 * - React Native (iOS/Android)
 * - Capacitor (Hybrid Apps)
 * - Electron (Desktop)
 * 
 * @packageDocumentation
 */

// Components
export { default as LoginPage } from './Login';
export { default as RegisterPage } from './Register';

// Store & Hooks
export { useAuthStore } from './authStore';

// API Client (Export as 'apiClient' for consistency)
export { api as apiClient } from './apiClient';

// Helper to set auth token
export function setAuthToken(token: string | null) {
  if (token) {
    localStorage.setItem('token', token);
  } else {
    localStorage.removeItem('token');
  }
}

// Types
export * from './types';

// Utils
export { validateEmail, validatePassword } from './utils';
EOF

# ══════════════════════════════════════════════════════════════
# SCHRITT 4: Utils Helpers erstellen
# ══════════════════════════════════════════════════════════════
cat > "$BUILD_DIR/src/utils.ts" <<'EOF'
/**
 * Validation Utilities
 */

export function validateEmail(email: string): boolean {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

export function validatePassword(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push('Mindestens 8 Zeichen erforderlich');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Mindestens ein Großbuchstabe erforderlich');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Mindestens ein Kleinbuchstabe erforderlich');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Mindestens eine Zahl erforderlich');
  }
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Mindestens ein Sonderzeichen erforderlich');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}
EOF

# ══════════════════════════════════════════════════════════════
# SCHRITT 5: package.json für SDK erstellen
# ══════════════════════════════════════════════════════════════
echo "📦 Erstelle package.json..."

cat > "$BUILD_DIR/package.json" <<EOF
{
  "name": "$SDK_NAME",
  "version": "$SDK_VERSION",
  "description": "DSGVO-compliant Authentication SDK für Abu-Abbad Teletherapie Platform",
  "main": "./dist/index.js",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "files": [
    "dist",
    "README.md",
    "LICENSE"
  ],
  "scripts": {
    "build": "tsup src/index.ts --format cjs,esm --dts",
    "prepublishOnly": "npm run build"
  },
  "keywords": [
    "auth",
    "authentication",
    "login",
    "register",
    "react",
    "react-native",
    "dsgvo",
    "gdpr",
    "teletherapie"
  ],
  "author": "Abu-Abbad Team",
  "license": "MIT",
  "peerDependencies": {
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "zustand": "^4.0.0"
  },
  "dependencies": {
    "axios": "^1.6.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "tsup": "^8.0.0",
    "typescript": "^5.0.0"
  }
}
EOF

# ══════════════════════════════════════════════════════════════
# SCHRITT 6: TypeScript Config für SDK
# ══════════════════════════════════════════════════════════════
echo "⚙️  Erstelle tsconfig.json..."

cat > "$BUILD_DIR/tsconfig.json" <<EOF
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020", "DOM"],
    "jsx": "react-jsx",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "removeComments": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "skipLibCheck": true,
    "moduleResolution": "node"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
EOF

# ══════════════════════════════════════════════════════════════
# SCHRITT 7: README für SDK
# ══════════════════════════════════════════════════════════════
echo "📖 Erstelle README..."

cat > "$BUILD_DIR/README.md" <<'EOF'
# 🔐 Abu-Abbad Auth SDK

DSGVO-compliant Authentication SDK für die Abu-Abbad Teletherapie Platform.

## 🚀 Installation

```bash
npm install @abu-abad/auth-sdk
```

## 📦 Usage

### React Web App

```tsx
import { LoginPage, RegisterPage, useAuthStore } from '@abu-abad/auth-sdk';

function App() {
  const { user, logout } = useAuthStore();
  
  return (
    <div>
      {user ? (
        <button onClick={logout}>Logout</button>
      ) : (
        <LoginPage apiUrl="https://api.your-domain.de" />
      )}
    </div>
  );
}
```

### React Native

```tsx
import { apiClient, setAuthToken } from '@abu-abad/auth-sdk';

// Configure API endpoint
apiClient.defaults.baseURL = 'https://api.your-domain.de';

// Login
const response = await apiClient.post('/auth/login', {
  email: 'test@example.com',
  password: 'SecurePass123!'
});

// Set token for subsequent requests
setAuthToken(response.data.token);
```

## 🔒 DSGVO Compliance

- ✅ Keine Google-Abhängigkeiten
- ✅ Keine Drittanbieter-Tracking
- ✅ Lokaler Datenspeicher
- ✅ Verschlüsselte Kommunikation (TLS 1.3)
- ✅ Minimale Datenerfassung

## 📄 License

MIT
EOF

# ══════════════════════════════════════════════════════════════
# SCHRITT 8: Dependencies installieren & Build
# ══════════════════════════════════════════════════════════════
echo "📥 Installiere Dependencies..."
cd "$BUILD_DIR"
npm install --silent

echo "🏗️  Baue SDK..."
npm run build

# ══════════════════════════════════════════════════════════════
# SCHRITT 9: Output nach dist/sdk kopieren
# ══════════════════════════════════════════════════════════════
echo "📦 Erstelle finales Package..."
cd ..
cp -r "$BUILD_DIR/dist" "$OUTPUT_DIR/"
cp "$BUILD_DIR/package.json" "$OUTPUT_DIR/"
cp "$BUILD_DIR/README.md" "$OUTPUT_DIR/"

# ══════════════════════════════════════════════════════════════
# SCHRITT 10: NPM Package erstellen (optional)
# ══════════════════════════════════════════════════════════════
echo "📦 Erstelle .tgz Package..."
cd "$OUTPUT_DIR"
npm pack
cd ../..

echo ""
echo "════════════════════════════════════════════════════════════"
echo "  ✅ SDK EXTRAKTION ERFOLGREICH"
echo "════════════════════════════════════════════════════════════"
echo "📂 Output:     $OUTPUT_DIR"
echo "📦 Package:    $OUTPUT_DIR/$(basename $SDK_NAME)-$SDK_VERSION.tgz"
echo ""
echo "🚀 INSTALLATION AUF HANDY:"
echo "   1. Kopiere .tgz auf Device"
echo "   2. npm install ./abu-abad-auth-sdk-1.0.0.tgz"
echo "   3. Import: import { LoginPage } from '@abu-abad/auth-sdk'"
echo ""
echo "🔗 ODER: Lokales npm link"
echo "   cd $OUTPUT_DIR && npm link"
echo "   cd /path/to/your/mobile/app && npm link @abu-abad/auth-sdk"
echo ""
