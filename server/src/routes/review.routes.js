import express from 'express';
import { body, param } from 'express-validator';
import { ReviewController } from '../controllers/review.controller.js';
import {
  authenticate,
  requireOrganizationContext,
  requireOrgRole,
} from '../middleware/auth.middleware.js';
import { validateRequest } from '../middleware/validation.middleware.js';

const router = express.Router();

router.get(
  '/:interviewId',
  authenticate,
  requireOrganizationContext,
  requireOrgRole(['ADMIN', 'RECRUITER', 'REVIEWER']),
  [param('interviewId').isString()],
  validateRequest,
  ReviewController.listReviews,
);

router.post(
  '/:interviewId',
  authenticate,
  requireOrganizationContext,
  requireOrgRole(['ADMIN', 'RECRUITER', 'REVIEWER']),
  [
    param('interviewId').isString(),
    body('score').optional().isNumeric(),
    body('decision').optional().isString(),
    body('strengths').optional().isArray(),
    body('weaknesses').optional().isArray(),
    body('notes').optional().isString(),
  ],
  validateRequest,
  ReviewController.submitReview,
);

export default router;

