import express from 'express';
import { body, param } from 'express-validator';
import { TeamInvitationController } from '../controllers/teamInvitation.controller.js';
import {
  authenticate,
  requireOrganizationContext,
  requireOrgRole,
} from '../middleware/auth.middleware.js';
import { requireApprovedOrganization } from '../middleware/admin.middleware.js';
import { validateRequest } from '../middleware/validation.middleware.js';

const router = express.Router();

// Send team invitation (ADMIN only)
router.post(
  '/',
  authenticate,
  requireApprovedOrganization,
  requireOrganizationContext,
  requireOrgRole(['ADMIN']),
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('role').isIn(['ADMIN', 'RECRUITER', 'REVIEWER']).withMessage('Valid role is required'),
  ],
  validateRequest,
  TeamInvitationController.sendInvitation,
);

// List team invitations (ADMIN only)
router.get(
  '/',
  authenticate,
  requireOrganizationContext,
  requireOrgRole(['ADMIN']),
  TeamInvitationController.listInvitations,
);

// Revoke invitation (ADMIN only)
router.delete(
  '/:id',
  authenticate,
  requireApprovedOrganization,
  requireOrganizationContext,
  requireOrgRole(['ADMIN']),
  [param('id').isString().withMessage('Invitation ID is required')],
  validateRequest,
  TeamInvitationController.revokeInvitation,
);

// Resend invitation email (ADMIN only)
router.post(
  '/:id/resend',
  authenticate,
  requireApprovedOrganization,
  requireOrganizationContext,
  requireOrgRole(['ADMIN']),
  [param('id').isString().withMessage('Invitation ID is required')],
  validateRequest,
  TeamInvitationController.resendInvitation,
);

export default router;

