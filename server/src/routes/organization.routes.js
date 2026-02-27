import express from 'express';
import { OrganizationController } from '../controllers/organization.controller.js';
import {
  authenticate,
  requireOrganizationContext,
  requireOrgRole,
} from '../middleware/auth.middleware.js';
import { requireApprovedOrganization, allowPendingOrganization } from '../middleware/admin.middleware.js';
import { validateRequest } from '../middleware/validation.middleware.js';
import { body } from 'express-validator';

const router = express.Router();

// Allow pending organizations to view their settings
router.get(
  '/me',
  authenticate,
  allowPendingOrganization,
  requireOrganizationContext,
  OrganizationController.getMyOrganization,
);

// Only approved organizations can update settings
router.patch(
  '/me',
  authenticate,
  requireApprovedOrganization,
  requireOrgRole(['ADMIN']),
  [
    body('name').optional().isString().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
    body('displayName').optional().isString().isLength({ min: 2 }).withMessage('Display name must be at least 2 characters'),
    body('tagline').optional({ values: 'falsy' }).isString().isLength({ max: 200 }),
    body('industry').optional().isString(),
    body('companyType').optional().isString(),
    body('companySize').optional().isString(),
    body('website').optional({ values: 'falsy' }).isURL().withMessage('Website must be a valid URL'),
    body('location').optional({ values: 'falsy' }).isString().isLength({ max: 200 }),
    body('headquartersLocation').optional({ values: 'falsy' }).isString().isLength({ max: 200 }),
    body('contactEmail').optional({ values: 'falsy' }).isEmail().withMessage('Contact email must be valid'),
    body('contactPhone').optional({ values: 'falsy' }).isString().isLength({ max: 30 }),
    body('careersPageUrl').optional({ values: 'falsy' }).isURL().withMessage('Careers URL must be valid'),
    body('linkedinUrl').optional({ values: 'falsy' }).isURL().withMessage('LinkedIn URL must be valid'),
    body('address').optional({ values: 'falsy' }).isString().isLength({ max: 300 }),
    body('description').optional({ values: 'falsy' }).isString().isLength({ max: 3000 }),
    body('branding').optional().isObject(),
    body('settings').optional().isObject(),
  ],
  validateRequest,
  OrganizationController.updateMyOrganization,
);

// Allow pending to view members (but not manage until approved)
router.get(
  '/me/members',
  authenticate,
  allowPendingOrganization,
  requireOrgRole(['ADMIN']),
  OrganizationController.listMembers,
);

// Only approved organizations can manage members
router.post(
  '/me/members',
  authenticate,
  requireApprovedOrganization,
  requireOrgRole(['ADMIN']),
  [
    body('userId').isString().withMessage('userId is required'),
    body('role').optional().isIn(['ADMIN', 'RECRUITER', 'REVIEWER']),
    body('status').optional().isIn(['ACTIVE', 'INACTIVE']),
    body('permissions').optional().isArray(),
  ],
  validateRequest,
  OrganizationController.upsertMember,
);

export default router;

