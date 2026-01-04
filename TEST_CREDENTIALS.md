# 🔐 Abu-Abbad Test-Zugangsdaten

## Production-Ready Test Accounts

Diese Accounts wurden mit **bcrypt-gehashten Passwörtern** (10 Rounds) und **AES-256-verschlüsselten Personendaten** erstellt.

### 👤 Patient Account
```
E-Mail:    patient@test.de
Passwort:  Test123!
Name:      Max Mustermann
Rolle:     Patient
```

### 👨‍⚕️ Therapeut Account
```
E-Mail:    therapeut@test.de
Passwort:  Test123!
Name:      Dr. Anna Schmidt
Rolle:     Therapeut
```

---

## 🚀 Application URLs

- **Frontend:** http://localhost:5175
- **Backend-API:** http://localhost:4000/api
- **PeerJS Server:** http://localhost:9001 (WebRTC Video-Calls)

---

## ✅ Security Features

### Authentication (JWT)
- Access Token: 15min Expiry (HS256)
- Refresh Token: 7 days (UUID v4)
- Issuer/Audience Validation (RFC 7519)

### Data Encryption
- **PII Encryption:** AES-256-CBC für Namen, Adressen, Telefon
- **Password Hashing:** bcrypt (10 rounds, 2^10 = 1024 iterations)
- **HTTPS Only:** Production requires SSL/TLS

### DSGVO Compliance
- ✅ Explicit Consent (gdpr_consent_at timestamp)
- ✅ Right to Deletion (Soft-Delete + Anonymization)
- ✅ Data Portability (Export-API vorhanden)
- ✅ Audit Logging (alle kritischen Aktionen)

---

## 🧪 Test-Workflow

### 1. Patient-Flow
```bash
# Login
POST /api/auth/login
{
  "email": "patient@test.de",
  "password": "Test123!"
}

# Termin buchen
POST /api/appointments/{id}/book
Authorization: Bearer <token>

# Bezahlung (Stripe Test)
POST /api/payments/create-checkout
Authorization: Bearer <token>
```

### 2. Therapeut-Flow
```bash
# Login
POST /api/auth/login
{
  "email": "therapeut@test.de",
  "password": "Test123!"
}

# Termin erstellen
POST /api/appointments
Authorization: Bearer <token>
{
  "startTime": "2025-12-29T10:00:00Z",
  "endTime": "2025-12-29T11:00:00Z",
  "appointmentType": "video",
  "price": 120.00
}

# Video-Call starten
GET /video-call/{appointmentId}
```

---

## 🔧 Troubleshooting

### Problem: "Keine Verbindung zum Server"
**Ursache:** Backend nicht erreichbar (Port 4000)

**Lösung:**
```bash
cd apps/backend
npm run dev
```

### Problem: "CORS Error"
**Ursache:** Frontend-URL nicht in ALLOWED_ORIGINS

**Lösung:** `.env` prüfen:
```env
ALLOWED_ORIGINS=http://localhost:5175
```

### Problem: "Database connection failed"
**Ursache:** PostgreSQL Container nicht gestartet

**Lösung:**
```bash
docker start therapist_db
# Oder neu erstellen:
docker-compose up -d postgres
```

---

## 📊 Database Schema (Relevant)

```sql
-- User Tabelle (encrypted fields)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) CHECK (role IN ('therapist', 'patient')),
  first_name_encrypted TEXT NOT NULL,  -- AES-256 encrypted
  last_name_encrypted TEXT NOT NULL,   -- AES-256 encrypted
  phone_encrypted TEXT,                -- AES-256 encrypted
  gdpr_consent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## 🎯 Next Steps

1. **Login testen:** http://localhost:5175/login
2. **Registrierung testen:** http://localhost:5175/register
3. **Dashboard öffnen:** Nach Login automatisch
4. **Video-Call:** Therapeut erstellt Termin → Patient bucht → Video-Call starten

---

## 🔒 Security Audit Notes

### ✅ PASSED
- SQL Injection: Prepared Statements (pg)
- XSS: React Auto-Escaping + DOMPurify
- CSRF: SameSite Cookies + CORS Whitelist
- Password Storage: bcrypt (10 rounds)
- PII Encryption: AES-256-CBC
- Rate Limiting: 100 req/15min per IP

### ⚠️ RECOMMENDATIONS
- [ ] Enable HTTPS in Production (.env: NODE_ENV=production)
- [ ] Replace Stripe Test Keys with Live Keys
- [ ] Configure Real SMTP (current: console.log)
- [ ] Add Helmet CSP nonce for inline scripts
- [ ] Implement 2FA for Therapist accounts

---

**Last Updated:** December 28, 2025  
**Environment:** Development (localhost)
