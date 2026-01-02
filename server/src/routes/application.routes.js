import express from 'express';
import { body, param, query } from 'express-validator';
import { ApplicationController } from '../controllers/application.controller.js';
import {
  authenticate,
  requireCandidate,
  requireOrganizationContext,
  requireOrgRole,
} from '../middleware/auth.middleware.js';
import { requireApprovedOrganization } from '../middleware/admin.middleware.js';
import { validateRequest } from '../middleware/validation.middleware.js';

const router = express.Router();

// Submit application to a job (candidate)
router.post(
  '/jobs/:jobId/apply',
  authenticate,
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
  requireCandidate,
  ApplicationController.getCandidateApplications,
);

// Get single application details
router.get(
  '/applications/:id',
  authenticate,
  [param('id').isString().notEmpty()],
  validateRequest,
  ApplicationController.getApplication,
);

// Withdraw application (candidate)
router.delete(
  '/applications/:id',
  authenticate,
  requireCandidate,
  [param('id').isString().notEmpty()],
  validateRequest,
  ApplicationController.withdrawApplication,
);

// Get applications for a specific job (recruiter)
router.get(
  '/jobs/:jobId/applications',
  authenticate,
  requireApprovedOrganization,
  requireOrgRole(['ADMIN', 'RECRUITER']),
  [param('jobId').isString().notEmpty()],
  validateRequest,
  ApplicationController.getJobApplications,
);

// Get all applications for organization (recruiter)
router.get(
  '/organizations/applications',
  authenticate,
  requireApprovedOrganization,
  requireOrgRole(['ADMIN', 'RECRUITER']),
  [query('status').optional().isString(), query('limit').optional().isInt({ min: 1, max: 200 })],
  validateRequest,
  ApplicationController.getOrganizationApplications,
);

// Update application status (recruiter)
router.patch(
  '/applications/:id',
  authenticate,
  requireApprovedOrganization,
  requireOrgRole(['ADMIN', 'RECRUITER']),
  [
    param('id').isString().notEmpty(),
    body('status')
      .isIn(['SUBMITTED', 'SCREENING', 'INTERVIEWING', 'SHORTLISTED', 'REJECTED', 'HIRED'])
      .withMessage('Invalid status'),
  ],
  validateRequest,
  ApplicationController.updateApplicationStatus,
);

export default router;

