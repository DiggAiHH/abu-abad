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
