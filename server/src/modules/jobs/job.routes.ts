import { Router } from 'express';
import jobController from './job.controller';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../shared/utils/asyncHandler';
import { createJobSchema, updateJobSchema, jobFilterSchema, batchJobSchema } from './job.schema';

const router = Router();

/**
 * @swagger
 * /jobs:
 *   post:
 *     tags: [Jobs]
 *     summary: Create a new job
 *     description: Supports IMMEDIATE, DELAYED, SCHEDULED, RECURRING, and BATCH job types
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, queueId]
 *             properties:
 *               name:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [IMMEDIATE, DELAYED, SCHEDULED, RECURRING, BATCH]
 *               payload:
 *                 type: object
 *               queueId:
 *                 type: string
 *               priority:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *               maxRetries:
 *                 type: integer
 *               timeoutMs:
 *                 type: integer
 *               scheduledAt:
 *                 type: string
 *                 format: date-time
 *               cronExpression:
 *                 type: string
 *     responses:
 *       201:
 *         description: Job created
 */
router.post('/', authenticate, validate(createJobSchema), asyncHandler(jobController.create));

/**
 * @swagger
 * /jobs/batch:
 *   post:
 *     tags: [Jobs]
 *     summary: Create batch jobs
 *     description: Atomically creates multiple jobs in a single transaction
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [queueId, jobs]
 *             properties:
 *               queueId:
 *                 type: string
 *               jobs:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                     payload:
 *                       type: object
 *                     priority:
 *                       type: integer
 *     responses:
 *       201:
 *         description: Batch created
 */
router.post('/batch', authenticate, validate(batchJobSchema), asyncHandler(jobController.createBatch));

/**
 * @swagger
 * /jobs:
 *   get:
 *     tags: [Jobs]
 *     summary: List jobs with filtering, pagination, and sorting
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [QUEUED, SCHEDULED, CLAIMED, RUNNING, COMPLETED, FAILED, RETRYING, CANCELLED, TIMED_OUT]
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [IMMEDIATE, DELAYED, SCHEDULED, RECURRING, BATCH]
 *       - in: query
 *         name: priority
 *         schema:
 *           type: integer
 *       - in: query
 *         name: queueId
 *         schema:
 *           type: string
 *       - in: query
 *         name: search
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
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [createdAt, priority, status, name]
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *     responses:
 *       200:
 *         description: List of jobs
 */
router.get('/', authenticate, validate(jobFilterSchema, 'query'), asyncHandler(jobController.findAll));

router.get('/:id', authenticate, asyncHandler(jobController.findById));
router.put('/:id', authenticate, validate(updateJobSchema), asyncHandler(jobController.update));
router.delete('/:id', authenticate, asyncHandler(jobController.delete));

/**
 * @swagger
 * /jobs/{id}/retry:
 *   post:
 *     tags: [Jobs]
 *     summary: Retry a failed job
 *     security:
 *       - BearerAuth: []
 */
router.post('/:id/retry', authenticate, asyncHandler(jobController.retry));

/**
 * @swagger
 * /jobs/{id}/logs:
 *   get:
 *     tags: [Jobs]
 *     summary: Get execution logs for a job
 *     security:
 *       - BearerAuth: []
 */
router.get('/:id/logs', authenticate, asyncHandler(jobController.getLogs));

export default router;
