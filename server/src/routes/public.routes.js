import express from 'express';
import { JobController } from '../controllers/job.controller.js';
import { InvitationController } from '../controllers/invitation.controller.js';
import { TeamInvitationController } from '../controllers/teamInvitation.controller.js';
import { AdminController } from '../controllers/admin.controller.js';
import { param } from 'express-validator';
import { validateRequest } from '../middleware/validation.middleware.js';

const router = express.Router();

// Public endpoint to check maintenance mode status
router.get('/maintenance-status', AdminController.getMaintenanceStatus);

router.get('/jobs', JobController.listPublicJobs);

router.get(
  '/jobs/:id',
  param('id').isString(),
  validateRequest,
  JobController.getPublicJob,
);

router.get(
  '/invitations/:token',
  param('token').isString(),
  validateRequest,
  InvitationController.previewInvitation,
);

// Team invitation preview (public)
router.get(
  '/team-invitations/:token',
  param('token').isString(),
  validateRequest,
  TeamInvitationController.getInvitationByToken,
);

export default router;

