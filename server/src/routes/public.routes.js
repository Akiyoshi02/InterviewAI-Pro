import express from 'express';
import { JobController } from '../controllers/job.controller.js';
import { InvitationController } from '../controllers/invitation.controller.js';
import { TeamInvitationController } from '../controllers/teamInvitation.controller.js';
import { AdminController } from '../controllers/admin.controller.js';
import { ContactController } from '../controllers/contact.controller.js';
import { body, param } from 'express-validator';
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

router.post(
  '/contact',
  [
    body('name')
      .trim()
      .notEmpty()
      .withMessage('Name is required')
      .isLength({ max: 100 })
      .withMessage('Name must be 100 characters or less'),
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email is required'),
    body('subject')
      .trim()
      .notEmpty()
      .withMessage('Subject is required')
      .isLength({ max: 150 })
      .withMessage('Subject must be 150 characters or less'),
    body('message')
      .trim()
      .notEmpty()
      .withMessage('Message is required')
      .isLength({ max: 5000 })
      .withMessage('Message must be 5000 characters or less'),
    validateRequest,
  ],
  ContactController.submit,
);

export default router;

