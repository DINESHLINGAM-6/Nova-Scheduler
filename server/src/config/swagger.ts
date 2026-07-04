// ============================================
// Nova-Scheduler — Swagger/OpenAPI Configuration
// ============================================

import swaggerJsdoc from 'swagger-jsdoc';
import { APP_NAME, API_PREFIX } from '../shared/constants';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: `${APP_NAME} API`,
      version: '1.0.0',
      description: `
**${APP_NAME}** is a production-inspired distributed job scheduling platform 
capable of reliably executing asynchronous background jobs across multiple workers.

## Features
- 🔐 JWT Authentication with RBAC
- 📋 Organization → Project → Queue → Job hierarchy
- ⚡ Immediate, Delayed, Scheduled, Recurring (Cron), and Batch jobs
- 🔄 Configurable retry strategies (Fixed, Linear, Exponential)
- 💀 Dead Letter Queue for permanently failed jobs
- 📊 Real-time metrics and dashboards via Socket.IO
- 🏗️ Worker management with heartbeats and graceful shutdown
      `,
      contact: {
        name: 'Dinesh Lingam',
      },
    },
    servers: [
      {
        url: `http://localhost:3000${API_PREFIX}`,
        description: 'Development Server',
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT token',
        },
      },
      schemas: {
        ApiResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: { type: 'object' },
            meta: {
              type: 'object',
              properties: {
                page: { type: 'integer' },
                limit: { type: 'integer' },
                total: { type: 'integer' },
                totalPages: { type: 'integer' },
                hasNext: { type: 'boolean' },
                hasPrev: { type: 'boolean' },
              },
            },
          },
        },
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string' },
            error: { type: 'string' },
          },
        },
      },
    },
    security: [
      {
        BearerAuth: [],
      },
    ],
  },
  apis: ['./src/modules/**/*.routes.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;
