// ============================================
// Nova-Scheduler — Server Entry Point
// ============================================
// Bootstraps the HTTP server, database, Socket.IO, and scheduler engine

import http from 'http';
import { createApp } from './app';
import { config } from './config';
import { logger } from './config/logger';
import { connectDatabase, disconnectDatabase } from './config/database';
import { initializeSocket } from './socket';
import { SchedulerService } from './engine/scheduler.service';

async function bootstrap(): Promise<void> {
  // 1. Connect to database
  await connectDatabase();
  logger.info('📦 Database connected');

  // 2. Create Express app
  const app = createApp();
  const server = http.createServer(app);

  // 3. Initialize Socket.IO
  initializeSocket(server);
  logger.info('🔌 Socket.IO initialized');

  // 4. Start the scheduler engine
  const scheduler = SchedulerService.getInstance();
  scheduler.start();
  logger.info('⚙️  Scheduler engine started');

  // 5. Start HTTP server
  server.listen(config.port, () => {
    logger.info(`
╔══════════════════════════════════════════════╗
║           🚀 Nova-Scheduler Server           ║
╠══════════════════════════════════════════════╣
║  Environment : ${config.nodeEnv.padEnd(28)} ║
║  Port        : ${String(config.port).padEnd(28)} ║
║  API         : http://localhost:${config.port}/api/v1${' '.repeat(8)} ║
║  Swagger     : http://localhost:${config.port}/api-docs${' '.repeat(6)} ║
║  Health      : http://localhost:${config.port}/health${' '.repeat(7)} ║
╚══════════════════════════════════════════════╝
    `);
  });

  // ---- Graceful Shutdown ----
  const gracefulShutdown = async (signal: string): Promise<void> => {
    logger.info(`\n${signal} received. Starting graceful shutdown...`);

    // Stop accepting new connections
    server.close(() => {
      logger.info('HTTP server closed');
    });

    // Stop the scheduler (finish current jobs)
    scheduler.stop();
    logger.info('Scheduler engine stopped');

    // Disconnect database
    await disconnectDatabase();
    logger.info('Database disconnected');

    logger.info('✅ Graceful shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  // Handle unhandled rejections
  process.on('unhandledRejection', (reason: unknown) => {
    logger.error('Unhandled Rejection:', reason);
  });

  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception:', error);
    gracefulShutdown('UNCAUGHT_EXCEPTION');
  });
}

// Run
bootstrap().catch((error) => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});
