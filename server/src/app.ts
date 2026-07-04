// ============================================
// Nova-Scheduler — Express Application Setup
// ============================================
// Core application configuration with middleware pipeline

import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';

import { config } from './config';
import { logger } from './config/logger';
import { errorHandler } from './middleware/errorHandler';
import { apiRateLimiter } from './middleware/rateLimiter';
import { API_PREFIX, SWAGGER_PATH, APP_NAME } from './shared/constants';

// Import route modules
import authRoutes from './modules/auth/auth.routes';
import orgRoutes from './modules/organizations/org.routes';
import projectRoutes from './modules/projects/project.routes';
import queueRoutes from './modules/queues/queue.routes';
import jobRoutes from './modules/jobs/job.routes';
import workerRoutes from './modules/workers/worker.routes';
import metricsRoutes from './modules/metrics/metrics.routes';

// Import Swagger spec
import { swaggerSpec } from './config/swagger';

/**
 * Create and configure the Express application
 */
export function createApp(): Application {
  const app = express();

  // ---- Security Middleware ----
  app.use(helmet());
  app.use(cors({
    origin: config.clientUrl,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));

  // ---- Parsing Middleware ----
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // ---- Logging Middleware ----
  app.use(morgan('combined', {
    stream: {
      write: (message: string) => logger.http(message.trim()),
    },
  }));

  // ---- Rate Limiting ----
  app.use(`${API_PREFIX}/`, apiRateLimiter);

  // ---- API Documentation ----
  app.use(SWAGGER_PATH, swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: `${APP_NAME} API Documentation`,
  }));

  // ---- Health Check ----
  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      message: `${APP_NAME} is running`,
      timestamp: new Date().toISOString(),
      environment: config.nodeEnv,
      uptime: process.uptime(),
    });
  });

  // ---- API Routes ----
  app.use(`${API_PREFIX}/auth`, authRoutes);
  app.use(`${API_PREFIX}/organizations`, orgRoutes);
  app.use(`${API_PREFIX}/projects`, projectRoutes);
  app.use(`${API_PREFIX}/queues`, queueRoutes);
  app.use(`${API_PREFIX}/jobs`, jobRoutes);
  app.use(`${API_PREFIX}/workers`, workerRoutes);
  app.use(`${API_PREFIX}/metrics`, metricsRoutes);

  // ---- 404 Handler ----
  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      message: 'Route not found',
    });
  });

  // ---- Global Error Handler (must be last) ----
  app.use(errorHandler);

  return app;
}

export default createApp;
