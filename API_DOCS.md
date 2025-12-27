# API Documentation

## Base URL
```
http://localhost:5000/api
```

## Authentication

All authenticated endpoints require a Bearer token in the Authorization header:
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
  "role": "doctor" | "patient"
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
    "role": "doctor"
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
    "role": "doctor"
  }
}
```

### Patients

#### Get All Patients
```http
GET /api/patients
```

Response:
```json
{
  "patients": [
    {
      "id": "uuid",
      "name": "Jane Smith",
      "email": "jane@example.com",
      "phone": "+1234567890",
      "dateOfBirth": "1990-01-01",
      "medicalHistory": "History notes",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

#### Create Patient
```http
POST /api/patients
Content-Type: application/json

{
  "name": "Jane Smith",
  "email": "jane@example.com",
  "phone": "+1234567890",
  "dateOfBirth": "1990-01-01",
  "medicalHistory": "Optional history notes"
}
```

### Appointments

#### Get All Appointments
```http
GET /api/appointments?doctorId=uuid&patientId=uuid&date=2024-01-01
```

Query Parameters:
- `doctorId` (optional): Filter by doctor
- `patientId` (optional): Filter by patient
- `date` (optional): Filter by date (YYYY-MM-DD)

#### Create Appointment
```http
POST /api/appointments
Content-Type: application/json

{
  "doctorId": "uuid",
  "patientId": "uuid",
  "date": "2024-01-01",
  "startTime": "09:00",
  "endTime": "09:30",
  "type": "consultation",
  "notes": "Optional notes"
}
```

Response:
```json
{
  "message": "Appointment created successfully",
  "appointment": {
    "id": "uuid",
    "doctorId": "uuid",
    "patientId": "uuid",
    "date": "2024-01-01",
    "startTime": "09:00",
    "endTime": "09:30",
    "type": "consultation",
    "status": "scheduled",
    "notes": "",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

#### Get Available Time Slots
```http
GET /api/appointments/slots/:doctorId?date=2024-01-01
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

### Video Calls

#### Create Video Room
```http
POST /api/video/create-room
Content-Type: application/json

{
  "appointmentId": "uuid",
  "doctorId": "uuid",
  "patientId": "uuid"
}
```

Response:
```json
{
  "message": "Video room created successfully",
  "roomId": "uuid",
  "session": {
    "roomId": "uuid",
    "appointmentId": "uuid",
    "doctorId": "uuid",
    "patientId": "uuid",
    "status": "active",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

#### End Video Call
```http
POST /api/video/end-call/:roomId
```

Response:
```json
{
  "message": "Call ended successfully"
}
```

## WebSocket Events (Socket.IO)

### Connection
```javascript
const socket = io('http://localhost:5000');
```

### Join Room
```javascript
socket.emit('join-room', roomId, userId);
```

### User Connected
```javascript
socket.on('user-connected', (userId) => {
  console.log('User connected:', userId);
});
```

### User Disconnected
```javascript
socket.on('user-disconnected', (userId) => {
  console.log('User disconnected:', userId);
});
```

### WebRTC Signaling
```javascript
// Send offer
socket.emit('offer', { room: roomId, offer: offerData });

// Receive offer
socket.on('offer', (data) => {
  // Handle offer
});

// Send answer
socket.emit('answer', { room: roomId, answer: answerData });

// Receive answer
socket.on('answer', (data) => {
  // Handle answer
});

// Send ICE candidate
socket.emit('ice-candidate', { room: roomId, candidate: candidateData });

// Receive ICE candidate
socket.on('ice-candidate', (data) => {
  // Handle ICE candidate
});
```

## Error Responses

All endpoints may return the following error responses:

### 400 Bad Request
```json
{
  "message": "Error message describing the problem"
}
```

### 401 Unauthorized
```json
{
  "message": "Invalid credentials"
}
```

### 404 Not Found
```json
{
  "message": "Resource not found"
}
```

### 500 Internal Server Error
```json
{
  "message": "Server error",
  "error": "Error details"
}
```
