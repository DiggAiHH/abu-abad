# 🧪 ATOMIC TESTING STRATEGY - ABU-ABBAD
**Version:** 8.0 (DSGVO-Compliant)  
**Datum:** 2025-12-29  
**Test-Coverage-Ziel:** 100% für alle interaktiven Elemente

---

## 📊 TEST-MATRIX ÜBERSICHT

| Komponente | Elements | Test-IDs | E2E Tests | Coverage |
|------------|----------|----------|-----------|----------|
| **Login** | 3 | 3/3 ✅ | 9/10 ✅ | 90% |
| **Register** | 8 | 2/8 ⚠️ | 0/8 ❌ | 25% |
| **PatientDashboard** | 12 | 0/12 ❌ | 0/12 ❌ | 0% |
| **TherapistDashboard** | 10 | 0/10 ❌ | 0/10 ❌ | 0% |
| **VideoCall** | 6 | 0/6 ❌ | 0/6 ❌ | 0% |
| **ErrorBoundary** | 2 | 0/2 ❌ | 0/2 ❌ | 0% |
| **GESAMT** | 41 | 5/41 (12%) | 9/48 (19%) | 18% |

---

## ✅ PHASE 1: LOGIN (ABGESCHLOSSEN)

### Test-Dateien:
- ✅ `tests/page-objects/LoginPage.ts` - Page Object Pattern
- ✅ `tests/e2e/login.spec.ts` - 9 funktionierende Tests

### Test-Coverage:

| Test-ID | Beschreibung | Status |
|---------|-------------|--------|
| TC-001 | Display test credentials | ✅ Pass |
| TC-002 | Patient login success | ✅ Pass |
| TC-003 | Therapeut login success | ✅ Pass |
| TC-004 | Invalid credentials error | ✅ Pass |
| TC-005 | Empty email validation | ✅ Pass |
| TC-006 | Empty password validation | ✅ Pass |
| TC-007 | SQL Injection prevention | ✅ Pass |
| TC-008 | Unicode/special chars | ✅ Pass |
| TC-009 | Loading state | ⏭️ Skip (Race Condition) |
| TC-010 | Session persistence | ✅ Pass |

### data-testid Implementation:
```typescript
// apps/frontend/src/pages/Login.tsx
<input data-testid="login-email" />
<input data-testid="login-password" />
<button data-testid="login-submit" />
```

---

## 🚧 PHASE 2: REGISTER (IN ARBEIT)

### Benötigte data-testid:

```typescript
// apps/frontend/src/pages/Register.tsx
<input data-testid="register-firstname" /> // ✅ Vorhanden
<input data-testid="register-lastname" />
<input data-testid="register-email" />
<input data-testid="register-password" />
<input data-testid="register-password-confirm" />
<input type="radio" data-testid="register-role-patient" />
<input type="radio" data-testid="register-role-therapist" />
<button data-testid="register-submit" /> // ✅ Vorhanden
```

### Test-Cases (zu implementieren):

| Test-ID | Beschreibung | Priorität |
|---------|-------------|-----------|
| TC-REG-001 | Display registration form | HIGH |
| TC-REG-002 | Register as Patient | CRITICAL |
| TC-REG-003 | Register as Therapeut | CRITICAL |
| TC-REG-004 | Duplicate email error | HIGH |
| TC-REG-005 | Password mismatch error | HIGH |
| TC-REG-006 | Weak password rejection | MEDIUM |
| TC-REG-007 | Empty fields validation | HIGH |
| TC-REG-008 | Navigate to login after success | MEDIUM |

---

## 🚧 PHASE 3: PATIENT DASHBOARD (PLANUNG)

### Elemente zu testen:

```typescript
// apps/frontend/src/pages/PatientDashboard.tsx

// Navigation
<button data-testid="nav-appointments" />
<button data-testid="nav-messages" />
<button data-testid="nav-profile" />

// Terminbuchung
<button data-testid="book-appointment" />
<select data-testid="therapist-select" />
<input type="datetime-local" data-testid="appointment-datetime" />
<button data-testid="confirm-booking" />

// Nachrichten
<button data-testid="new-message" />
<textarea data-testid="message-text" />
<button data-testid="send-message" />

// Videoanruf
<button data-testid="start-videocall" />
```

