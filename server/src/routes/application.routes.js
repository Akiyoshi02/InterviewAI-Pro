import express from 'express';
import { body, param, query } from 'express-validator';
import { ApplicationController } from '../controllers/application.controller.js';
import {
  APPLICATION_STATUSES,
  DISPOSITION_CODES,
} from '../utils/applicationLifecycle.util.js';
import {
  APPLICATION_OFFER_COMPENSATION_PERIODS,
} from '../utils/applicationOffer.util.js';
import {
  authenticate,
  requireCandidate,
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
  requireOrgRole(['ADMIN', 'RECRUITER', 'REVIEWER']),
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
  requireOrgRole(['ADMIN', 'RECRUITER', 'REVIEWER']),
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
    body('interviewSchedulingMode')
      .optional({ nullable: true })
      .isIn(['AUTO', 'MANUAL'])
      .withMessage('Invalid interview scheduling mode'),
    body('reviewerAssignments')
      .optional({ nullable: true })
      .isArray({ max: 20 })
      .withMessage('reviewerAssignments must be an array'),
    body('reviewerAssignments.*')
      .optional()
      .isString()
      .isLength({ max: 100 })
      .withMessage('Each reviewer assignment must be a valid identifier'),
  ],
  validateRequest,
  ApplicationController.updateApplicationStatus,
);

router.patch(
  '/applications/:id/offer',
  authenticate,
  requireFeatureFlag('enableJobPosting'),
  requireApprovedOrganization,
  requireOrgRole(['ADMIN', 'RECRUITER']),
  [
    param('id').isString().notEmpty(),
    body('title').isString().trim().isLength({ min: 2, max: 160 }),
    body('compensationAmount').isFloat({ gt: 0 }).withMessage('Compensation amount must be greater than 0'),
    body('compensationCurrency').isString().trim().isLength({ min: 3, max: 8 }),
    body('compensationPeriod').isIn(APPLICATION_OFFER_COMPENSATION_PERIODS),
    body('startDate').isISO8601().withMessage('Offer start date must be a valid ISO date'),
    body('expiresAt').isISO8601().withMessage('Offer expiry must be a valid ISO date'),
    body('note').optional({ nullable: true }).isString().isLength({ max: 2000 }),
  ],
  validateRequest,
  ApplicationController.upsertApplicationOffer,
);

router.post(
  '/applications/:id/offer/resend',
  authenticate,
  requireFeatureFlag('enableJobPosting'),
  requireApprovedOrganization,
  requireOrgRole(['ADMIN', 'RECRUITER']),
  [param('id').isString().notEmpty()],
  validateRequest,
  ApplicationController.resendApplicationOffer,
);

router.post(
  '/applications/:id/offer/accept',
  authenticate,
  requireFeatureFlag('enableJobPosting'),
  requireCandidate,
  [param('id').isString().notEmpty()],
  validateRequest,
  ApplicationController.acceptApplicationOffer,
);

router.post(
  '/applications/:id/offer/decline',
  authenticate,
  requireFeatureFlag('enableJobPosting'),
  requireCandidate,
  [
    param('id').isString().notEmpty(),
    body('declineReason').optional({ nullable: true }).isString().isLength({ max: 1000 }),
  ],
  validateRequest,
  ApplicationController.declineApplicationOffer,
);

router.patch(
  '/applications/:id/onboarding',
  authenticate,
  requireFeatureFlag('enableJobPosting'),
  requireApprovedOrganization,
  requireOrgRole(['ADMIN', 'RECRUITER']),
  [
    param('id').isString().notEmpty(),
    body('welcomeNote').optional({ nullable: true }).isString().isLength({ max: 2000 }),
    body('startDate').optional({ nullable: true }).isISO8601().withMessage('Onboarding start date must be a valid ISO date'),
  ],
  validateRequest,
  ApplicationController.updateApplicationOnboarding,
);

router.post(
  '/applications/:id/onboarding/tasks/:taskId/respond',
  authenticate,
  requireFeatureFlag('enableJobPosting'),
  requireCandidate,
  [
    param('id').isString().notEmpty(),
    param('taskId').isString().notEmpty(),
    body('note').optional({ nullable: true }).isString().isLength({ max: 2000 }),
  ],
  validateRequest,
  ApplicationController.submitApplicationOnboardingTask,
);

router.patch(
  '/applications/:id/onboarding/tasks/:taskId',
  authenticate,
  requireFeatureFlag('enableJobPosting'),
  requireApprovedOrganization,
  requireOrgRole(['ADMIN', 'RECRUITER']),
  [
    param('id').isString().notEmpty(),
    param('taskId').isString().notEmpty(),
    body('status')
      .isIn(['APPROVED', 'REJECTED', 'COMPLETED'])
      .withMessage('Invalid onboarding task status'),
    body('note').optional({ nullable: true }).isString().isLength({ max: 2000 }),
  ],
  validateRequest,
  ApplicationController.reviewApplicationOnboardingTask,
);

export default router;

