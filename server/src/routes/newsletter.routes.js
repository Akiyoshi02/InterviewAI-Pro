import express from 'express';
import { body } from 'express-validator';
import { validateRequest } from '../middleware/validation.middleware.js';
import { NewsletterController } from '../controllers/newsletter.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireSystemAdmin } from '../middleware/admin.middleware.js';

const router = express.Router();

/**
 * @route   POST /api/newsletter/subscribe
 * @desc    Subscribe to newsletter
 * @access  Public
 */
router.post(
  '/subscribe',
  [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email is required'),
    validateRequest
  ],
  NewsletterController.subscribe
);

/**
 * @route   POST /api/newsletter/unsubscribe
 * @desc    Unsubscribe from newsletter
 * @access  Public
 */
router.post(
  '/unsubscribe',
  [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email is required'),
    validateRequest
  ],
  NewsletterController.unsubscribe
);

/**
 * @route   GET /api/newsletter/stats
 * @desc    Get newsletter statistics
 * @access  Admin only
 */
router.get(
  '/stats',
  authenticate,
  requireSystemAdmin,
  NewsletterController.getStats
);

export default router;
