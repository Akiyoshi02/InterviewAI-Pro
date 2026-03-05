import express from 'express';
import { body } from 'express-validator';
import { ReferralController } from '../controllers/referral.controller.js';
import { authenticate, requireCandidate } from '../middleware/auth.middleware.js';
import { requireSystemAdmin } from '../middleware/admin.middleware.js';
import { validateRequest } from '../middleware/validation.middleware.js';

const router = express.Router();

// Get own referral profile
router.get('/me', authenticate, requireCandidate, ReferralController.getMyReferral);

// Leaderboard (public)
router.get('/leaderboard', ReferralController.leaderboard);

// Internal: attribute referral (called at registration)
router.post(
  '/attribute',
  authenticate,
  requireSystemAdmin,
  [
    body('refCode').isString().trim().notEmpty(),
    body('newUserId').isString().trim().notEmpty(),
  ],
  validateRequest,
  ReferralController.attributeReferral,
);

// Internal: award bonus when referred user completes first interview
router.post(
  '/first-interview',
  authenticate,
  requireSystemAdmin,
  [body('userId').isString().trim().notEmpty()],
  validateRequest,
  ReferralController.onFirstInterview,
);

export default router;
