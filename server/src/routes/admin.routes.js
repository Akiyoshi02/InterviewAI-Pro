/**
 * Admin Routes
 * 
 * System administration endpoints with:
 * - Very strict rate limiting for bootstrap endpoints
 * - System admin authentication required for most routes
 * - Comprehensive input validation
 * 
 * Security considerations:
 * - Bootstrap endpoints limited to 3 attempts per day
 * - All admin actions are logged for audit
 * - Sensitive operations require explicit reasons
 */

import express from 'express';
import { param, query } from 'express-validator';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireSystemAdmin } from '../middleware/admin.middleware.js';
import { 
  validateRequest, 
  stripUnexpectedFields,
  validationSchemas,
  commonValidators,
  LENGTH_LIMITS,
  ALLOWED_VALUES,
} from '../middleware/inputValidation.middleware.js';
import { AdminController } from '../controllers/admin.controller.js';

const router = express.Router();

// =============================================================================
// ADMIN BOOTSTRAP ENDPOINTS (Rate limited: 3 per day)
// =============================================================================

/**
 * POST /api/admin/auth/bootstrap-admin
 * Create initial system admin (one-time setup)
 * 
 * Rate limited: 3 attempts per 24 hours (very strict)
 * Should only be used once during initial setup
 */
router.post(
  '/auth/bootstrap-admin',
  stripUnexpectedFields(validationSchemas.admin.bootstrapAdmin.allowedFields),
  validationSchemas.admin.bootstrapAdmin.validators,
  validateRequest,
  AdminController.bootstrapAdmin,
);

/**
 * POST /api/admin/auth/seed-admin
 * Promote existing Firebase user to system admin
 * 
 * Rate limited: 3 attempts per 24 hours
 * Use when you have an existing user to promote
 */
router.post(
  '/auth/seed-admin',
  stripUnexpectedFields(validationSchemas.admin.seedAdmin.allowedFields),
  validationSchemas.admin.seedAdmin.validators,
  validateRequest,
  AdminController.seedAdmin,
);

// =============================================================================
// AUTHENTICATED ADMIN ROUTES
// All routes below require system admin authentication
// =============================================================================

router.use(authenticate);
router.use(requireSystemAdmin);

// =============================================================================
// ORGANIZATION MANAGEMENT
// =============================================================================

/**
 * GET /api/admin/organizations
 * List all organizations with optional filtering
 */
router.get(
  '/organizations',
  [
    commonValidators.queryParam.status(ALLOWED_VALUES.ORGANIZATION_STATUS),
    commonValidators.queryParam.limit(100, 500),
    commonValidators.queryParam.offset(),
  ],
  validateRequest,
  AdminController.listOrganizations,
);

/**
 * GET /api/admin/organizations/pending
 * List organizations pending approval
 */
router.get(
  '/organizations/pending',
  [commonValidators.queryParam.limit(50, 100)],
  validateRequest,
  AdminController.listPendingOrganizations,
);

/**
 * GET /api/admin/organizations/:id
 * Get specific organization details
 */
router.get(
  '/organizations/:id',
  [
    param('id')
      .trim()
      .notEmpty()
      .withMessage('Organization ID is required')
      .isLength({ max: LENGTH_LIMITS.ID }),
  ],
  validateRequest,
  AdminController.getOrganization,
);

/**
 * POST /api/admin/organizations/:id/approve
 * Approve an organization
 */
router.post(
  '/organizations/:id/approve',
  [
    param('id')
      .trim()
      .notEmpty()
      .withMessage('Organization ID is required')
      .isLength({ max: LENGTH_LIMITS.ID }),
  ],
  validateRequest,
  AdminController.approveOrganization,
);

/**
 * POST /api/admin/organizations/:id/reject
 * Reject an organization application
 * 
 * Requires: Rejection reason (for audit trail)
 */
router.post(
  '/organizations/:id/reject',
  [
    param('id')
      .trim()
      .notEmpty()
      .withMessage('Organization ID is required')
      .isLength({ max: LENGTH_LIMITS.ID }),
  ],
  stripUnexpectedFields(validationSchemas.admin.rejectOrganization.allowedFields),
  validationSchemas.admin.rejectOrganization.validators,
  validateRequest,
  AdminController.rejectOrganization,
);

/**
 * POST /api/admin/organizations/:id/suspend
 * Suspend an organization
 * 
 * Requires: Suspension reason (for audit trail)
 */
router.post(
  '/organizations/:id/suspend',
  [
    param('id')
      .trim()
      .notEmpty()
      .withMessage('Organization ID is required')
      .isLength({ max: LENGTH_LIMITS.ID }),
  ],
  stripUnexpectedFields(validationSchemas.admin.suspendOrganization.allowedFields),
  validationSchemas.admin.suspendOrganization.validators,
  validateRequest,
  AdminController.suspendOrganization,
);

/**
 * POST /api/admin/organizations/:id/activate
 * Reactivate a suspended organization
 */
router.post(
  '/organizations/:id/activate',
  [
    param('id')
      .trim()
      .notEmpty()
      .withMessage('Organization ID is required')
      .isLength({ max: LENGTH_LIMITS.ID }),
  ],
  validateRequest,
  AdminController.activateOrganization,
);

// =============================================================================
// SYSTEM SETTINGS
// =============================================================================

/**
 * GET /api/admin/settings
 * Get current system settings
 */
router.get('/settings', AdminController.getSettings);

/**
 * PATCH /api/admin/settings
 * Update system settings
 */
router.patch(
  '/settings',
  stripUnexpectedFields(validationSchemas.admin.updateSettings.allowedFields),
  validationSchemas.admin.updateSettings.validators,
  validateRequest,
  AdminController.updateSettings,
);

// =============================================================================
// AUDIT AND MONITORING
// =============================================================================

/**
 * GET /api/admin/audit-logs
 * Get system audit logs
 */
router.get(
  '/audit-logs',
  [
    commonValidators.queryParam.limit(100, 500),
    commonValidators.queryParam.offset(),
    query('cursor')
      .optional()
      .trim()
      .isLength({ max: 512 })
      .withMessage('Cursor must be 512 characters or fewer'),
  ],
  validateRequest,
  AdminController.getAuditLogs,
);

/**
 * GET /api/admin/stats
 * Get platform statistics
 */
router.get('/stats', AdminController.getStats);

/**
 * GET /api/admin/fairness-calibration
 * Get fairness metrics and AI vs SME calibration (FR10)
 */
router.get('/fairness-calibration', AdminController.getFairnessCalibration);

// =============================================================================
// INTEGRATIONS
// =============================================================================

/**
 * POST /api/admin/live-chat/register
 * Register admin for live chat support
 */
router.post('/live-chat/register', AdminController.registerLiveChatAdmin);

// =============================================================================
// USER MANAGEMENT
// =============================================================================

/**
 * GET /api/admin/users
 * List all users with optional filtering
 */
router.get(
  '/users',
  [
    query('accountType')
      .optional()
      .isIn(['CANDIDATE', 'COMPANY', 'SYSTEM_ADMIN'])
      .withMessage('Invalid account type'),
    commonValidators.queryParam.limit(100, 500),
  ],
  validateRequest,
  AdminController.listUsers,
);

export default router;
