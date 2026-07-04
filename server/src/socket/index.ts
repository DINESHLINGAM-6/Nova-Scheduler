// ============================================
// Nova-Scheduler — Socket.IO Real-time Layer
// ============================================
// Emits live updates for job status, worker status, and metrics

import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { config } from '../config';
import { logger } from '../config/logger';
import { SocketEvents } from '../shared/types';

let io: Server;

/**
 * Initialize Socket.IO server
 */
export function initializeSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: config.clientUrl,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket: Socket) => {
    logger.info(`Client connected: ${socket.id}`);

    // Join organization/project rooms for scoped events
    socket.on('join:organization', (orgId: string) => {
      socket.join(`org:${orgId}`);
      logger.debug(`Socket ${socket.id} joined org:${orgId}`);
    });

    socket.on('join:project', (projectId: string) => {
      socket.join(`project:${projectId}`);
      logger.debug(`Socket ${socket.id} joined project:${projectId}`);
    });

    socket.on('join:queue', (queueId: string) => {
      socket.join(`queue:${queueId}`);
      logger.debug(`Socket ${socket.id} joined queue:${queueId}`);
    });

    socket.on('disconnect', (reason: string) => {
      logger.info(`Client disconnected: ${socket.id} (${reason})`);
    });
  });

  return io;
}

/**
 * Get the Socket.IO server instance
 */
export function getIO(): Server {
  if (!io) {
    throw new Error('Socket.IO has not been initialized');
  }
  return io;
}

// ---- Emit Helpers ----

/**
 * Emit a job event to all connected clients
 */
export function emitJobEvent(event: SocketEvents, data: unknown): void {
  if (io) {
    io.emit(event, data);
  }
}

/**
 * Emit a job event to a specific queue room
 */
export function emitToQueue(queueId: string, event: SocketEvents, data: unknown): void {
  if (io) {
    io.to(`queue:${queueId}`).emit(event, data);
  }
}

/**
 * Emit a worker event to all connected clients
 */
export function emitWorkerEvent(event: SocketEvents, data: unknown): void {
  if (io) {
    io.emit(event, data);
  }
}

/**
 * Emit dashboard metrics update
 */
export function emitMetricsUpdate(data: unknown): void {
  if (io) {
    io.emit(SocketEvents.METRICS_UPDATED, data);
  }
}

export default { initializeSocket, getIO, emitJobEvent, emitToQueue, emitWorkerEvent, emitMetricsUpdate };
