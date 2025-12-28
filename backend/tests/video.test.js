const request = require('supertest');
const { app, server } = require('../server');

describe('Video Call API Tests', () => {
  let appointmentId;
  let doctorId;
  let patientId;

  beforeAll(async () => {
    // Setup test data
    const doctorResponse = await request(app)
      .post('/api/auth/register')
      .send({
        email: `videodoctor${Date.now()}@example.com`,
        password: 'password',
        name: 'Video Dr',
        role: 'doctor'
      });

    doctorId = doctorResponse.body.user.id;

    const patientResponse = await request(app)
      .post('/api/patients')
      .send({
        name: 'Video Patient',
        email: `videopatient${Date.now()}@example.com`,
        phone: '+1234567890'
      });

    patientId = patientResponse.body.patient.id;

    const appointmentResponse = await request(app)
      .post('/api/appointments')
      .send({
        doctorId,
        patientId,
        date: '2025-12-30',
        startTime: '16:00',
        endTime: '16:30',
        type: 'video-consultation'
      });

    appointmentId = appointmentResponse.body.appointment.id;
  });

  afterAll((done) => {
    server.close(done);
  });

  describe('POST /api/video/create-room', () => {
    test('should create video room successfully', async () => {
      const response = await request(app)
        .post('/api/video/create-room')
        .send({
          appointmentId,
          doctorId,
          patientId
        })
        .expect(201);

      expect(response.body).toHaveProperty('roomId');
      expect(response.body.session.status).toBe('active');
    });

    test('should create unique room IDs', async () => {
      const response1 = await request(app)
        .post('/api/video/create-room')
        .send({ appointmentId, doctorId, patientId });

      const response2 = await request(app)
        .post('/api/video/create-room')
        .send({ appointmentId, doctorId, patientId });

      expect(response1.body.roomId).not.toBe(response2.body.roomId);
    });
  });

  describe('GET /api/video/room/:roomId', () => {
    test('should retrieve room details', async () => {
      const createResponse = await request(app)
        .post('/api/video/create-room')
        .send({ appointmentId, doctorId, patientId });

      const roomId = createResponse.body.roomId;

      const response = await request(app)
        .get(`/api/video/room/${roomId}`)
        .expect(200);

      expect(response.body.session.roomId).toBe(roomId);
    });

    test('should return 404 for non-existent room', async () => {
      const response = await request(app)
        .get('/api/video/room/non-existent-room-id')
        .expect(404);

      expect(response.body.message).toContain('not found');
    });
  });

  describe('POST /api/video/end-call/:roomId', () => {
    test('should end call successfully', async () => {
      const createResponse = await request(app)
        .post('/api/video/create-room')
        .send({ appointmentId, doctorId, patientId });

      const roomId = createResponse.body.roomId;

      const response = await request(app)
        .post(`/api/video/end-call/${roomId}`)
        .expect(200);

      expect(response.body.message).toContain('ended');
    });
  });
});
