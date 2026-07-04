// ============================================
// Nova-Scheduler — Auth Integration Tests
// ============================================

import request from 'supertest';
import { createApp } from '../src/app';
import { PrismaClient } from '@prisma/client';

const app = createApp();
const prisma = new PrismaClient();

describe('Auth API', () => {
  let authToken: string;

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    // Cleanup test users
    await prisma.user.deleteMany({
      where: { email: { startsWith: 'test-' } },
    });
    await prisma.$disconnect();
  });

  describe('POST /api/v1/auth/register', () => {
    it('should register a new user', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: `test-${Date.now()}@nova.dev`,
          password: 'TestPassword123',
          name: 'Test User',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user.email).toContain('test-');
    });

    it('should register with organization', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: `test-org-${Date.now()}@nova.dev`,
          password: 'TestPassword123',
          name: 'Org Creator',
          organizationName: 'Test Org',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.user.role).toBe('ADMIN');
    });

    it('should reject duplicate email', async () => {
      const email = `test-dup-${Date.now()}@nova.dev`;

      await request(app)
        .post('/api/v1/auth/register')
        .send({ email, password: 'TestPassword123', name: 'User 1' });

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ email, password: 'TestPassword123', name: 'User 2' });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it('should reject invalid email format', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'not-an-email',
          password: 'TestPassword123',
          name: 'Test',
        });

      expect(res.status).toBe(400);
    });

    it('should reject short password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: `test-short-${Date.now()}@nova.dev`,
          password: '123',
          name: 'Test',
        });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    const testEmail = `test-login-${Date.now()}@nova.dev`;

    beforeAll(async () => {
      await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: testEmail,
          password: 'TestPassword123',
          name: 'Login Test User',
        });
    });

    it('should login with valid credentials', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: testEmail, password: 'TestPassword123' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      authToken = res.body.data.token;
    });

    it('should reject invalid password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: testEmail, password: 'WrongPassword' });

      expect(res.status).toBe(401);
    });

    it('should reject non-existent email', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'nonexistent@nova.dev', password: 'TestPassword123' });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('should return user profile with valid token', async () => {
      if (!authToken) return;

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.email).toBeDefined();
      expect(res.body.data.name).toBeDefined();
    });

    it('should reject request without token', async () => {
      const res = await request(app).get('/api/v1/auth/me');

      expect(res.status).toBe(401);
    });

    it('should reject invalid token', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(res.status).toBe(401);
    });
  });
});
