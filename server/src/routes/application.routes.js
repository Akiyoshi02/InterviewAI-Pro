import express from 'express';
import { body, param, query } from 'express-validator';
import { ApplicationController } from '../controllers/application.controller.js';
import {
  APPLICATION_STATUSES,
  DISPOSITION_CODES,
} from '../utils/applicationLifecycle.util.js';
import {
  authenticate,
  requireCandidate,
  requireOrganizationContext,
  requireOrgRole,
} from '../middleware/auth.middleware.js';
import { requireApprovedOrganization } from '../middleware/admin.middleware.js';
import { requireFeatureFlag } from '../middleware/featureFlags.middleware.js';
import { validateRequest } from '../middleware/validation.middleware.js';

const router = express.Router();

// Submit application to a job (candidate)
router.post(
  '/jobs/:jobId/apply',
  authenticate,
  requireFeatureFlag('enableJobPosting'),
  requireCandidate,
  [
    param('jobId').isString().notEmpty(),
    body('resumeUrl').optional({ nullable: true, checkFalsy: true }).isString(),
    body('coverLetter').optional({ nullable: true, checkFalsy: true }).isString(),
    body('answers')
      .optional({ nullable: true })
      .isArray()
      .withMessage('Answers must be an array'),
    body('answers.*.questionId').optional().isString().withMessage('Each answer must have a questionId'),
    body('answers.*.answer').optional().isString().withMessage('Each answer must have an answer value'),
  ],
  validateRequest,
  ApplicationController.submitApplication,
);

// Get candidate's own applications
router.get(
  '/candidates/applications',
  authenticate,
  requireFeatureFlag('enableJobPosting'),
  requireCandidate,
  [
    query('status').optional().isIn(APPLICATION_STATUSES).withMessage('Invalid status filter'),
    query('limit').optional().isInt({ min: 1, max: 200 }).withMessage('Limit must be between 1 and 200'),
    query('cursor').optional().isString().isLength({ max: 80 }),
  ],
  validateRequest,
  ApplicationController.getCandidateApplications,
);

// Get single application details
router.get(
  '/applications/:id',
  authenticate,
  requireFeatureFlag('enableJobPosting'),
  [param('id').isString().notEmpty()],
  validateRequest,
  ApplicationController.getApplication,
);

// Withdraw application (candidate)
router.delete(
  '/applications/:id',
  authenticate,
  requireFeatureFlag('enableJobPosting'),
  requireCandidate,
  [param('id').isString().notEmpty()],
  validateRequest,
  ApplicationController.withdrawApplication,
);

// Get applications for a specific job (recruiter)
router.get(
  '/jobs/:jobId/applications',
  authenticate,
  requireFeatureFlag('enableJobPosting'),
  requireApprovedOrganization,
  requireOrgRole(['ADMIN', 'RECRUITER']),
  [
    param('jobId').isString().notEmpty(),
    query('status').optional().isIn(APPLICATION_STATUSES).withMessage('Invalid status filter'),
    query('limit').optional().isInt({ min: 1, max: 200 }).withMessage('Limit must be between 1 and 200'),
    query('cursor').optional().isString().isLength({ max: 80 }),
  ],
  validateRequest,
  ApplicationController.getJobApplications,
);

// Get all applications for organization (recruiter)
router.get(
  '/organizations/applications',
  authenticate,
  requireFeatureFlag('enableJobPosting'),
  requireApprovedOrganization,
  requireOrgRole(['ADMIN', 'RECRUITER']),
  [
    query('status').optional().isIn(APPLICATION_STATUSES).withMessage('Invalid status filter'),
    query('limit').optional().isInt({ min: 1, max: 200 }),
    query('cursor').optional().isString().isLength({ max: 80 }),
  ],
  validateRequest,
  ApplicationController.getOrganizationApplications,
);

// Bulk update application statuses (recruiter)
router.patch(
  '/applications/bulk/status',
  authenticate,
  requireFeatureFlag('enableJobPosting'),
  requireApprovedOrganization,
  requireOrgRole(['ADMIN', 'RECRUITER']),
  [
    body('applicationIds')
      .isArray({ min: 1, max: 200 })
      .withMessage('applicationIds must contain between 1 and 200 items'),
    body('applicationIds.*').isString().notEmpty(),
    body('status')
      .isIn(APPLICATION_STATUSES)
      .withMessage('Invalid status'),
    body('dispositionCode')
      .optional({ nullable: true })
      .isIn(DISPOSITION_CODES)
      .withMessage('Invalid disposition code'),
    body('dispositionCategory').optional({ nullable: true }).isString().isLength({ max: 100 }),
    body('dispositionReason').optional({ nullable: true }).isString().isLength({ max: 1000 }),
    body('dispositionNotes').optional({ nullable: true }).isString().isLength({ max: 2000 }),
    body('dispositionTags').optional({ nullable: true }).isArray({ max: 8 }),
    body('dispositionTags.*').optional().isString().isLength({ max: 80 }),
  ],
  validateRequest,
  ApplicationController.bulkUpdateApplicationStatuses,
);

// Update application status (recruiter)
router.patch(
  '/applications/:id',
  authenticate,
  requireFeatureFlag('enableJobPosting'),
  requireApprovedOrganization,
  requireOrgRole(['ADMIN', 'RECRUITER']),
  [
    param('id').isString().notEmpty(),
    body('status')
      .isIn(APPLICATION_STATUSES)
      .withMessage('Invalid status'),
    body('dispositionCode')
      .optional({ nullable: true })
      .isIn(DISPOSITION_CODES)
      .withMessage('Invalid disposition code'),
    body('dispositionCategory').optional({ nullable: true }).isString().isLength({ max: 100 }),
    body('dispositionReason').optional({ nullable: true }).isString().isLength({ max: 1000 }),
    body('dispositionNotes').optional({ nullable: true }).isString().isLength({ max: 2000 }),
    body('dispositionTags').optional({ nullable: true }).isArray({ max: 8 }),
    body('dispositionTags.*').optional().isString().isLength({ max: 80 }),
  ],
  validateRequest,
  ApplicationController.updateApplicationStatus,
);

export default router;

