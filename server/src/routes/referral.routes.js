import express from 'express';
import { body } from 'express-validator';
import { ReferralController } from '../controllers/referral.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { validateRequest } from '../middleware/validation.middleware.js';

const router = express.Router();

// Get own referral profile
router.get('/me', authenticate, ReferralController.getMyReferral);

// Leaderboard (public)
router.get('/leaderboard', ReferralController.leaderboard);

// Internal: attribute referral (called at registration)
router.post(
  '/attribute',
  authenticate,
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
  [body('userId').isString().trim().notEmpty()],
  validateRequest,
  ReferralController.onFirstInterview,
);

export default router;
