# 🔐 Abu-Abbad Auth SDK

**DSGVO-konformes Authentication SDK** für die Abu-Abbad Teletherapie Platform.

Standalone npm-Package mit wiederverwendbaren Auth-Komponenten für:
- React Web Apps (Vite/CRA)
- React Native (iOS/Android)
- Capacitor (Hybrid Apps)
- Electron (Desktop)

---

## ✨ Features

- ✅ **Login & Register Components** - Plug-and-Play React Components
- ✅ **Zustand Store** - Globales Auth-State-Management
- ✅ **API Client** - Vorkonfigurierte Axios-Instanz
- ✅ **TypeScript Support** - Vollständige Type-Definitionen
- ✅ **DSGVO-Compliant** - Keine Third-Party Tracking
- ✅ **Mobile-Ready** - React Native kompatibel

---

## 📦 Installation

### Generierung des SDK
```bash
# Im abu-abad Repository
./scripts/extract-sdk.sh

# Output: dist/sdk/abu-abad-auth-sdk-1.0.0.tgz
```

### Installation in deinem Projekt
```bash
# Via .tgz File
npm install /path/to/abu-abad-auth-sdk-1.0.0.tgz

# ODER: Via npm link (Entwicklung)
cd /workspaces/abu-abad/dist/sdk
npm link

cd /path/to/your/app
npm link @abu-abad/auth-sdk
```

### Peer Dependencies
```bash
npm install react react-dom zustand axios
```

---

## 🚀 Quick Start

### React Web App

```tsx
import { LoginPage, RegisterPage, useAuthStore } from '@abu-abad/auth-sdk';

function App() {
  const { user, logout } = useAuthStore();
  
  if (!user) {
    return <LoginPage apiUrl="https://api.your-domain.de" />;
  }
  
  return (
    <div>
      <h1>Willkommen, {user.firstName}!</h1>
      <button onClick={logout}>Logout</button>
    </div>
  );
}
```

### React Native

```tsx
import { apiClient, setAuthToken, useAuthStore } from '@abu-abad/auth-sdk';

// 1. API-Endpoint konfigurieren
apiClient.defaults.baseURL = 'https://api.your-domain.de';

// 2. Login
async function login(email: string, password: string) {
  const response = await apiClient.post('/auth/login', { email, password });
  
  // 3. Token speichern
  setAuthToken(response.data.token);
  
  return response.data.user;
}

// 4. Nutze Auth Store
function ProfileScreen() {
  const { user, logout } = useAuthStore();
  
  return (
    <View>
      <Text>Hallo {user?.firstName}</Text>
      <Button title="Logout" onPress={logout} />
    </View>
  );
}
```

### Capacitor (Hybrid App)

```tsx
import { LoginPage, apiClient } from '@abu-abad/auth-sdk';

// Identisch zu React Web App
apiClient.defaults.baseURL = 'https://api.your-domain.de';

function App() {
  return <LoginPage apiUrl="https://api.your-domain.de" />;
}
```

---

## 📚 API Reference

### Components

#### `<LoginPage />`
Vollständige Login-Komponente mit E-Mail/Passwort-Formular.

```tsx
import { LoginPage } from '@abu-abad/auth-sdk';

<LoginPage 
  apiUrl="https://api.your-domain.de"
  onSuccess={(user) => console.log('Logged in:', user)}
/>
```

**Props:**
- `apiUrl` (required): Backend-API-Endpunkt
- `onSuccess?`: Callback nach erfolgreichem Login

---

#### `<RegisterPage />`
Vollständige Registrierungs-Komponente mit DSGVO-Einwilligung.

```tsx
import { RegisterPage } from '@abu-abad/auth-sdk';

<RegisterPage 
  apiUrl="https://api.your-domain.de"
  onSuccess={(user) => console.log('Registered:', user)}
/>
```

**Props:**
- `apiUrl` (required): Backend-API-Endpunkt
- `onSuccess?`: Callback nach erfolgreicher Registrierung

---

### Hooks

#### `useAuthStore()`
Zustand-basierter Auth-Store Hook.

```tsx
import { useAuthStore } from '@abu-abad/auth-sdk';

function Profile() {
  const { 
    user,           // Current User (oder null)
    token,          // JWT Token
    isAuthenticated, // Boolean
    login,          // (credentials) => Promise<User>
    logout,         // () => void
    register        // (userData) => Promise<User>
  } = useAuthStore();
  
  return <div>{user?.email}</div>;
}
```

**Store Properties:**
- `user: User | null` - Aktueller User
- `token: string | null` - JWT Token
- `isAuthenticated: boolean` - Auth-Status

**Store Methods:**
- `login(credentials)` - Login mit E-Mail/Passwort
- `logout()` - Logout (löscht Token)
- `register(userData)` - Registrierung

---

### API Client

#### `apiClient`
Vorkonfigurierte Axios-Instanz mit Auth-Header Interceptor.

