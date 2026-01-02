import express from 'express';
import { body, param, query } from 'express-validator';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireSystemAdmin } from '../middleware/admin.middleware.js';
import { validateRequest } from '../middleware/validation.middleware.js';
import { AdminController } from '../controllers/admin.controller.js';

const router = express.Router();

// Bootstrap admin (creates Firebase user + Firestore profile in one go)
// Use this for initial setup when no admin exists
router.post(
  '/auth/bootstrap-admin',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password')
      .isString()
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters'),
    body('fullName').optional().isString(),
  ],
  validateRequest,
  AdminController.bootstrapAdmin,
);

// Seed admin (promotes existing Firebase user to system admin)
// Use this when you already have a user and want to make them an admin
router.post(
  '/auth/seed-admin',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('uid').isString().notEmpty().withMessage('Firebase UID is required'),
    body('fullName').optional().isString(),
  ],
  validateRequest,
  AdminController.seedAdmin,
);

// All routes below require system admin authentication
router.use(authenticate);
router.use(requireSystemAdmin);

// Organizations
router.get(
  '/organizations',
  [
    query('status').optional().isIn(['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED']),
    query('limit').optional().isInt({ min: 1, max: 500 }),
    query('offset').optional().isInt({ min: 0 }),
  ],
  validateRequest,
  AdminController.listOrganizations,
);

router.get(
  '/organizations/pending',
  [query('limit').optional().isInt({ min: 1, max: 100 })],
  validateRequest,
  AdminController.listPendingOrganizations,
);

router.get(
  '/organizations/:id',
  [param('id').isString().notEmpty()],
  validateRequest,
  AdminController.getOrganization,
);

router.post(
  '/organizations/:id/approve',
  [param('id').isString().notEmpty()],
  validateRequest,
  AdminController.approveOrganization,
);

router.post(
  '/organizations/:id/reject',
  [
    param('id').isString().notEmpty(),
    body('reason').isString().notEmpty().withMessage('Rejection reason is required'),
  ],
  validateRequest,
  AdminController.rejectOrganization,
);

router.post(
  '/organizations/:id/suspend',
  [
    param('id').isString().notEmpty(),
    body('reason').isString().notEmpty().withMessage('Suspension reason is required'),
  ],
  validateRequest,
  AdminController.suspendOrganization,
);

router.post(
  '/organizations/:id/activate',
  [param('id').isString().notEmpty()],
  validateRequest,
  AdminController.activateOrganization,
);

// System Settings
router.get('/settings', AdminController.getSettings);

router.patch(
  '/settings',
  [
    body('featureFlags').optional().isObject(),
    body('maintenanceMode').optional().isBoolean(),
    body('defaultAIConfig').optional().isObject(),
    body('dataRetention').optional().isObject(),
  ],
  validateRequest,
  AdminController.updateSettings,
);

// Audit Logs
router.get(
  '/audit-logs',
  [
    query('limit').optional().isInt({ min: 1, max: 500 }),
    query('offset').optional().isInt({ min: 0 }),
  ],
  validateRequest,
  AdminController.getAuditLogs,
);

// Platform Statistics
router.get('/stats', AdminController.getStats);

// User Management
router.get(
  '/users',
  [
    query('accountType').optional().isIn(['CANDIDATE', 'COMPANY', 'SYSTEM_ADMIN']),
    query('limit').optional().isInt({ min: 1, max: 500 }),
  ],
  validateRequest,
  AdminController.listUsers,
);

export default router;

