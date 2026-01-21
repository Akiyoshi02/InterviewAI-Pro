import express from 'express';
import { body, param } from 'express-validator';
import { JobController } from '../controllers/job.controller.js';
import {
  authenticate,
  requireOrganizationContext,
  requireOrgRole,
} from '../middleware/auth.middleware.js';
import { requireApprovedOrganization, allowPendingOrganization } from '../middleware/admin.middleware.js';
import { validateRequest } from '../middleware/validation.middleware.js';

const router = express.Router();

const jobValidations = [
  body('title').isString().isLength({ min: 3 }).withMessage('Title is required'),
  body('department').optional().isString(),
  body('location').optional().isString(),
  body('employmentType').optional().isString(),
  body('experienceLevel').optional().isString(),
  body('compensationRange').optional().isString(),
  body('salaryCurrency').optional().isString(),
  body('salaryMin').optional().isNumeric(),
  body('salaryMax').optional().isNumeric(),
  body('benefits').optional().isString(),
  body('description').optional().isString(),
  body('requirements').optional().isArray(),
  body('responsibilities').optional().isArray(),
  body('skills').optional().isArray(),
  body('status').optional().isIn(['DRAFT', 'PUBLISHED', 'ARCHIVED']),
  body('applicationQuestions').optional().isArray(),
  body('acceptingApplications').optional().isBoolean(),
  body('postingDuration').optional().isInt({ min: 1, max: 365 }).withMessage('Posting duration must be between 1 and 365 days'),
  body('scheduledPublishAt').optional().isISO8601().withMessage('Scheduled publish date must be a valid ISO 8601 date'),
];

// Validation for updates - title is optional since we may only update specific fields
const jobUpdateValidations = [
  body('title').optional().isString().isLength({ min: 3 }).withMessage('Title must be at least 3 characters'),
  body('department').optional().isString(),
  body('location').optional().isString(),
  body('employmentType').optional().isString(),
  body('experienceLevel').optional().isString(),
  body('compensationRange').optional().isString(),
  body('salaryCurrency').optional().isString(),
  body('salaryMin').optional().isNumeric(),
  body('salaryMax').optional().isNumeric(),
  body('benefits').optional().isString(),
  body('description').optional().isString(),
  body('requirements').optional().isArray(),
  body('responsibilities').optional().isArray(),
  body('skills').optional().isArray(),
  body('status').optional().isIn(['DRAFT', 'PUBLISHED', 'ARCHIVED']),
  body('applicationQuestions').optional().isArray(),
  body('acceptingApplications').optional().isBoolean(),
  body('postingDuration').optional().isInt({ min: 1, max: 365 }).withMessage('Posting duration must be between 1 and 365 days'),
  body('scheduledPublishAt').optional().isISO8601().withMessage('Scheduled publish date must be a valid ISO 8601 date'),
];

router.post(
  '/',
  authenticate,
  requireApprovedOrganization,
  requireOrgRole(['ADMIN', 'RECRUITER']),
  jobValidations,
  validateRequest,
  JobController.createJob,
);

router.get(
  '/',
  authenticate,
  allowPendingOrganization,
  requireOrganizationContext,
  JobController.listJobs,
);

router.get(
  '/:id',
  authenticate,
  allowPendingOrganization,
  requireOrganizationContext,
  param('id').isString(),
  validateRequest,
  JobController.getJob,
);

router.patch(
  '/:id',
  authenticate,
  requireApprovedOrganization,
  requireOrgRole(['ADMIN', 'RECRUITER']),
  jobUpdateValidations,
  validateRequest,
  JobController.updateJob,
);

router.delete(
  '/:id',
  authenticate,
  requireApprovedOrganization,
  requireOrgRole(['ADMIN', 'RECRUITER']),
  param('id').isString(),
  validateRequest,
  JobController.deleteJob,
);

export default router;

