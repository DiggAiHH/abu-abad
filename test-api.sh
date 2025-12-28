#!/bin/bash

echo "==================================="
echo "Abu Abad Backend API Test Script"
echo "==================================="
echo ""

# Check for jq
if ! command -v jq &> /dev/null; then
  echo "Error: 'jq' is required but not installed."
  echo "Install it with:"
  echo "  - Ubuntu/Debian: sudo apt-get install jq"
  echo "  - macOS: brew install jq"
  echo "  - Or visit: https://stedolan.github.io/jq/download/"
  exit 1
fi

BASE_URL="http://localhost:5000"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Test health endpoint
echo "1. Testing Health Endpoint..."
HEALTH=$(curl -s ${BASE_URL}/health)
if [[ $HEALTH == *"OK"* ]]; then
  echo -e "${GREEN}✓ Health check passed${NC}"
else
  echo -e "${RED}✗ Health check failed${NC}"
  exit 1
fi
echo ""

# Register a doctor
echo "2. Registering a doctor..."
REGISTER_RESPONSE=$(curl -s -X POST ${BASE_URL}/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test.doctor@example.com",
    "password": "password123",
    "name": "Dr. Test Doctor",
    "role": "doctor"
  }')
  
TOKEN=$(echo $REGISTER_RESPONSE | jq -r '.token')
DOCTOR_ID=$(echo $REGISTER_RESPONSE | jq -r '.user.id')

if [[ $TOKEN != "null" ]]; then
  echo -e "${GREEN}✓ Doctor registered successfully${NC}"
  echo "  Doctor ID: $DOCTOR_ID"
else
  echo -e "${RED}✗ Doctor registration failed${NC}"
  exit 1
fi
echo ""

# Login
echo "3. Testing Login..."
LOGIN_RESPONSE=$(curl -s -X POST ${BASE_URL}/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test.doctor@example.com",
    "password": "password123"
  }')
  
if [[ $LOGIN_RESPONSE == *"Login successful"* ]]; then
  echo -e "${GREEN}✓ Login successful${NC}"
else
  echo -e "${RED}✗ Login failed${NC}"
  exit 1
fi
echo ""

# Create a patient
echo "4. Creating a patient..."
PATIENT_RESPONSE=$(curl -s -X POST ${BASE_URL}/api/patients \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jane Patient",
    "email": "jane.patient@example.com",
    "phone": "+1234567890",
    "dateOfBirth": "1990-05-15",
    "medicalHistory": "No significant medical history"
  }')
  
PATIENT_ID=$(echo $PATIENT_RESPONSE | jq -r '.patient.id')

if [[ $PATIENT_ID != "null" ]]; then
  echo -e "${GREEN}✓ Patient created successfully${NC}"
  echo "  Patient ID: $PATIENT_ID"
else
  echo -e "${RED}✗ Patient creation failed${NC}"
  exit 1
fi
echo ""

# Create an appointment
echo "5. Creating an appointment..."
APPOINTMENT_RESPONSE=$(curl -s -X POST ${BASE_URL}/api/appointments \
  -H "Content-Type: application/json" \
  -d "{
    \"doctorId\": \"$DOCTOR_ID\",
    \"patientId\": \"$PATIENT_ID\",
    \"date\": \"2025-12-28\",
    \"startTime\": \"14:00\",
    \"endTime\": \"14:30\",
    \"type\": \"consultation\",
    \"notes\": \"Initial consultation\"
  }")
  
APPOINTMENT_ID=$(echo $APPOINTMENT_RESPONSE | jq -r '.appointment.id')

if [[ $APPOINTMENT_ID != "null" ]]; then
  echo -e "${GREEN}✓ Appointment created successfully${NC}"
  echo "  Appointment ID: $APPOINTMENT_ID"
else
  echo -e "${RED}✗ Appointment creation failed${NC}"
  exit 1
fi
echo ""

# Get available time slots
echo "6. Getting available time slots..."
SLOTS_RESPONSE=$(curl -s "${BASE_URL}/api/appointments/slots/${DOCTOR_ID}?date=2025-12-28")
SLOTS=$(echo $SLOTS_RESPONSE | jq -r '.availableSlots | length')

if [[ $SLOTS -gt 0 ]]; then
  echo -e "${GREEN}✓ Successfully retrieved $SLOTS available time slots${NC}"
  echo "  Note: 14:00 should be unavailable"
else
  echo -e "${RED}✗ Failed to retrieve time slots${NC}"
  exit 1
fi
echo ""

# Create a video room
echo "7. Creating a video call room..."
VIDEO_RESPONSE=$(curl -s -X POST ${BASE_URL}/api/video/create-room \
  -H "Content-Type: application/json" \
  -d "{
    \"appointmentId\": \"$APPOINTMENT_ID\",
    \"doctorId\": \"$DOCTOR_ID\",
    \"patientId\": \"$PATIENT_ID\"
  }")
  
ROOM_ID=$(echo $VIDEO_RESPONSE | jq -r '.roomId')

if [[ $ROOM_ID != "null" ]]; then
  echo -e "${GREEN}✓ Video room created successfully${NC}"
  echo "  Room ID: $ROOM_ID"
else
  echo -e "${RED}✗ Video room creation failed${NC}"
  exit 1
fi
echo ""

# Get all appointments
echo "8. Getting all appointments..."
ALL_APPOINTMENTS=$(curl -s "${BASE_URL}/api/appointments")
APPOINTMENT_COUNT=$(echo $ALL_APPOINTMENTS | jq -r '.appointments | length')

if [[ $APPOINTMENT_COUNT -gt 0 ]]; then
  echo -e "${GREEN}✓ Successfully retrieved $APPOINTMENT_COUNT appointments${NC}"
else
  echo -e "${RED}✗ Failed to retrieve appointments${NC}"
  exit 1
fi
echo ""

echo "==================================="
echo -e "${GREEN}✓ All tests passed!${NC}"
echo "==================================="
