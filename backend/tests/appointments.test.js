const request = require('supertest');
const { app, server } = require('../server');

describe('Appointments API Tests', () => {
  let authToken;
  let doctorId;
  let patientId;

  beforeAll(async () => {
    // Register a doctor for testing
    const doctorResponse = await request(app)
      .post('/api/auth/register')
      .send({
        email: `doctor${Date.now()}@example.com`,
        password: 'SecurePassword123!',
        name: 'Dr. Test',
        role: 'doctor'
      });
    
    authToken = doctorResponse.body.token;
    doctorId = doctorResponse.body.user.id;

    // Create a patient
    const patientResponse = await request(app)
      .post('/api/patients')
      .send({
        name: 'Test Patient',
        email: `patient${Date.now()}@example.com`,
        phone: '+1234567890',
        dateOfBirth: '1990-01-01',
        medicalHistory: 'Test history'
      });
    
    patientId = patientResponse.body.patient.id;
  });

  afterAll((done) => {
    server.close(done);
  });

  describe('POST /api/appointments', () => {
    test('should create appointment successfully', async () => {
      const appointmentData = {
        doctorId,
        patientId,
        date: '2025-12-30',
        startTime: '10:00',
        endTime: '10:30',
        type: 'consultation',
        notes: 'Test appointment'
      };

      const response = await request(app)
        .post('/api/appointments')
        .send(appointmentData)
        .expect(201);

      expect(response.body.appointment).toHaveProperty('id');
      expect(response.body.appointment.status).toBe('scheduled');
    });

    test('should reject conflicting appointments', async () => {
      const appointmentData = {
        doctorId,
        patientId,
        date: '2025-12-30',
        startTime: '11:00',
        endTime: '11:30',
        type: 'consultation'
      };

      // Create first appointment
      await request(app)
        .post('/api/appointments')
        .send(appointmentData)
        .expect(201);

      // Try to create conflicting appointment (overlapping time)
      const conflictingData = {
        ...appointmentData,
        startTime: '11:15',
        endTime: '11:45'
      };

      const response = await request(app)
        .post('/api/appointments')
        .send(conflictingData)
        .expect(400);

      expect(response.body.message).toContain('not available');
    });

    test('should detect complete containment conflict', async () => {
      const appointmentData = {
        doctorId,
        patientId,
        date: '2025-12-30',
        startTime: '14:00',
        endTime: '14:30',
        type: 'consultation'
      };

      // Create first appointment
      await request(app)
        .post('/api/appointments')
        .send(appointmentData)
        .expect(201);

      // Try to create appointment that completely contains the existing one
      const containingData = {
        ...appointmentData,
        startTime: '13:45',
        endTime: '14:45'
      };

      const response = await request(app)
        .post('/api/appointments')
        .send(containingData)
        .expect(400);

      expect(response.body.message).toContain('not available');
    });
  });

  describe('GET /api/appointments/slots/:doctorId', () => {
    test('should return available time slots', async () => {
      const response = await request(app)
        .get(`/api/appointments/slots/${doctorId}?date=2025-12-31`)
        .expect(200);

      expect(response.body).toHaveProperty('availableSlots');
      expect(Array.isArray(response.body.availableSlots)).toBe(true);
      expect(response.body.availableSlots.length).toBeGreaterThan(0);
    });

    test('should exclude booked slots from available slots', async () => {
      const testDate = '2026-01-01';
      
      // Create an appointment at 15:00
      await request(app)
        .post('/api/appointments')
        .send({
          doctorId,
          patientId,
          date: testDate,
          startTime: '15:00',
          endTime: '15:30',
          type: 'consultation'
        });

      const response = await request(app)
        .get(`/api/appointments/slots/${doctorId}?date=${testDate}`)
        .expect(200);

      // 15:00 should not be in available slots
      expect(response.body.availableSlots).not.toContain('15:00');
    });
  });
});
