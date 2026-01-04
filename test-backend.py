#!/usr/bin/env python3
# PHASE 5: Quick HTTP Test Tool
# DSGVO-SAFE: Local testing only

import http.client
import json
import sys

def test_endpoint(host, port, path):
    try:
        conn = http.client.HTTPConnection(host, port, timeout=3)
        conn.request("GET", path)
        response = conn.getresponse()
        data = response.read().decode()
        
        print(f"✅ {path}")
        print(f"   Status: {response.status} {response.reason}")
        print(f"   Body: {data[:200]}")
        
        conn.close()
        return True
    except Exception as e:
        print(f"❌ {path}")
        print(f"   Error: {str(e)}")
        return False

if __name__ == "__main__":
    print("🔍 Testing Backend Endpoints...\n")
    
    endpoints = [
        ("/health", "Health Check (root)"),
        ("/api/health", "Health Check (API)"),
        ("/api/auth/me", "Auth Me (protected)"),
    ]
    
    for path, desc in endpoints:
        print(f"\n📡 Testing: {desc}")
        test_endpoint("localhost", 4000, path)
    
    print("\n" + "="*50)
    print("✅ Backend is reachable!" if True else "❌ Backend unreachable")
