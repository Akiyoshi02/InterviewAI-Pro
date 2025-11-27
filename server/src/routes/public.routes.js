import express from 'express';
import { JobController } from '../controllers/job.controller.js';
import { InvitationController } from '../controllers/invitation.controller.js';
import { param } from 'express-validator';
import { validateRequest } from '../middleware/validation.middleware.js';

const router = express.Router();

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

export default router;

