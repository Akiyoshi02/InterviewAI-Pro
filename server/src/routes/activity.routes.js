import express from 'express';
import { ActivityController } from '../controllers/activity.controller.js';
import {
  authenticate,
  requireOrganizationContext,
  requireOrgRole,
} from '../middleware/auth.middleware.js';

const router = express.Router();

router.get(
  '/',
  authenticate,
  requireOrganizationContext,
  requireOrgRole(['ADMIN', 'RECRUITER']),
  ActivityController.listOrganizationActivity,
);

export default router;

