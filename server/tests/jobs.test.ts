// ============================================
// Nova-Scheduler — Job API Integration Tests
// ============================================

import request from 'supertest';
import { createApp } from '../src/app';
import { PrismaClient } from '@prisma/client';

const app = createApp();
const prisma = new PrismaClient();

describe('Jobs API', () => {
  let authToken: string;
  let testQueueId: string;
  let testJobId: string;

  beforeAll(async () => {
    await prisma.$connect();

    // Register and login to get token
    const email = `test-jobs-${Date.now()}@nova.dev`;
    await request(app)
      .post('/api/v1/auth/register')
      .send({
        email,
        password: 'TestPassword123',
        name: 'Jobs Test User',
        organizationName: 'Jobs Test Org',
      });

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: 'TestPassword123' });

    authToken = loginRes.body.data.token;

    // Get user's org
    const meRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${authToken}`);

    const orgId = meRes.body.data.organizationId;

    // Create a project
    const projectRes = await request(app)
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: 'Test Project', organizationId: orgId });

    const projectId = projectRes.body.data.id;

    // Create a queue
    const queueRes = await request(app)
      .post('/api/v1/queues')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Test Queue',
        projectId,
        concurrencyLimit: 5,
      });

    testQueueId = queueRes.body.data.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('POST /api/v1/jobs', () => {
    it('should create an immediate job', async () => {
      const res = await request(app)
        .post('/api/v1/jobs')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Immediate Job',
          type: 'IMMEDIATE',
          queueId: testQueueId,
          priority: 2,
          payload: { action: 'test' },
        });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('Test Immediate Job');
      expect(res.body.data.status).toBe('QUEUED');
      expect(res.body.data.type).toBe('IMMEDIATE');
      testJobId = res.body.data.id;
    });

    it('should create a delayed job', async () => {
      const scheduledAt = new Date(Date.now() + 60000).toISOString();
      const res = await request(app)
        .post('/api/v1/jobs')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Delayed Job',
          type: 'DELAYED',
          queueId: testQueueId,
          scheduledAt,
          payload: { action: 'delayed-test' },
        });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('SCHEDULED');
    });

    it('should reject job with invalid priority', async () => {
      const res = await request(app)
        .post('/api/v1/jobs')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Invalid Priority',
          queueId: testQueueId,
          priority: 10,
          payload: {},
        });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/v1/jobs/batch', () => {
    it('should create batch jobs', async () => {
      const res = await request(app)
        .post('/api/v1/jobs/batch')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          queueId: testQueueId,
          jobs: [
            { name: 'Batch Job 1', payload: { index: 1 } },
            { name: 'Batch Job 2', payload: { index: 2 } },
            { name: 'Batch Job 3', payload: { index: 3 } },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.data.count).toBe(3);
      expect(res.body.data.batchId).toBeDefined();
    });
  });

  describe('GET /api/v1/jobs', () => {
    it('should list jobs with pagination', async () => {
      const res = await request(app)
        .get('/api/v1/jobs?page=1&limit=10')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.meta).toBeDefined();
      expect(res.body.meta.page).toBe(1);
    });

    it('should filter jobs by status', async () => {
      const res = await request(app)
        .get('/api/v1/jobs?status=QUEUED')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      if (res.body.data.length > 0) {
        expect(res.body.data.every((j: any) => j.status === 'QUEUED')).toBe(true);
      }
    });
  });

  describe('GET /api/v1/jobs/:id', () => {
    it('should get job details with executions and logs', async () => {
      if (!testJobId) return;

      const res = await request(app)
        .get(`/api/v1/jobs/${testJobId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(testJobId);
      expect(res.body.data.queue).toBeDefined();
      expect(res.body.data.executions).toBeDefined();
      expect(res.body.data.logs).toBeDefined();
    });

    it('should return 404 for non-existent job', async () => {
      const res = await request(app)
        .get('/api/v1/jobs/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
    });
  });
});
