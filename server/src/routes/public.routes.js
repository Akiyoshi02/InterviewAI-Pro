/**
 * Public Routes
 * 
 * Publicly accessible endpoints with:
 * - Rate limiting (applied in security middleware)
 * - Input validation and sanitization
 * - No authentication required
 * 
 * Security considerations:
 * - All inputs are validated and sanitized
 * - Rate limiting prevents abuse
 * - No sensitive data exposure
 */

import express from 'express';
import { param, query } from 'express-validator';
import { JobController } from '../controllers/job.controller.js';
import { InvitationController } from '../controllers/invitation.controller.js';
import { TeamInvitationController } from '../controllers/teamInvitation.controller.js';
import { AdminController } from '../controllers/admin.controller.js';
import { ContactController } from '../controllers/contact.controller.js';
import { 
  validateRequest, 
  stripUnexpectedFields,
  validationSchemas,
  LENGTH_LIMITS,
} from '../middleware/inputValidation.middleware.js';

const router = express.Router();

// =============================================================================
// SYSTEM STATUS ENDPOINTS
// =============================================================================

/**
 * GET /api/public/maintenance-status
 * Check if system is in maintenance mode
 * 
 * Rate limited: 200 requests per 15 minutes
 * No authentication required
 */
router.get('/maintenance-status', AdminController.getMaintenanceStatus);

/**
 * GET /api/public/config
 * Public config for app (e.g. nonverbal feedback enabled). No auth required.
 */
router.get('/config', AdminController.getPublicConfig);

// =============================================================================
// PUBLIC JOB LISTINGS
// =============================================================================

/**
 * GET /api/public/jobs
 * List all public job postings
 * 
 * Rate limited: 200 requests per 15 minutes
 * Query params validated: limit (1-100)
 */
router.get(
  '/jobs',
  [
    query('limit')
      .optional()
      .toInt()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
  ],
  validateRequest,
  JobController.listPublicJobs,
);

/**
 * GET /api/public/jobs/:id
 * Get a specific public job posting
 * 
 * Rate limited: 200 requests per 15 minutes
 * Validates: Job ID format
 */
router.get(
  '/jobs/:id',
  [
    param('id')
      .trim()
      .notEmpty()
      .withMessage('Job ID is required')
      .isLength({ max: LENGTH_LIMITS.ID })
      .withMessage('Invalid job ID format'),
  ],
  validateRequest,
  JobController.getPublicJob,
);

// =============================================================================
// INVITATION PREVIEWS
// =============================================================================

/**
 * GET /api/public/invitations/:token
 * Preview an interview invitation (before accepting)
 * 
 * Rate limited: 200 requests per 15 minutes
 * Validates: Token format and length
 */
router.get(
  '/invitations/:token',
  [
    param('token')
      .trim()
      .notEmpty()
      .withMessage('Invitation token is required')
      .isLength({ max: LENGTH_LIMITS.TOKEN })
      .withMessage('Invalid token format'),
  ],
  validateRequest,
  InvitationController.previewInvitation,
);

/**
 * GET /api/public/team-invitations/:token
 * Preview a team invitation (before accepting)
 * 
 * Rate limited: 200 requests per 15 minutes
 * Validates: Token format and length
 */
router.get(
  '/team-invitations/:token',
  [
    param('token')
      .trim()
      .notEmpty()
      .withMessage('Team invitation token is required')
      .isLength({ max: LENGTH_LIMITS.TOKEN })
      .withMessage('Invalid token format'),
  ],
  validateRequest,
  TeamInvitationController.getInvitationByToken,
);

// =============================================================================
// CONTACT FORM
// =============================================================================

/**
 * POST /api/public/contact
 * Submit contact form message
 * 
 * Rate limited: 5 messages per hour per IP
 * Validates: Name, email, subject, message with length limits
 * Sanitizes: All text fields to prevent XSS
 */
router.post(
  '/contact',
  stripUnexpectedFields(validationSchemas.contact.submit.allowedFields),
  validationSchemas.contact.submit.validators,
  validateRequest,
  ContactController.submit,
);

export default router;

