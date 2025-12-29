/**
 * Test-User erstellen für Browser-Testing
 * Legt 1 Therapeut und 1 Patient an
 */

const http = require('http');

const users = [
  {
    email: 'therapeut@test.de',
    password: 'Test1234!',
    firstName: 'Dr. Anna',
    lastName: 'Schmidt',
    role: 'therapist',
    phone: '+49123456789',
    gdprConsent: true,
    specialization: 'Neurologie',
    licenseNumber: 'DE-12345',
    hourlyRate: 120
  },
  {
    email: 'patient@test.de',
    password: 'Test1234!',
    firstName: 'Max',
    lastName: 'Mustermann',
    role: 'patient',
    phone: '+49987654321',
    gdprConsent: true
  }
];

async function registerUser(user) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(user);
    
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/auth/register',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        if (res.statusCode === 201 || res.statusCode === 200) {
          console.log(`✅ User erstellt: ${user.email} (${user.role})`);
          resolve(body);
        } else if (res.statusCode === 409) {
          console.log(`ℹ️  User existiert bereits: ${user.email}`);
          resolve(body);
        } else {
          console.error(`❌ Fehler ${res.statusCode} für ${user.email}: ${body}`);
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', (error) => {
      console.error(`❌ Netzwerkfehler für ${user.email}:`, error.message);
      reject(error);
    });

    req.write(data);
    req.end();
  });
}

async function createTestUsers() {
  console.log('🔧 Erstelle Test-User...\n');
  
  for (const user of users) {
    try {
      await registerUser(user);
      await new Promise(resolve => setTimeout(resolve, 500)); // Kurze Pause
    } catch (error) {
      console.error(`Fehler beim Erstellen von ${user.email}:`, error.message);
    }
  }
  
  console.log('\n✅ Test-User Erstellung abgeschlossen!');
  console.log('\n📋 Login-Daten:');
  console.log('━'.repeat(50));
  console.log('Therapeut:');
  console.log('  Email:    therapeut@test.de');
  console.log('  Passwort: Test1234!');
  console.log('');
  console.log('Patient:');
  console.log('  Email:    patient@test.de');
  console.log('  Passwort: Test1234!');
  console.log('━'.repeat(50));
}

// Warte kurz damit Backend vollständig gestartet ist
setTimeout(createTestUsers, 2000);
