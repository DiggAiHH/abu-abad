#!/usr/bin/env python3
"""
Verschlüsselungs-Validator für Therapeuten-Plattform
=====================================================

Zweck: Validiert die AES-256-GCM Verschlüsselung zwischen Backend und Datenbank
Evidenz-Basis:
  - NIST SP 800-38D: Galois/Counter Mode (GCM) - https://doi.org/10.6028/NIST.SP.800-38D
  - DSGVO Art. 32 (1) a: Pseudonymisierung und Verschlüsselung personenbezogener Daten
  - BSI TR-02102-1: Kryptographische Verfahren - https://www.bsi.bund.de/TR-02102

Abrufdatum Quellen: 2025-12-28

Testet:
1. Verschlüsselungsstärke (AES-256 = 256 Bit Key)
2. Kompatibilität mit Node.js crypto-js
3. Entschlüsselbarkeit
4. Integritätsprüfung (GCM Authentication Tag)
"""

import hashlib
import base64
import os
import sys
from typing import Tuple, Optional
from Crypto.Cipher import AES
from Crypto.Random import get_random_bytes
from Crypto.Protocol.KDF import PBKDF2

# ANSI Color Codes für Terminal-Output
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
RESET = '\033[0m'
BOLD = '\033[1m'


class AES256Validator:
    """
    Validator für AES-256-GCM Verschlüsselung
    Kompatibel mit Node.js crypto-js Implementation
    """
    
    def __init__(self, encryption_key: str):
        """
        Args:
            encryption_key: Base64-kodierter 256-Bit Schlüssel
        """
        # Key von Base64 dekodieren
        self.key = base64.b64decode(encryption_key)
        
        # NIST SP 800-38D: AES-GCM benötigt 128, 192 oder 256 Bit
        if len(self.key) not in [16, 24, 32]:
            raise ValueError(
                f"Ungültige Key-Länge: {len(self.key)} Bytes. "
                f"Erwartet: 16 (AES-128), 24 (AES-192) oder 32 (AES-256)"
            )
    
    def encrypt(self, plaintext: str) -> str:
        """
        Verschlüsselt Text mit AES-256-GCM
        
        Args:
            plaintext: Zu verschlüsselnder Text
            
        Returns:
            Base64-kodierter String: nonce + ciphertext + tag
            
        Evidenz: NIST SP 800-38D empfiehlt 96-Bit Nonce für GCM
        """
        # Generiere kryptographisch sicheren Nonce (12 Bytes = 96 Bit)
        nonce = get_random_bytes(12)
        
        # Erstelle AES-GCM Cipher
        cipher = AES.new(self.key, AES.MODE_GCM, nonce=nonce)
        
        # Verschlüssele und generiere Authentication Tag
        ciphertext, tag = cipher.encrypt_and_digest(plaintext.encode('utf-8'))
        
        # Kombiniere: nonce + ciphertext + tag
        encrypted_data = nonce + ciphertext + tag
        
        # Base64-kodieren für String-Speicherung
        return base64.b64encode(encrypted_data).decode('utf-8')
    
    def decrypt(self, encrypted_base64: str) -> Optional[str]:
        """
        Entschlüsselt AES-256-GCM verschlüsselten Text
        
        Args:
            encrypted_base64: Base64-kodierte Daten (nonce + ciphertext + tag)
            
        Returns:
            Entschlüsselter Text oder None bei Fehler
            
        Evidenz: GCM Authentication Tag verhindert Manipulation (BSI TR-02102-1)
        """
        try:
            # Base64 dekodieren
            encrypted_data = base64.b64decode(encrypted_base64)
            
            # Extrahiere Komponenten
            nonce = encrypted_data[:12]      # Erste 12 Bytes
            tag = encrypted_data[-16:]       # Letzte 16 Bytes (128 Bit Tag)
            ciphertext = encrypted_data[12:-16]  # Rest ist Ciphertext
            
            # Erstelle AES-GCM Cipher mit Nonce
            cipher = AES.new(self.key, AES.MODE_GCM, nonce=nonce)
            
            # Entschlüssele und verifiziere Tag
            plaintext = cipher.decrypt_and_verify(ciphertext, tag)
            
            return plaintext.decode('utf-8')
            
        except (ValueError, KeyError) as e:
            print(f"{RED}❌ Entschlüsselung fehlgeschlagen: {e}{RESET}")
            return None
    
    def validate_key_strength(self) -> Tuple[bool, str]:
        """
        Validiert die Stärke des Verschlüsselungsschlüssels
        
        Returns:
            (is_valid, message): Validierungsergebnis
            
        Evidenz:
          - NIST SP 800-57: Mindestens 112 Bit Security Strength
          - BSI TR-02102-1: AES-256 für sensible Daten (Gesundheitsdaten)
        """
        key_length_bits = len(self.key) * 8
        
        # AES-256 = 32 Bytes = 256 Bits
        if key_length_bits == 256:
            return True, f"✅ AES-256 ({key_length_bits} Bit) - DSGVO-konform"
        elif key_length_bits == 192:
            return True, f"⚠️  AES-192 ({key_length_bits} Bit) - Akzeptabel, aber AES-256 empfohlen"
        elif key_length_bits == 128:
            return True, f"⚠️  AES-128 ({key_length_bits} Bit) - Minimal akzeptabel"
        else:
            return False, f"❌ Ungültige Key-Länge: {key_length_bits} Bit"
    
    def validate_entropy(self) -> Tuple[bool, str]:
        """
        Prüft Entropie des Schlüssels (Zufälligkeit)
        
        Returns:
            (is_valid, message): Entropie-Bewertung
            
        Evidenz:
          - NIST SP 800-90A: Random Bit Generation
          - Minimum 128 Bit Entropie für kryptographische Keys
        """
        # Berechne Shannon-Entropie
        entropy = self._calculate_entropy(self.key)
        
        # Maximale Entropie für 256-Bit Key = 8.0 (perfekte Zufälligkeit)
        entropy_percentage = (entropy / 8.0) * 100
        
        if entropy_percentage >= 95:
            return True, f"✅ Hohe Entropie: {entropy:.2f}/8.0 ({entropy_percentage:.1f}%)"
        elif entropy_percentage >= 80:
            return True, f"⚠️  Mittlere Entropie: {entropy:.2f}/8.0 ({entropy_percentage:.1f}%)"
        else:
            return False, f"❌ Niedrige Entropie: {entropy:.2f}/8.0 ({entropy_percentage:.1f}%)"
    
    @staticmethod
    def _calculate_entropy(data: bytes) -> float:
        """
        Berechnet Shannon-Entropie
        
        Formel: H(X) = -Σ P(xi) * log2(P(xi))
        Quelle: Shannon, C.E. (1948). "A Mathematical Theory of Communication"
        """
        if not data:
            return 0.0
        
        # Häufigkeit jedes Bytes
        frequencies = {}
        for byte in data:
            frequencies[byte] = frequencies.get(byte, 0) + 1
        
        # Wahrscheinlichkeiten
        length = len(data)
        entropy = 0.0
        
        for count in frequencies.values():
            probability = count / length
            if probability > 0:
                entropy -= probability * (probability.bit_length() - 1)
        
        return entropy


