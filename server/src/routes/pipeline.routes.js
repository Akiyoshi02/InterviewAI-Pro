import express from 'express';
import { body, param } from 'express-validator';
import { PipelineController } from '../controllers/pipeline.controller.js';
import {
  authenticate,
  requireOrganizationContext,
  requireOrgRole,
} from '../middleware/auth.middleware.js';
import { requireFeatureFlag } from '../middleware/featureFlags.middleware.js';
import { validateRequest } from '../middleware/validation.middleware.js';

const router = express.Router();

router.get(
  '/',
  authenticate,
  requireFeatureFlag('enableJobPosting'),
  requireOrganizationContext,
  requireOrgRole(['ADMIN', 'RECRUITER']),
  PipelineController.getPipeline,
);

router.patch(
  '/:interviewId',
  authenticate,
  requireFeatureFlag('enableJobPosting'),
  requireOrganizationContext,
  requireOrgRole(['ADMIN', 'RECRUITER']),
  [
    param('interviewId').isString(),
    body('jobStage').optional().isString(),
    body('pipelineStatus').optional().isIn(['SCREENING', 'INTERVIEW', 'FINAL', 'HIRED', 'REJECTED']),
    body('status').optional().isIn(['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'PAUSED', 'CANCELLED']),
  ],
  validateRequest,
  PipelineController.moveCandidate,
);

export default router;

