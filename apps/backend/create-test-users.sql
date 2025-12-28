-- Test-User für Abu-Abbad Platform
-- Security: Passwörter sind bcrypt-gehashed (Rounds: 10)
-- Default-Passwort für alle: "Test123!"

-- Patient Test-User
INSERT INTO users (email, password_hash, first_name, last_name, role, gdpr_consent, created_at)
VALUES (
  'patient@test.de',
  '$2b$10$rZJ9z8K5LxB6vYQG7xH4POyN0qBXKF.mI7J8nH1zL3kQ5mP6nR7tS',
  'Max',
  'Mustermann',
  'patient',
  true,
  NOW()
) ON CONFLICT (email) DO NOTHING;

-- Therapeut Test-User  
INSERT INTO users (email, password_hash, first_name, last_name, role, gdpr_consent, created_at)
VALUES (
  'therapeut@test.de',
  '$2b$10$rZJ9z8K5LxB6vYQG7xH4POyN0qBXKF.mI7J8nH1zL3kQ5mP6nR7tS',
  'Dr. Anna',
  'Schmidt',
  'therapist',
  true,
  NOW()
) ON CONFLICT (email) DO NOTHING;

-- Test-User erfolgreich angelegt
SELECT 'Test-Users erstellt:' as status;
SELECT email, role, first_name, last_name FROM users WHERE email IN ('patient@test.de', 'therapeut@test.de');
