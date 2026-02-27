import express from 'express';
import { body } from 'express-validator';
import { CompanyProfileController } from '../controllers/companyProfile.controller.js';
import {
  authenticate,
  requireCandidate,
  requireOrganizationContext,
  requireOrgRole,
} from '../middleware/auth.middleware.js';
import { validateRequest } from '../middleware/validation.middleware.js';

const router = express.Router();

// Candidate-only routes
router.get(
  '/',
  authenticate,
  requireCandidate,
  CompanyProfileController.listCompanies,
);

// Authenticated: read/update own company public profile
router.get(
  '/me/profile',
  authenticate,
  requireOrganizationContext,
  requireOrgRole(['ADMIN']),
  CompanyProfileController.getMyProfile,
);

router.put(
  '/me/profile',
  authenticate,
  requireOrganizationContext,
  requireOrgRole(['ADMIN']),
  [
    body('tagline').optional().isString().isLength({ max: 200 }),
    body('about').optional().isString().isLength({ max: 3000 }),
    body('mission').optional().isString().isLength({ max: 1000 }),
    body('culture').optional().isString().isLength({ max: 1000 }),
    body('location').optional().isString().isLength({ max: 200 }),
    body('workModel').optional({ values: 'falsy' }).isIn(['REMOTE', 'HYBRID', 'ONSITE', 'FLEXIBLE']),
    body('hiringProcess').optional().isString().isLength({ max: 1500 }),
    body('hiringTimeline').optional().isString().isLength({ max: 200 }),
    body('responseTime').optional().isString().isLength({ max: 200 }),
    body('website').optional({ values: 'falsy' }).isURL().withMessage('Must be a valid URL'),
    body('benefits').optional().isArray({ max: 50 }),
    body('benefits.*').optional().isString().isLength({ max: 100 }),
    body('techStack').optional().isArray({ max: 50 }),
    body('techStack.*').optional().isString().isLength({ max: 100 }),
    body('socialLinks').optional().isObject(),
    body('socialLinks.linkedin').optional({ values: 'falsy' }).isURL(),
    body('socialLinks.twitter').optional({ values: 'falsy' }).isURL(),
    body('socialLinks.github').optional({ values: 'falsy' }).isURL(),
    body('coverUrl')
      .optional({ values: 'falsy' })
      .custom((value) => {
        const trimmed = String(value || '').trim();
        if (!trimmed) return true;
        if (/^https?:\/\//i.test(trimmed)) return true;
        if (trimmed.startsWith('/uploads/company-covers/')) return true;
        throw new Error('Cover image must be an uploaded cover path or a valid URL.');
      }),
    body('coverColor')
      .optional({ values: 'falsy' })
      .matches(/^#(?:[0-9a-fA-F]{3}){1,2}$/)
      .withMessage('Cover color must be a valid hex color.'),
    body('profilePublic').optional().isBoolean(),
  ],
  validateRequest,
  CompanyProfileController.updateMyProfile,
);

router.get(
  '/:slug',
  authenticate,
  requireCandidate,
  CompanyProfileController.getCompanyProfile,
);

export default router;
