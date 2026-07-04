import { Router } from 'express';
import queueController from './queue.controller';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../shared/utils/asyncHandler';
import { createQueueSchema, updateQueueSchema } from './queue.schema';

const router = Router();

/**
 * @swagger
 * /queues:
 *   post:
 *     tags: [Queues]
 *     summary: Create a new queue with optional retry policy
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, projectId]
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               projectId:
 *                 type: string
 *               concurrencyLimit:
 *                 type: integer
 *                 default: 5
 *               maxRatePerMinute:
 *                 type: integer
 *               retryPolicy:
 *                 type: object
 *                 properties:
 *                   name:
 *                     type: string
 *                   type:
 *                     type: string
 *                     enum: [FIXED, LINEAR, EXPONENTIAL]
 *                   maxAttempts:
 *                     type: integer
 *                   baseDelayMs:
 *                     type: integer
 *                   maxDelayMs:
 *                     type: integer
 *                   backoffMultiplier:
 *                     type: number
 *     responses:
 *       201:
 *         description: Queue created
 */
router.post('/', authenticate, validate(createQueueSchema), asyncHandler(queueController.create));

/**
 * @swagger
 * /queues:
 *   get:
 *     tags: [Queues]
 *     summary: List queues
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: projectId
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of queues
 */
router.get('/', authenticate, asyncHandler(queueController.findAll));
router.get('/:id', authenticate, asyncHandler(queueController.findById));
router.put('/:id', authenticate, validate(updateQueueSchema), asyncHandler(queueController.update));
router.delete('/:id', authenticate, asyncHandler(queueController.delete));

/**
 * @swagger
 * /queues/{id}/stats:
 *   get:
 *     tags: [Queues]
 *     summary: Get queue statistics
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Queue statistics
 */
router.get('/:id/stats', authenticate, asyncHandler(queueController.getStats));

/**
 * @swagger
 * /queues/{id}/pause:
 *   post:
 *     tags: [Queues]
 *     summary: Pause queue processing
 *     security:
 *       - BearerAuth: []
 */
router.post('/:id/pause', authenticate, asyncHandler(queueController.pause));

/**
 * @swagger
 * /queues/{id}/resume:
 *   post:
 *     tags: [Queues]
 *     summary: Resume queue processing
 *     security:
 *       - BearerAuth: []
 */
router.post('/:id/resume', authenticate, asyncHandler(queueController.resume));

export default router;
