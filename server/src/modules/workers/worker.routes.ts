import { Router } from 'express';
import workerController from './worker.controller';
import { authenticate } from '../../middleware/auth';
import { asyncHandler } from '../../shared/utils/asyncHandler';

const router = Router();

/**
 * @swagger
 * /workers/register:
 *   post:
 *     tags: [Workers]
 *     summary: Register a worker
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *               hostname:
 *                 type: string
 *               pid:
 *                 type: integer
 *               concurrency:
 *                 type: integer
 *               queues:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Worker registered
 */
router.post('/register', authenticate, asyncHandler(workerController.register));

/**
 * @swagger
 * /workers:
 *   get:
 *     tags: [Workers]
 *     summary: List all workers
 *     security:
 *       - BearerAuth: []
 */
router.get('/', authenticate, asyncHandler(workerController.findAll));
router.get('/:id', authenticate, asyncHandler(workerController.findById));

/**
 * @swagger
 * /workers/{id}/heartbeat:
 *   post:
 *     tags: [Workers]
 *     summary: Send worker heartbeat
 *     security:
 *       - BearerAuth: []
 */
router.post('/:id/heartbeat', authenticate, asyncHandler(workerController.heartbeat));

/**
 * @swagger
 * /workers/{id}/deregister:
 *   post:
 *     tags: [Workers]
 *     summary: Deregister a worker (graceful shutdown)
 *     security:
 *       - BearerAuth: []
 */
router.post('/:id/deregister', authenticate, asyncHandler(workerController.deregister));

export default router;
