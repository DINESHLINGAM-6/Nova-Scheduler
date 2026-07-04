import { Router } from 'express';
import projectController from './project.controller';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../shared/utils/asyncHandler';
import { createProjectSchema, updateProjectSchema } from './project.schema';

const router = Router();

/**
 * @swagger
 * /projects:
 *   post:
 *     tags: [Projects]
 *     summary: Create a new project
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, organizationId]
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               organizationId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       201:
 *         description: Project created
 */
router.post('/', authenticate, validate(createProjectSchema), asyncHandler(projectController.create));

/**
 * @swagger
 * /projects:
 *   get:
 *     tags: [Projects]
 *     summary: List projects
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: orgId
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
 *         description: List of projects
 */
router.get('/', authenticate, asyncHandler(projectController.findAll));

router.get('/:id', authenticate, asyncHandler(projectController.findById));
router.put('/:id', authenticate, validate(updateProjectSchema), asyncHandler(projectController.update));
router.delete('/:id', authenticate, asyncHandler(projectController.delete));

export default router;