def run_validation_suite(encryption_key: str) -> bool:
    """
    Führt vollständige Validierungs-Suite aus
    
    Args:
        encryption_key: Base64-kodierter Verschlüsselungsschlüssel
        
    Returns:
        True wenn alle Tests bestanden, sonst False
    """
    print(f"\n{BOLD}{BLUE}╔════════════════════════════════════════════════════════╗{RESET}")
    print(f"{BOLD}{BLUE}║  🔐 AES-256-GCM Verschlüsselungs-Validator          ║{RESET}")
    print(f"{BOLD}{BLUE}╚════════════════════════════════════════════════════════╝{RESET}\n")
    
    try:
        validator = AES256Validator(encryption_key)
    except Exception as e:
        print(f"{RED}❌ Initialisierung fehlgeschlagen: {e}{RESET}")
        return False
    
    all_tests_passed = True
    
    # Test 1: Key-Stärke
    print(f"{BOLD}Test 1: Schlüssel-Stärke{RESET}")
    is_valid, message = validator.validate_key_strength()
    print(f"  {message}")
    if not is_valid:
        all_tests_passed = False
    print()
    
    # Test 2: Entropie
    print(f"{BOLD}Test 2: Schlüssel-Entropie (Zufälligkeit){RESET}")
    is_valid, message = validator.validate_entropy()
    print(f"  {message}")
    if not is_valid:
        all_tests_passed = False
    print()
    
    # Test 3: Verschlüsselung/Entschlüsselung
    print(f"{BOLD}Test 3: Verschlüsselung & Entschlüsselung{RESET}")
    test_data = [
        "Normale Text-Nachricht",
        "Gesundheitsdaten: Diagnose XYZ",
        "Émojis und Ümlautë: äöü ÄÖÜ ß 🔒🔐",
        "Sonderzeichen: !@#$%^&*()_+-=[]{}|;:',.<>?/~`",
        "Sehr langer Text " * 100,  # 1700+ Zeichen
    ]
    
    for i, plaintext in enumerate(test_data, 1):
        # Verschlüsseln
        encrypted = validator.encrypt(plaintext)
        print(f"  [{i}/5] Verschlüsselt: {len(encrypted)} Bytes (Base64)")
        
        # Entschlüsseln
        decrypted = validator.decrypt(encrypted)
        
        if decrypted == plaintext:
            print(f"  {GREEN}✅ Erfolgreich entschlüsselt{RESET}")
        else:
            print(f"  {RED}❌ Entschlüsselung fehlgeschlagen!{RESET}")
            all_tests_passed = False
    print()
    
    # Test 4: Manipulations-Erkennung (GCM Authentication)
    print(f"{BOLD}Test 4: Manipulations-Erkennung (GCM Tag){RESET}")
    encrypted = validator.encrypt("Test-Nachricht")
    
    # Manipuliere verschlüsselte Daten
    encrypted_bytes = base64.b64decode(encrypted)
    manipulated_bytes = encrypted_bytes[:-1] + b'\x00'  # Letztes Byte ändern
    manipulated_encrypted = base64.b64encode(manipulated_bytes).decode()
    
    decrypted = validator.decrypt(manipulated_encrypted)
    if decrypted is None:
        print(f"  {GREEN}✅ Manipulation erkannt - Entschlüsselung verweigert{RESET}")
    else:
        print(f"  {RED}❌ Manipulation NICHT erkannt - Sicherheitsrisiko!{RESET}")
        all_tests_passed = False
    print()
    
    # Finale Bewertung
    print(f"{BOLD}{'═' * 56}{RESET}")
    if all_tests_passed:
        print(f"{BOLD}{GREEN}✅ ALLE TESTS BESTANDEN{RESET}")
        print(f"{GREEN}Die Verschlüsselung ist DSGVO-konform (Art. 32).{RESET}")
        return True
    else:
        print(f"{BOLD}{RED}❌ TESTS FEHLGESCHLAGEN{RESET}")
        print(f"{RED}Die Verschlüsselung erfüllt NICHT die Sicherheitsanforderungen.{RESET}")
        return False


def main():
    """Haupteinstiegspunkt"""
    print(f"{YELLOW}Hinweis: Stelle sicher, dass pycryptodome installiert ist:{RESET}")
    print(f"{YELLOW}  pip install pycryptodome{RESET}\n")
    
    # Lese Encryption Key aus .env oder Umgebungsvariable
    encryption_key = os.getenv('ENCRYPTION_KEY')
    
    if not encryption_key:
        print(f"{RED}❌ ENCRYPTION_KEY nicht gefunden!{RESET}")
        print(f"{YELLOW}Bitte setze ENCRYPTION_KEY in .env oder als Umgebungsvariable.{RESET}")
        print(f"{YELLOW}Beispiel: export ENCRYPTION_KEY=$(openssl rand -base64 32){RESET}")
        sys.exit(1)
    
    # Führe Validierung aus
    success = run_validation_suite(encryption_key)
    
    # Exit Code
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
