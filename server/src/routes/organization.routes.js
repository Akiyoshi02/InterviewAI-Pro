import express from 'express';
import { OrganizationController } from '../controllers/organization.controller.js';
import {
  authenticate,
  requireOrganizationContext,
  requireOrgRole,
} from '../middleware/auth.middleware.js';
import { validateRequest } from '../middleware/validation.middleware.js';
import { body } from 'express-validator';

const router = express.Router();

router.get(
  '/me',
  authenticate,
  requireOrganizationContext,
  OrganizationController.getMyOrganization,
);

router.patch(
  '/me',
  authenticate,
  requireOrgRole(['ADMIN']),
  [
    body('name').optional().isString().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
    body('displayName').optional().isString().isLength({ min: 2 }).withMessage('Display name must be at least 2 characters'),
    body('industry').optional().isString(),
    body('companySize').optional().isString(),
    body('branding').optional().isObject(),
    body('settings').optional().isObject(),
  ],
  validateRequest,
  OrganizationController.updateMyOrganization,
);

router.get(
  '/me/members',
  authenticate,
  requireOrgRole(['ADMIN', 'RECRUITER']),
  OrganizationController.listMembers,
);

router.post(
  '/me/members',
  authenticate,
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

