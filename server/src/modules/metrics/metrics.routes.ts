import { Router } from 'express';
import metricsController from './metrics.controller';
import { authenticate } from '../../middleware/auth';
import { asyncHandler } from '../../shared/utils/asyncHandler';

const router = Router();

/**
 * @swagger
 * /metrics/dashboard:
 *   get:
 *     tags: [Metrics]
 *     summary: Get comprehensive dashboard metrics
 *     description: Returns job counts, success rate, throughput, queue health, and worker utilization
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard metrics
 */
router.get('/dashboard', authenticate, asyncHandler(metricsController.getDashboard));

/**
 * @swagger
 * /metrics/dlq:
 *   get:
 *     tags: [Metrics]
 *     summary: Get dead letter queue entries
 *     security:
 *       - BearerAuth: []
 *     parameters:
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
 *         description: DLQ entries
 */
router.get('/dlq', authenticate, asyncHandler(metricsController.getDeadLetterQueue));

export default router;
