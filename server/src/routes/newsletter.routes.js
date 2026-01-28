/**
 * Newsletter Routes
 * 
 * Public newsletter subscription endpoints with:
 * - Rate limiting (3 requests per hour per IP)
 * - Email validation and normalization
 * - Admin-only statistics endpoint
 * 
 * Security considerations:
 * - Rate limiting prevents subscription spam
 * - Email normalization prevents duplicate entries
 */

import express from 'express';
import { 
  validateRequest, 
  stripUnexpectedFields,
  validationSchemas,
} from '../middleware/inputValidation.middleware.js';
import { NewsletterController } from '../controllers/newsletter.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireSystemAdmin } from '../middleware/admin.middleware.js';

const router = express.Router();

// =============================================================================
// PUBLIC SUBSCRIPTION ENDPOINTS
// =============================================================================

/**
 * POST /api/newsletter/subscribe
 * Subscribe to newsletter
 * 
 * Rate limited: 3 requests per hour per IP (applied in security middleware)
 * Validates: Email format and length
 * Normalizes: Email to lowercase
 */
router.post(
  '/subscribe',
  stripUnexpectedFields(validationSchemas.newsletter.subscribe.allowedFields),
  validationSchemas.newsletter.subscribe.validators,
  validateRequest,
  NewsletterController.subscribe
);

/**
 * POST /api/newsletter/unsubscribe
 * Unsubscribe from newsletter
 * 
 * Rate limited: 3 requests per hour per IP
 * Validates: Email format and length
 */
router.post(
  '/unsubscribe',
  stripUnexpectedFields(validationSchemas.newsletter.unsubscribe.allowedFields),
  validationSchemas.newsletter.unsubscribe.validators,
  validateRequest,
  NewsletterController.unsubscribe
);

// =============================================================================
// ADMIN ENDPOINTS
// =============================================================================

/**
 * GET /api/newsletter/stats
 * Get newsletter subscription statistics
 * 
 * Access: System admin only
 * Returns: Active, total, and unsubscribed counts
 */
router.get(
  '/stats',
  authenticate,
  requireSystemAdmin,
  NewsletterController.getStats
);

export default router;
