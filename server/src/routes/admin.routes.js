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
import { timingSafeEqual } from 'crypto';
import { body, param, query } from 'express-validator';
import { authenticate, optionalAuth } from '../middleware/auth.middleware.js';
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
import { FineTuningController } from '../controllers/fineTuning.controller.js';
import { QuestionCatalogController } from '../controllers/questionCatalog.controller.js';

const router = express.Router();

const secureCompare = (left, right) => {
  const leftBuffer = Buffer.from(String(left || ''));
  const rightBuffer = Buffer.from(String(right || ''));
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
};

const requireAdminSetupToken = (req, res, next) => {
  const expectedToken = process.env.ADMIN_SETUP_TOKEN;
  if (!expectedToken) {
    return res.status(503).json({
      success: false,
      error: 'Admin bootstrap is not configured on this environment.',
      code: 'ADMIN_SETUP_DISABLED',
    });
  }

  const providedToken = req.headers['x-admin-setup-token'];
  if (!providedToken || !secureCompare(providedToken, expectedToken)) {
    return res.status(403).json({
      success: false,
      error: 'Invalid setup token.',
      code: 'INVALID_SETUP_TOKEN',
    });
  }

  return next();
};

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
  optionalAuth,
  requireAdminSetupToken,
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
  optionalAuth,
  requireAdminSetupToken,
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

/**
 * GET /api/admin/structured-interviews/governance
 * Structured interview library/template usage and defaults
 */
router.get(
  '/structured-interviews/governance',
  [commonValidators.queryParam.limit(200, 2000)],
  validateRequest,
  AdminController.getStructuredInterviewGovernance,
);

/**
 * POST /api/admin/structured-interviews/preview
 * Preview generated structured interview question plan from config
 */
router.post(
  '/structured-interviews/preview',
  [
    body('mode').optional().isIn(ALLOWED_VALUES.INTERVIEW_MODE),
    body('jobRole').optional().isString().isLength({ max: LENGTH_LIMITS.SHORT_TEXT }),
    body('experienceLevel').optional().isString().isLength({ max: LENGTH_LIMITS.SHORT_TEXT }),
    body('industry').optional().isString().isLength({ max: LENGTH_LIMITS.SHORT_TEXT }),
    body('interviewTypes').optional().isArray({ max: 10 }),
    body('interviewTypes.*').optional().isString().isLength({ max: LENGTH_LIMITS.SHORT_TEXT }),
    body('skillFocus').optional().isArray({ max: 20 }),
    body('skillFocus.*').optional().isString().isLength({ max: LENGTH_LIMITS.SHORT_TEXT }),
    body('totalQuestions').optional().isInt({ min: 1, max: 50 }),
    body('difficulty').optional().isString().isLength({ max: LENGTH_LIMITS.SHORT_TEXT }),
    body('questionStrategy').optional().isObject(),
    body('config').optional().isObject(),
  ],
  validateRequest,
  AdminController.previewStructuredInterviewPlan,
);

// =============================================================================
// QUESTION CATALOG (DATASET-FIRST PRACTICE INTERVIEWS)
// =============================================================================

/**
 * GET /api/admin/question-catalog/sources
 * List vetted dataset sources and license allowlist metadata.
 */
router.get(
  '/question-catalog/sources',
  [
    query('includeDisabled').optional().isBoolean().withMessage('includeDisabled must be boolean'),
  ],
  validateRequest,
  QuestionCatalogController.getSources,
);

/**
 * POST /api/admin/question-catalog/import
 * Trigger dataset import from a vetted source.
 */
router.post(
  '/question-catalog/import',
  stripUnexpectedFields(validationSchemas.admin.questionCatalogImport.allowedFields),
  validationSchemas.admin.questionCatalogImport.validators,
  validateRequest,
  QuestionCatalogController.importSource,
);

/**
 * GET /api/admin/question-catalog/imports
 * List recent import batches.
 */
router.get(
  '/question-catalog/imports',
  [
    commonValidators.queryParam.limit(50, 500),
  ],
  validateRequest,
  QuestionCatalogController.getImports,
);

/**
 * GET /api/admin/question-catalog/questions
 * List catalog questions with optional filters.
 */
