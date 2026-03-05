import express from 'express';
import { body, param } from 'express-validator';
import { TemplateController } from '../controllers/template.controller.js';
import {
  authenticate,
  requireCompany,
  requireOrganizationContext,
  requireOrgRole,
} from '../middleware/auth.middleware.js';
import { requireApprovedOrganization } from '../middleware/admin.middleware.js';
import { requireFeatureFlag } from '../middleware/featureFlags.middleware.js';
import { validateRequest } from '../middleware/validation.middleware.js';

const router = express.Router();

// Create a new template
router.post(
  '/',
  authenticate,
  requireFeatureFlag('enableJobPosting'),
  requireOrganizationContext,
  requireApprovedOrganization,
  requireOrgRole(['ADMIN', 'RECRUITER']),
  [
    body('name').isString().trim().notEmpty().withMessage('Template name is required'),
    body('jobRole').isString().trim().notEmpty().withMessage('Job role is required'),
    body('description').optional().isString(),
    body('experienceLevel').optional().isString(),
    body('industry').optional().isString(),
    body('interviewTypes').optional().isArray(),
    body('duration').optional().isInt({ min: 10, max: 180 }),
    body('skillFocus').optional().isArray(),
    body('questions').optional().isArray(),
    body('config').optional().isObject(),
    body('structuredQuestionSet').optional().isObject(),
    body('isPublic').optional().isBoolean(),
  ],
  validateRequest,
  TemplateController.createTemplate,
);

// Structured template authoring catalog (library + org templates)
router.get(
  '/structured/catalog',
  authenticate,
  requireFeatureFlag('enableJobPosting'),
  requireCompany,
  requireOrganizationContext,
  requireOrgRole(['ADMIN', 'RECRUITER']),
  TemplateController.getStructuredCatalog,
);

// List organization templates
router.get(
  '/',
  authenticate,
  requireFeatureFlag('enableJobPosting'),
  requireCompany,
  requireOrganizationContext,
  requireOrgRole(['ADMIN', 'RECRUITER']),
  TemplateController.listTemplates,
);

// List public templates
router.get(
  '/public',
  authenticate,
  requireFeatureFlag('enableJobPosting'),
  requireCompany,
  requireOrganizationContext,
  requireOrgRole(['ADMIN', 'RECRUITER']),
  TemplateController.listPublicTemplates,
);

// Get a single template
router.get(
  '/:id',
  authenticate,
  requireFeatureFlag('enableJobPosting'),
  requireCompany,
  requireOrganizationContext,
  requireOrgRole(['ADMIN', 'RECRUITER']),
  [param('id').isString().notEmpty()],
  validateRequest,
  TemplateController.getTemplate,
);

// Update a template
router.put(
  '/:id',
  authenticate,
  requireFeatureFlag('enableJobPosting'),
  requireOrganizationContext,
  requireApprovedOrganization,
  requireOrgRole(['ADMIN', 'RECRUITER']),
  [
    param('id').isString().notEmpty(),
    body('name').optional().isString().trim().notEmpty(),
    body('description').optional().isString(),
    body('jobRole').optional().isString().trim().notEmpty(),
    body('experienceLevel').optional().isString(),
    body('industry').optional().isString(),
    body('interviewTypes').optional().isArray(),
    body('duration').optional().isInt({ min: 10, max: 180 }),
    body('skillFocus').optional().isArray(),
    body('questions').optional().isArray(),
    body('config').optional().isObject(),
    body('structuredQuestionSet').optional().isObject(),
    body('isPublic').optional().isBoolean(),
  ],
  validateRequest,
  TemplateController.updateTemplate,
);

// Duplicate a template
router.post(
  '/:id/duplicate',
  authenticate,
  requireFeatureFlag('enableJobPosting'),
  requireOrganizationContext,
  requireApprovedOrganization,
  requireOrgRole(['ADMIN', 'RECRUITER']),
  [param('id').isString().notEmpty()],
  validateRequest,
  TemplateController.duplicateTemplate,
);

// Delete a template
router.delete(
  '/:id',
  authenticate,
  requireFeatureFlag('enableJobPosting'),
  requireOrganizationContext,
  requireApprovedOrganization,
  requireOrgRole(['ADMIN', 'RECRUITER']),
  [param('id').isString().notEmpty()],
  validateRequest,
  TemplateController.deleteTemplate,
);

export default router;

