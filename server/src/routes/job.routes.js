import express from 'express';
import { body, param } from 'express-validator';
import { JobController } from '../controllers/job.controller.js';
import {
  authenticate,
  requireOrganizationContext,
  requireOrgRole,
} from '../middleware/auth.middleware.js';
import { validateRequest } from '../middleware/validation.middleware.js';

const router = express.Router();

const jobValidations = [
  body('title').isString().isLength({ min: 3 }).withMessage('Title is required'),
  body('department').optional().isString(),
  body('location').optional().isString(),
  body('employmentType').optional().isString(),
  body('experienceLevel').optional().isString(),
  body('compensationRange').optional().isString(),
  body('description').optional().isString(),
  body('requirements').optional().isArray(),
  body('responsibilities').optional().isArray(),
  body('skills').optional().isArray(),
  body('status').optional().isIn(['DRAFT', 'PUBLISHED', 'ARCHIVED']),
];

router.post(
  '/',
  authenticate,
  requireOrgRole(['ADMIN', 'RECRUITER']),
  jobValidations,
  validateRequest,
  JobController.createJob,
);

router.get(
  '/',
  authenticate,
  requireOrganizationContext,
  JobController.listJobs,
);

router.get(
  '/:id',
  authenticate,
  requireOrganizationContext,
  param('id').isString(),
  validateRequest,
  JobController.getJob,
);

router.patch(
  '/:id',
  authenticate,
  requireOrgRole(['ADMIN', 'RECRUITER']),
  jobValidations,
  validateRequest,
  JobController.updateJob,
);

export default router;

