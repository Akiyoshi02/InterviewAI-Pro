import express from 'express';
import { body, param } from 'express-validator';
import { ReviewController } from '../controllers/review.controller.js';
import {
  authenticate,
  requireOrganizationContext,
  requireOrgRole,
} from '../middleware/auth.middleware.js';
import { requireFeatureFlag } from '../middleware/featureFlags.middleware.js';
import { validateRequest } from '../middleware/validation.middleware.js';

const router = express.Router();

router.get(
  '/:interviewId/me',
  authenticate,
  requireFeatureFlag('enableReviews'),
  requireOrganizationContext,
  requireOrgRole(['ADMIN', 'RECRUITER', 'REVIEWER']),
  [param('interviewId').isString()],
  validateRequest,
  ReviewController.getMyReview,
);

router.get(
  '/:interviewId',
  authenticate,
  requireFeatureFlag('enableReviews'),
  requireOrganizationContext,
  requireOrgRole(['ADMIN', 'RECRUITER', 'REVIEWER']),
  [param('interviewId').isString()],
  validateRequest,
  ReviewController.listReviews,
);

router.post(
  '/:interviewId',
  authenticate,
  requireFeatureFlag('enableReviews'),
  requireOrganizationContext,
  requireOrgRole(['ADMIN', 'RECRUITER', 'REVIEWER']),
  [
    param('interviewId').isString(),
    body('score').optional().isNumeric(),
    body('decision').optional().isString(),
    body('strengths').optional().isArray(),
    body('weaknesses').optional().isArray(),
    body('notes').optional().isString(),
    body('rating').optional().isNumeric(),
    body('technicalScore').optional().isNumeric(),
    body('communicationScore').optional().isNumeric(),
    body('problemSolvingScore').optional().isNumeric(),
    body('culturalFitScore').optional().isNumeric(),
    body('recommendation').optional().isString(),
    body('overrideOverall').optional().isBoolean(),
  ],
  validateRequest,
  ReviewController.submitReview,
);

export default router;
