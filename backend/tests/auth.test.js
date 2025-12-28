const request = require('supertest');
const { app, server } = require('../server');

describe('Authentication API Tests', () => {
  afterAll((done) => {
    server.close(done);
  });

  describe('POST /api/auth/register', () => {
    test('should register a new user successfully', async () => {
      const userData = {
        email: `test${Date.now()}@example.com`,
        password: 'SecurePassword123!',
        name: 'Test User',
        role: 'doctor'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe(userData.email);
      expect(response.body.user.role).toBe('doctor');
    });

    test('should reject duplicate email registration', async () => {
      const userData = {
        email: 'duplicate@example.com',
        password: 'SecurePassword123!',
        name: 'Test User',
        role: 'doctor'
      };

      // Register first time
      await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      // Try to register again with same email
      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.message).toContain('already exists');
    });

    test('should reject registration without required fields', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@example.com' })
        .expect(400); // With validation, should return 400

      expect(response.body.message).toContain('Validation failed');
    });
  });

  describe('POST /api/auth/login', () => {
    const testUser = {
      email: `login${Date.now()}@example.com`,
      password: 'SecurePassword123!',
      name: 'Login Test',
      role: 'patient'
    };

    beforeAll(async () => {
      await request(app)
        .post('/api/auth/register')
        .send(testUser);
    });

    test('should login successfully with correct credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        })
        .expect(200);

      expect(response.body).toHaveProperty('token');
      expect(response.body.message).toBe('Login successful');
    });

    test('should reject login with incorrect password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'WrongPassword'
        })
        .expect(401);

      expect(response.body.message).toBe('Invalid credentials');
    });

    test('should reject login with non-existent user', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password'
        })
        .expect(401);

      expect(response.body.message).toBe('Invalid credentials');
    });
  });
});
