// ============================================
// Nova-Scheduler — Database Seed Data
// ============================================

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Clean existing data
  await prisma.workerHeartbeat.deleteMany();
  await prisma.jobLog.deleteMany();
  await prisma.jobExecution.deleteMany();
  await prisma.deadLetterQueue.deleteMany();
  await prisma.scheduledJob.deleteMany();
  await prisma.job.deleteMany();
  await prisma.queue.deleteMany();
  await prisma.retryPolicy.deleteMany();
  await prisma.project.deleteMany();
  await prisma.worker.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();

  // 1. Create Organization
  const org = await prisma.organization.create({
    data: {
      name: 'Nova Labs',
      slug: 'nova-labs',
    },
  });
  console.log('✅ Organization created:', org.name);

  // 2. Create Users
  const adminPassword = await bcrypt.hash('admin123', 12);
  const memberPassword = await bcrypt.hash('member123', 12);

  const admin = await prisma.user.create({
    data: {
      email: 'admin@nova.dev',
      password: adminPassword,
      name: 'Admin User',
      role: 'ADMIN',
      organizationId: org.id,
    },
  });

  const member = await prisma.user.create({
    data: {
      email: 'member@nova.dev',
      password: memberPassword,
      name: 'Team Member',
      role: 'MEMBER',
      organizationId: org.id,
    },
  });
  console.log('✅ Users created: admin@nova.dev, member@nova.dev');

  // 3. Create Projects
  const backendProject = await prisma.project.create({
    data: {
      name: 'Backend Services',
      description: 'Core backend microservices',
      organizationId: org.id,
      createdById: admin.id,
    },
  });

  const dataProject = await prisma.project.create({
    data: {
      name: 'Data Pipeline',
      description: 'ETL and data processing pipelines',
      organizationId: org.id,
      createdById: admin.id,
    },
  });
  console.log('✅ Projects created');

  // 4. Create Retry Policies
  const exponentialPolicy = await prisma.retryPolicy.create({
    data: {
      name: 'Exponential Backoff',
      type: 'EXPONENTIAL',
      maxAttempts: 5,
      baseDelayMs: 1000,
      maxDelayMs: 300000,
      backoffMultiplier: 2,
    },
  });

  const fixedPolicy = await prisma.retryPolicy.create({
    data: {
      name: 'Fixed Delay',
      type: 'FIXED',
      maxAttempts: 3,
      baseDelayMs: 5000,
      maxDelayMs: 5000,
      backoffMultiplier: 1,
    },
  });

  const linearPolicy = await prisma.retryPolicy.create({
    data: {
      name: 'Linear Backoff',
      type: 'LINEAR',
      maxAttempts: 4,
      baseDelayMs: 2000,
      maxDelayMs: 60000,
      backoffMultiplier: 1,
    },
  });
  console.log('✅ Retry policies created');

  // 5. Create Queues
  const emailQueue = await prisma.queue.create({
    data: {
      name: 'Email Notifications',
      description: 'Transactional email delivery',
      projectId: backendProject.id,
      concurrencyLimit: 10,
      maxRatePerMinute: 60,
      retryPolicyId: exponentialPolicy.id,
    },
  });

  const apiQueue = await prisma.queue.create({
    data: {
      name: 'API Webhooks',
      description: 'Outbound webhook delivery',
      projectId: backendProject.id,
      concurrencyLimit: 5,
      retryPolicyId: fixedPolicy.id,
    },
  });

  const etlQueue = await prisma.queue.create({
    data: {
      name: 'ETL Processing',
      description: 'Data transformation jobs',
      projectId: dataProject.id,
      concurrencyLimit: 3,
      retryPolicyId: linearPolicy.id,
    },
  });

  const cleanupQueue = await prisma.queue.create({
    data: {
      name: 'Cleanup Tasks',
      description: 'Periodic cleanup and maintenance',
      projectId: backendProject.id,
      concurrencyLimit: 2,
    },
  });
  console.log('✅ Queues created');

  // 6. Create Sample Jobs
  const jobStatuses = ['QUEUED', 'COMPLETED', 'FAILED', 'RUNNING'] as const;
  const jobTypes = ['IMMEDIATE', 'DELAYED', 'SCHEDULED', 'RECURRING', 'BATCH'] as const;

  const sampleJobs = [
    { name: 'Send Welcome Email', queue: emailQueue.id, type: 'IMMEDIATE', status: 'COMPLETED', priority: 1, payload: { to: 'user@example.com', subject: 'Welcome!', body: 'Welcome to Nova!' } },
    { name: 'Send Password Reset', queue: emailQueue.id, type: 'IMMEDIATE', status: 'COMPLETED', priority: 1, payload: { to: 'user2@example.com', subject: 'Password Reset', body: 'Click here to reset.' } },
    { name: 'Send Weekly Digest', queue: emailQueue.id, type: 'RECURRING', status: 'SCHEDULED', priority: 3, payload: { template: 'weekly-digest' }, cron: '0 9 * * 1' },
    { name: 'Webhook: Order Created', queue: apiQueue.id, type: 'IMMEDIATE', status: 'COMPLETED', priority: 2, payload: { url: 'https://httpbin.org/post', method: 'POST', body: { event: 'order.created' } } },
    { name: 'Webhook: Payment Failed', queue: apiQueue.id, type: 'IMMEDIATE', status: 'FAILED', priority: 1, payload: { url: 'https://httpbin.org/status/500', method: 'POST' } },
    { name: 'Process CSV Import', queue: etlQueue.id, type: 'DELAYED', status: 'QUEUED', priority: 3, payload: { file: 'data/import-2024.csv', format: 'csv' } },
    { name: 'Generate Monthly Report', queue: etlQueue.id, type: 'SCHEDULED', status: 'SCHEDULED', priority: 4, payload: { reportType: 'monthly', month: '2024-12' } },
    { name: 'Clean Temp Files', queue: cleanupQueue.id, type: 'RECURRING', status: 'COMPLETED', priority: 5, payload: { directory: '/tmp', olderThanDays: 7 } },
    { name: 'Purge Old Logs', queue: cleanupQueue.id, type: 'IMMEDIATE', status: 'QUEUED', priority: 4, payload: { retentionDays: 30 } },
    { name: 'Sync User Data', queue: apiQueue.id, type: 'IMMEDIATE', status: 'RUNNING', priority: 2, payload: { url: 'https://httpbin.org/post', method: 'POST', body: { action: 'sync' } } },
  ];

  for (const jobData of sampleJobs) {
    const job = await prisma.job.create({
      data: {
        name: jobData.name,
        type: jobData.type as any,
        payload: jobData.payload as any,
        status: jobData.status as any,
        priority: jobData.priority,
        queueId: jobData.queue,
        maxRetries: 3,
        timeoutMs: 30000,
        cronExpression: jobData.cron,
        completedAt: jobData.status === 'COMPLETED' ? new Date() : undefined,
        failedAt: jobData.status === 'FAILED' ? new Date() : undefined,
        startedAt: ['RUNNING', 'COMPLETED', 'FAILED'].includes(jobData.status) ? new Date(Date.now() - 5000) : undefined,
      },
    });

    // Create execution records for completed/failed jobs
    if (jobData.status === 'COMPLETED' || jobData.status === 'FAILED') {
      await prisma.jobExecution.create({
        data: {
          jobId: job.id,
          attempt: 1,
          status: jobData.status === 'COMPLETED' ? 'COMPLETED' : 'FAILED',
          durationMs: Math.floor(Math.random() * 5000) + 100,
          completedAt: new Date(),
          result: jobData.status === 'COMPLETED' ? { success: true } : undefined,
          error: jobData.status === 'FAILED' ? 'Connection timeout' : undefined,
        },
      });
    }

    // Create log entries
    await prisma.jobLog.create({
      data: {
        jobId: job.id,
        level: 'INFO',
        message: `Job created: ${jobData.name}`,
      },
    });

    if (jobData.status === 'COMPLETED') {
      await prisma.jobLog.create({
        data: {
          jobId: job.id,
          level: 'INFO',
          message: 'Job completed successfully',
        },
      });
    }

    if (jobData.status === 'FAILED') {
      await prisma.jobLog.create({
        data: {
          jobId: job.id,
          level: 'ERROR',
          message: 'Job execution failed: Connection timeout',
        },
      });

      // Add failed job to DLQ
      await prisma.deadLetterQueue.create({
        data: {
          originalJobId: job.id,
          queueId: jobData.queue,
          reason: 'Max retries exhausted',
          lastError: 'Connection timeout',
          originalPayload: jobData.payload as any,
          retryCount: 3,
        },
      });
    }

    // Create scheduled job entry for recurring
    if (jobData.type === 'RECURRING' && jobData.cron) {
      await prisma.scheduledJob.create({
        data: {
          jobId: job.id,
          cronExpression: jobData.cron,
          isActive: true,
          runCount: jobData.status === 'COMPLETED' ? 5 : 0,
        },
      });
    }
  }
  console.log('✅ Sample jobs created');

  console.log('\n🎉 Database seeded successfully!');
  console.log('\n📋 Login Credentials:');
  console.log('   Admin: admin@nova.dev / admin123');
  console.log('   Member: member@nova.dev / member123');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