router.get(
  '/question-catalog/questions',
  [
    commonValidators.queryParam.limit(200, 1000),
    query('reviewStatus').optional().isIn(['PENDING', 'APPROVED', 'REJECTED']),
    query('source').optional().isIn(['INTERNAL', 'EXTERNAL']),
    query('type').optional().isIn(['BEHAVIORAL', 'TECHNICAL', 'CODING', 'SYSTEM_DESIGN', 'CASE_STUDY']),
  ],
  validateRequest,
  QuestionCatalogController.getQuestions,
);

/**
 * PATCH /api/admin/question-catalog/questions/:id/review
 * Approve/reject one or more catalog questions.
 */
router.patch(
  '/question-catalog/questions/:id/review',
  [
    param('id').trim().notEmpty().isLength({ max: LENGTH_LIMITS.ID }),
  ],
  stripUnexpectedFields(validationSchemas.admin.questionCatalogReview.allowedFields),
  validationSchemas.admin.questionCatalogReview.validators,
  validateRequest,
  QuestionCatalogController.updateQuestionReview,
);

/**
 * POST /api/admin/question-catalog/cache/refresh
 * Force refresh in-memory question catalog cache.
 */
router.post(
  '/question-catalog/cache/refresh',
  QuestionCatalogController.refreshCache,
);

/**
 * GET /api/admin/classification-metrics
 * Get confusion matrix and classification metrics (AI vs SME)
 */
router.get('/classification-metrics', AdminController.getClassificationMetrics);

/**
 * GET /api/admin/mediapipe-calibration
 * Get MediaPipe threshold calibration data (static vs data-driven)
 */
router.get('/mediapipe-calibration', AdminController.getMediaPipeCalibration);

// =============================================================================
// MODEL FINE-TUNING
// =============================================================================

/**
 * POST /api/admin/fine-tune
 * Trigger model fine-tuning from collected data
 */
router.post('/fine-tune', FineTuningController.triggerFineTune);

/**
 * GET /api/admin/fine-tune/status
 * Get fine-tuning status and model info
 */
router.get('/fine-tune/status', FineTuningController.getStatus);

/**
 * POST /api/admin/fine-tune/evaluate
 * Run before/after model evaluation
 */
router.post('/fine-tune/evaluate', FineTuningController.evaluate);

/**
 * GET /api/admin/fine-tune/export
 * Export training data as JSONL for downstream LoRA fine-tuning.
 */
router.get('/fine-tune/export', FineTuningController.exportTrainingData);

/**
 * POST /api/admin/fine-tune/import-gguf
 * Register a LoRA-trained GGUF file with Ollama as the fine-tuned model
 */
router.post('/fine-tune/import-gguf', FineTuningController.importGGUF);

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
    query('status')
      .optional()
      .isIn(['ACTIVE', 'SUSPENDED'])
      .withMessage('Invalid status'),
    query('q')
      .optional()
      .trim()
      .isLength({ max: 200 })
      .withMessage('Search query must be 200 characters or fewer'),
    commonValidators.queryParam.limit(100, 500),
    commonValidators.queryParam.offset(),
  ],
  validateRequest,
  AdminController.listUsers,
);

router.patch(
  '/users/:id/status',
  [
    param('id')
      .trim()
      .notEmpty()
      .withMessage('User ID is required')
      .isLength({ max: LENGTH_LIMITS.ID }),
  ],
  stripUnexpectedFields(validationSchemas.admin.updateUserStatus.allowedFields),
  validationSchemas.admin.updateUserStatus.validators,
  validateRequest,
  AdminController.updateUserStatus,
);

router.post(
  '/users/:id/promote-system-admin',
  [
    param('id')
      .trim()
      .notEmpty()
      .withMessage('User ID is required')
      .isLength({ max: LENGTH_LIMITS.ID }),
  ],
  validateRequest,
  AdminController.promoteToSystemAdmin,
);

router.get('/billing-overview', AdminController.getBillingOverview);
router.get('/newsletter-stats', AdminController.getNewsletterStats);
router.get('/data-retention/summary', AdminController.getDataRetentionSummary);
router.post(
  '/data-retention/run',
  stripUnexpectedFields(validationSchemas.admin.runDataRetentionCleanup.allowedFields),
  validationSchemas.admin.runDataRetentionCleanup.validators,
  validateRequest,
  AdminController.runDataRetentionCleanup,
);

export default router;