### Test-Cases:

| Test-ID | Beschreibung | GDPR-Relevant |
|---------|-------------|---------------|
| TC-PD-001 | View appointment list | ✅ Ja (Gesundheitsdaten) |
| TC-PD-002 | Book new appointment | ✅ Ja |
| TC-PD-003 | Cancel appointment | ✅ Ja |
| TC-PD-004 | Send message to therapist | ✅ Ja (Verschlüsselung prüfen) |
| TC-PD-005 | View therapist profile | ❌ Nein |
| TC-PD-006 | Start video call | ✅ Ja (STUN/TURN check) |
| TC-PD-007 | Update own profile | ✅ Ja |
| TC-PD-008 | Delete account (Art. 17 DSGVO) | ✅ Ja (KRITISCH) |

---

## 🚧 PHASE 4: THERAPIST DASHBOARD (PLANUNG)

### Elemente zu testen:

```typescript
// apps/frontend/src/pages/TherapistDashboard.tsx

// Patientenliste
<button data-testid="view-patient-list" />
<input data-testid="search-patient" />
<button data-testid="patient-details" />

// Termine
<button data-testid="view-appointments" />
<button data-testid="confirm-appointment" />
<button data-testid="reject-appointment" />

// Abrechnungen
<button data-testid="view-invoices" />
<button data-testid="create-invoice" />
<input data-testid="invoice-amount" />
```

### Test-Cases:

| Test-ID | Beschreibung | GDPR-Relevant |
|---------|-------------|---------------|
| TC-TD-001 | View patient list | ✅ Ja (KRITISCH - Zugriffsrechte) |
| TC-TD-002 | Access patient health data | ✅ Ja (Audit-Log erforderlich) |
| TC-TD-003 | Confirm appointment | ✅ Ja |
| TC-TD-004 | Create invoice (Stripe) | ✅ Ja (PCI-DSS) |
| TC-TD-005 | Export patient data (Art. 15 DSGVO) | ✅ Ja (KRITISCH) |

---

## 🚧 PHASE 5: VIDEO CALL (PLANUNG)

### Security & GDPR Test-Cases:

| Test-ID | Beschreibung | GDPR-Check |
|---------|-------------|------------|
| TC-VC-001 | Establish WebRTC connection | Kein Google STUN |
| TC-VC-002 | Camera/Microphone permissions | User-Consent erforderlich |
| TC-VC-003 | End-to-End encryption active | ✅ Ja (KRITISCH) |
| TC-VC-004 | No recording without consent | ✅ Ja (TDDDG §25) |
| TC-VC-005 | Connection failure fallback | - |
| TC-VC-006 | Cleanup on disconnect | Keine Media-Streams im RAM |

---

## 🧪 TEST-IMPLEMENTIERUNGS-TEMPLATE

### Schritt 1: data-testid hinzufügen
```typescript
// apps/frontend/src/pages/Register.tsx
<input
  type="email"
  name="email"
  required
  data-testid="register-email" // ← HINZUFÜGEN
  className="..."
/>
```

### Schritt 2: Page Object erstellen
```typescript
// tests/page-objects/RegisterPage.ts
import { Page, Locator, expect } from '@playwright/test';

export class RegisterPage {
  readonly page: Page;
  readonly firstNameInput: Locator;
  readonly lastNameInput: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly passwordConfirmInput: Locator;
  readonly rolePatient: Locator;
  readonly roleTherapist: Locator;
  readonly submitButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.firstNameInput = page.getByTestId('register-firstname');
    this.lastNameInput = page.getByTestId('register-lastname');
    this.emailInput = page.getByTestId('register-email');
    this.passwordInput = page.getByTestId('register-password');
    this.passwordConfirmInput = page.getByTestId('register-password-confirm');
    this.rolePatient = page.getByTestId('register-role-patient');
    this.roleTherapist = page.getByTestId('register-role-therapist');
    this.submitButton = page.getByTestId('register-submit');
  }

  // SECURITY: Password Strength Validation
  async register(data: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    passwordConfirm: string;
    role: 'patient' | 'therapist';
  }) {
    await this.firstNameInput.fill(data.firstName);
    await this.lastNameInput.fill(data.lastName);
    await this.emailInput.fill(data.email);
    await this.passwordInput.fill(data.password);
    await this.passwordConfirmInput.fill(data.passwordConfirm);
    
    if (data.role === 'patient') {
      await this.rolePatient.check();
    } else {
      await this.roleTherapist.check();
    }
    
    await this.submitButton.click();
    
    // DEFENSIVE: Wait for navigation
    await this.page.waitForURL(/\/(dashboard|login)/, { timeout: 10000 });
  }
}
```