```tsx
import { apiClient } from '@abu-abad/auth-sdk';

// Beispiel: Termine abrufen
const appointments = await apiClient.get('/appointments');

// Beispiel: Profil aktualisieren
await apiClient.put('/profile', { firstName: 'Max' });
```

---

#### `setAuthToken(token)`
Setzt JWT Token für alle API-Requests.

```tsx
import { setAuthToken } from '@abu-abad/auth-sdk';

// Nach Login
const response = await apiClient.post('/auth/login', credentials);
setAuthToken(response.data.token);

// Token wird automatisch in alle Requests als `Authorization: Bearer <token>` eingefügt
```

---

### Types

```typescript
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'patient' | 'therapist';
  phone?: string;
  createdAt: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: 'patient' | 'therapist';
  phone?: string;
  gdprConsent: boolean;
}
```

---

## 🔒 Security Features

### DSGVO-Compliance
- ✅ Keine Google-Dependencies (keine Analytics, Fonts)
- ✅ Keine Third-Party Tracking
- ✅ Explizite DSGVO-Einwilligung bei Registrierung
- ✅ Lokaler Token-Storage (Zustand Store)

### Security Best Practices
- ✅ HTTPS-Only (API-Calls)
- ✅ JWT mit kurzer Lebensdauer (15 Minuten)
- ✅ Refresh Token Support (Backend)
- ✅ Passwort-Validierung (8+ Zeichen, Großbuchstaben, Zahlen)

---

## 🎨 Customization

### Styling (TailwindCSS)
Die Komponenten nutzen TailwindCSS. Überschreibe Styles via:

```tsx
<LoginPage 
  apiUrl="https://api.your-domain.de"
  className="custom-login-page"
/>
```

### Custom API Interceptors

```tsx
import { apiClient } from '@abu-abad/auth-sdk';

// Request Interceptor
apiClient.interceptors.request.use((config) => {
  console.log('API Request:', config.url);
  return config;
});

// Response Interceptor
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.status);
    return Promise.reject(error);
  }
);
```

---

## 🧪 Testing

### Unit Tests
```bash
npm test
```

### E2E Tests (im abu-abad Repo)
```bash
# Login-Tests
npx playwright test tests/e2e/login.spec.ts

# Auth-Tests
npx playwright test tests/e2e/auth.spec.ts
```

---

## 📱 Mobile Deployment

### React Native Setup

```bash
# 1. Installiere SDK
npm install @abu-abad/auth-sdk

# 2. Install Dependencies
npm install react-native-vector-icons
npm install @react-native-async-storage/async-storage

# 3. Konfiguriere API-URL
import { apiClient } from '@abu-abad/auth-sdk';
apiClient.defaults.baseURL = 'https://api.your-domain.de';
```

### Capacitor Setup

```bash
# 1. Installiere SDK
npm install @abu-abad/auth-sdk

# 2. Nutze wie React Web App
import { LoginPage } from '@abu-abad/auth-sdk';
```

---

## 🔧 Troubleshooting

### Problem: `Cannot find module '@abu-abad/auth-sdk'`
**Lösung:**
```bash
# 1. Stelle sicher, dass .tgz korrekt installiert wurde
npm ls @abu-abad/auth-sdk

# 2. Oder nutze npm link (Entwicklung)
cd /workspaces/abu-abad/dist/sdk
npm link
```

### Problem: API-Calls schlagen fehl (CORS)
**Lösung:**
```bash
# Backend CORS-Konfiguration prüfen
# apps/backend/src/middleware/security.ts

const corsOptions = {
  origin: 'https://your-domain.de',
  credentials: true
};
```

### Problem: Token wird nicht persistiert
**Lösung:**
```tsx
// Zustand Store nutzt in-memory Storage
// Für persistente Sessions nutze:
import { useAuthStore } from '@abu-abad/auth-sdk';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Nach Login
const { token } = useAuthStore();
await AsyncStorage.setItem('auth_token', token);

// Bei App-Start
const token = await AsyncStorage.getItem('auth_token');
if (token) {
  setAuthToken(token);
}
```

---

## 📄 License

MIT License

---

## 🆘 Support

**Dokumentation:**
- [DEPLOYMENT_READY.md](../DEPLOYMENT_READY.md) - Deployment-Guide
- [COMPLETE_GUIDE.md](../COMPLETE_GUIDE.md) - Technische Details

**Issues:**
- GitHub Issues: https://github.com/your-org/abu-abad/issues

**Contact:**
- E-Mail: support@your-domain.de

---

## 🚀 Updates

### Version 1.0.0 (Initial Release)
- ✅ LoginPage & RegisterPage Components
- ✅ useAuthStore Hook (Zustand)
- ✅ apiClient (Axios)
- ✅ TypeScript Support
- ✅ React Native Kompatibilität

---

**Erstellt mit ❤️ für DSGVO-konforme Teletherapie**
