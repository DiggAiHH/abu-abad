# API Documentation

> **Version:** 2.0 (PeerJS-basiert, DSGVO-konform)
> **Letzte Aktualisierung:** 2026-01-23

## Base URL
```
http://localhost:4000/api
```

## Authentication

Alle authentifizierten Endpoints benötigen einen Bearer-Token im Authorization-Header:
```
Authorization: Bearer <your-jwt-token>
```

## Endpoints

### Authentication

#### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe",
  "role": "therapist" | "patient"
}
```

Response:
```json
{
  "message": "User registered successfully",
  "token": "jwt-token-here",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "therapist"
  }
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

Response:
```json
{
  "message": "Login successful",
  "token": "jwt-token-here",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "therapist"
  }
}
```

### Patients

#### Get All Patients
```http
GET /api/patients
```

Response (DTO - keine rohen Entities):
```json
{
  "patients": [
    {
      "id": "uuid",
      "name": "Jane Smith",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

### Appointments

#### Get All Appointments
```http
GET /api/appointments?therapistId=uuid&patientId=uuid&date=2024-01-01
```

Query Parameters:
- `therapistId` (optional): Filter by therapist
- `patientId` (optional): Filter by patient
- `date` (optional): Filter by date (YYYY-MM-DD)

#### Create Appointment
```http
POST /api/appointments
Content-Type: application/json

{
  "therapistId": "uuid",
  "patientId": "uuid",
  "date": "2024-01-01",
  "startTime": "09:00",
  "endTime": "09:30",
  "type": "video-consultation",
  "notes": "Optional notes"
}
```

Response (inkl. Video-Room-ID):
```json
{
  "message": "Appointment created successfully",
  "appointment": {
    "id": "uuid",
    "therapistId": "uuid",
    "patientId": "uuid",
    "date": "2024-01-01",
    "startTime": "09:00",
    "endTime": "09:30",
    "type": "video-consultation",
    "status": "scheduled",
    "videoRoomId": "uuid",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

#### Get Available Time Slots
```http
GET /api/appointments/slots/:therapistId?date=2024-01-01
```

Response:
```json
{
  "date": "2024-01-01",
  "availableSlots": [
    "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
    "14:00", "14:30", "15:00", "15:30", "16:00", "16:30"
  ]
}
```

## Video Calls (PeerJS-basiert)

### Architektur
- **Signaling:** PeerJS Server (Port 9001)
- **Media:** WebRTC Peer-to-Peer
- **ICE:** Managed TURN Service (EU-basiert, DSGVO-konform)

### PeerJS Verbindung (Frontend)
```javascript
import Peer from 'peerjs';

const peer = new Peer(userId, {
  host: import.meta.env.VITE_PEER_SERVER_HOST,
  port: Number(import.meta.env.VITE_PEER_SERVER_PORT),
  path: '/peerjs',
  secure: import.meta.env.VITE_PEER_SERVER_SECURE === 'true',
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { 
        urls: import.meta.env.VITE_TURN_URL,
        username: import.meta.env.VITE_TURN_USERNAME,
        credential: import.meta.env.VITE_TURN_CREDENTIAL
      }
    ]
  }
});
```

### Call initiieren (Patient → Therapist)
```javascript
const call = peer.call(therapistPeerId, localStream);

call.on('stream', (remoteStream) => {
  remoteVideoElement.srcObject = remoteStream;
});
```

### Call annehmen (Therapist)
```javascript
peer.on('call', (call) => {
  call.answer(localStream);
  
  call.on('stream', (remoteStream) => {
    remoteVideoElement.srcObject = remoteStream;
  });
});
```

### PeerJS Health Check
```http
GET http://localhost:9001/health
```

Response:
```json
{
  "status": "OK",
  "connections": 0
}
```

## Error Responses

### 400 Bad Request
```json
{
  "message": "Validation error",
  "errors": [{ "field": "email", "message": "Invalid email format" }]
}
```

### 401 Unauthorized
```json
{
  "message": "Invalid credentials"
}
```

### 403 Forbidden
```json
{
  "message": "Access denied"
}
```

### 404 Not Found
```json
{
  "message": "Resource not found"
}
```

### 429 Too Many Requests
```json
{
  "message": "Rate limit exceeded",
  "retryAfter": 60
}
```

### 500 Internal Server Error
```json
{
  "message": "Internal server error"
}
```

## DSGVO-Compliance Notes

1. **Datenminimierung:** API-Responses enthalten nur notwendige Felder (DTOs)
2. **Keine PII in Logs:** Server loggt keine personenbezogenen Daten
3. **ICE-Server:** Managed TURN in EU-Region (keine IP-Übermittlung an US-Server)
4. **Crypto-Shredding:** Löschung durch Key-Removal implementiert
