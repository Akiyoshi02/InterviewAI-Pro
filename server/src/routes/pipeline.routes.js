import express from 'express';
import { body, param } from 'express-validator';
import { PipelineController } from '../controllers/pipeline.controller.js';
import {
  authenticate,
  requireOrganizationContext,
  requireOrgRole,
} from '../middleware/auth.middleware.js';
import { validateRequest } from '../middleware/validation.middleware.js';

const router = express.Router();

router.get(
  '/',
  authenticate,
  requireOrganizationContext,
  requireOrgRole(['ADMIN', 'RECRUITER', 'REVIEWER']),
  PipelineController.getPipeline,
);

router.patch(
  '/:interviewId',
  authenticate,
  requireOrgRole(['ADMIN', 'RECRUITER']),
  [
    param('interviewId').isString(),
    body('jobStage').optional().isString(),
    body('pipelineStatus').optional().isString(),
    body('status').optional().isString(),
  ],
  validateRequest,
  PipelineController.moveCandidate,
);

export default router;