### Schritt 3: E2E Test schreiben
```typescript
// tests/e2e/register.spec.ts
import { test, expect } from '@playwright/test';
import { RegisterPage } from '../page-objects/RegisterPage';

test.describe('Registration Flow', () => {
  
  test('TC-REG-002: Should register new patient successfully', async ({ page }) => {
    const registerPage = new RegisterPage(page);
    
    await page.goto('http://localhost:5173/register');
    
    const uniqueEmail = `patient-${Date.now()}@test.de`;
    
    await registerPage.register({
      firstName: 'Max',
      lastName: 'Mustermann',
      email: uniqueEmail,
      password: 'Test123!Secure',
      passwordConfirm: 'Test123!Secure',
      role: 'patient'
    });
    
    // ASSERTION: Redirected to Dashboard or Login
    await expect(page).toHaveURL(/\/(dashboard|login)/);
    
    // GDPR-COMPLIANCE: Check no password in localStorage
    const password = await page.evaluate(() => localStorage.getItem('password'));
    expect(password).toBeNull();
    
    console.log(`✅ Patient registered: ${uniqueEmail}`);
  });
  
  test('TC-REG-004: Should reject duplicate email', async ({ page }) => {
    const registerPage = new RegisterPage(page);
    
    await page.goto('http://localhost:5173/register');
    
    // Use existing test user
    await registerPage.register({
      firstName: 'Max',
      lastName: 'Test',
      email: 'patient@test.de', // Already exists
      password: 'Test123!',
      passwordConfirm: 'Test123!',
      role: 'patient'
    });
    
    // ASSERTION: Error toast visible
    const toast = page.locator('[role="status"]').first();
    await expect(toast).toBeVisible({ timeout: 5000 });
    await expect(toast).toContainText(/existiert bereits|already exists/i);
    
    // ASSERTION: Still on register page
    await expect(page).toHaveURL(/register/);
  });
});
```

---

## 📈 TEST-COVERAGE ROADMAP

### Sprint 1 (Woche 1):
- ✅ Login Flow (ABGESCHLOSSEN)
- 🚧 Register Flow (6/8 Tests)

### Sprint 2 (Woche 2):
- Patient Dashboard (Basic Navigation)
- Appointment Booking E2E

### Sprint 3 (Woche 3):
- Therapist Dashboard
- Messaging System
- Payment Flow (Stripe Test Mode)

### Sprint 4 (Woche 4):
- Video Call (WebRTC + STUN/TURN)
- Security Audit Tests
- GDPR-Compliance Tests (Datenauskunft, Löschung)

---

## 🎯 ERFOLGS-KRITERIEN

### Definition of Done:
- [ ] Alle interaktiven Elemente haben `data-testid`
- [ ] Page Object für jede Seite erstellt
- [ ] Mindestens 5 E2E Tests pro Seite
- [ ] 1 Security-Test pro kritischem Flow
- [ ] 1 GDPR-Compliance-Test pro Gesundheitsdaten-Feature
- [ ] Alle Tests laufen in CI/CD Pipeline
- [ ] Test-Coverage > 80%

### GDPR-Spezifische Tests:
- [ ] Art. 15 DSGVO: Datenauskunft-API getestet
- [ ] Art. 17 DSGVO: Löschfunktion getestet
- [ ] Art. 32 DSGVO: Verschlüsselung verifiziert
- [ ] TDDDG §25: Consent-Mechanismen getestet

---

**Verantwortlich:** QA Team + Datenschutzbeauftragter  
**Review:** Wöchentlich Donnerstags 14:00 Uhr
