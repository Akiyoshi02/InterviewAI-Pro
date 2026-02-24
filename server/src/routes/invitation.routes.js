import express from 'express';
import { body } from 'express-validator';
import { InvitationController } from '../controllers/invitation.controller.js';
import {
  authenticate,
  requireCandidate,
  requireOrganizationContext,
  requireOrgRole,
} from '../middleware/auth.middleware.js';
import { requireApprovedOrganization, allowPendingOrganization } from '../middleware/admin.middleware.js';
import { requireFeatureFlag } from '../middleware/featureFlags.middleware.js';
import { validateRequest } from '../middleware/validation.middleware.js';

const router = express.Router();

router.post(
  '/',
  authenticate,
  requireFeatureFlag('enableInvitations'),
  requireApprovedOrganization,
  requireOrgRole(['ADMIN', 'RECRUITER']),
  [
    body('jobId').isString().withMessage('Job ID is required'),
    body('email').isEmail().withMessage('Valid candidate email required'),
    body('stage').optional().isString(),
    body('expiresAt').optional().isISO8601(),
  ],
  validateRequest,
  InvitationController.createInvitation,
);

router.get(
  '/',
  authenticate,
  requireFeatureFlag('enableInvitations'),
  allowPendingOrganization,
  requireOrganizationContext,
  requireOrgRole(['ADMIN', 'RECRUITER']),
  InvitationController.listInvitations,
);

router.post(
  '/accept',
  authenticate,
  requireFeatureFlag('enableInvitations'),
  requireCandidate,
  [body('token').isString().withMessage('Invitation token is required')],
  validateRequest,
  InvitationController.acceptInvitation,
);

router.patch(
  '/:id/revoke',
  authenticate,
  requireFeatureFlag('enableInvitations'),
  requireApprovedOrganization,
  requireOrgRole(['ADMIN', 'RECRUITER']),
  InvitationController.revokeInvitation,
);

export default router;

