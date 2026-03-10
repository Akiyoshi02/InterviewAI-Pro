import express from 'express';
import { body, param } from 'express-validator';
import { JobController } from '../controllers/job.controller.js';
import {
  authenticate,
  requireOrganizationContext,
  requireOrgRole,
} from '../middleware/auth.middleware.js';
import { requireApprovedOrganization, allowPendingOrganization } from '../middleware/admin.middleware.js';
import { requireFeatureFlag } from '../middleware/featureFlags.middleware.js';
import { validateRequest } from '../middleware/validation.middleware.js';
import { jobAdvertUpload } from '../middleware/upload.middleware.js';

const router = express.Router();

const jobValidations = [
  body('title').isString().isLength({ min: 3 }).withMessage('Title is required'),
  body('department').optional().isString(),
  body('location').optional().isString(),
  body('employmentType').optional().isString(),
  body('experienceLevel').optional().isString(),
  body('compensationRange').optional().isString(),
  body('salaryCurrency').optional().isString(),
  body('salaryMin').optional().isNumeric(),
  body('salaryMax').optional().isNumeric(),
  body('benefits').optional().isString(),
  body('description').optional().isString(),
  body('requirements').optional().isArray(),
  body('responsibilities').optional().isArray(),
  body('skills').optional().isArray(),
  body('advertImageUrls').optional({ nullable: true }).isArray(),
  body('advertImageUrls.*').optional().isString(),
  body('advertImageUrl').optional({ nullable: true }).isString(),
  body('advertImageAlt').optional({ nullable: true }).isString().isLength({ max: 160 }),
  body('advertVideoUrl').optional({ nullable: true }).isString(),
  body('status').optional().isIn(['DRAFT', 'PUBLISHED', 'ARCHIVED']),
  body('applicationQuestions').optional().isArray(),
  body('customFormFields').optional().isArray(),
  body('templateConfig').optional().isObject(),
  body('templateConfig.duration').optional().isInt({ min: 15, max: 180 }),
  body('templateConfig.interviewTypes').optional().isArray({ min: 1, max: 10 }),
  body('templateConfig.interviewTypes.*').optional().isString().isLength({ max: 50 }),
  body('templateConfig.skillFocus').optional().isArray({ max: 20 }),
  body('templateConfig.skillFocus.*').optional().isString().isLength({ max: 100 }),
  body('templateConfig.interviewPlan').optional().isObject(),
  body('templateConfig.interviewPlan.stages').optional().isArray({ min: 1, max: 10 }),
  body('templateConfig.interviewPlan.stages.*.id').optional().isString().isLength({ max: 80 }),
  body('templateConfig.interviewPlan.stages.*.name').optional().isString().isLength({ min: 2, max: 80 }),
  body('templateConfig.interviewPlan.stages.*.category').optional().isIn(['SCREENING', 'TECHNICAL', 'PANEL', 'FINAL']),
  body('templateConfig.interviewPlan.stages.*.required').optional().isBoolean(),
  body('templateConfig.interviewPlan.stages.*.advanceRule').optional().isIn(['PASS_REQUIRED', 'COMPLETE_TO_CONTINUE']),
  body('templateConfig.interviewPlan.stages.*.autoAdvanceOnPass').optional().isBoolean(),
  body('templateConfig.interviewPlan.stages.*.autoAdvanceOnComplete').optional().isBoolean(),
  body('templateConfig.interviewPlan.stages.*.failDispositionCode').optional({ nullable: true }).isIn(['NOT_SELECTED', 'SKILL_MISMATCH', 'EXPERIENCE_MISMATCH', 'OTHER']),
  body('templateConfig.interviewPlan.stages.*.templateId').optional({ nullable: true }).isString().isLength({ max: 200 }),
  body('templateConfig.interviewPlan.stages.*.durationMinutes').optional().isInt({ min: 15, max: 180 }),
  body('templateConfig.interviewPlan.stages.*.interviewTypes').optional().isArray({ min: 1, max: 10 }),
  body('templateConfig.interviewPlan.stages.*.interviewTypes.*').optional().isString().isLength({ max: 50 }),
  body('templateConfig.interviewPlan.stages.*.skillFocus').optional().isArray({ max: 20 }),
  body('templateConfig.interviewPlan.stages.*.skillFocus.*').optional().isString().isLength({ max: 100 }),
  body('acceptingApplications').optional().isBoolean(),
  body('postingDuration').optional().isInt({ min: 1, max: 365 }).withMessage('Posting duration must be between 1 and 365 days'),
  body('scheduledPublishAt').optional({ nullable: true }).isISO8601().withMessage('Scheduled publish date must be a valid ISO 8601 date'),
];

// Validation for updates - title is optional since we may only update specific fields
const jobUpdateValidations = [
  body('title').optional().isString().isLength({ min: 3 }).withMessage('Title must be at least 3 characters'),
  body('department').optional().isString(),
  body('location').optional().isString(),
  body('employmentType').optional().isString(),
  body('experienceLevel').optional().isString(),
  body('compensationRange').optional().isString(),
  body('salaryCurrency').optional().isString(),
  body('salaryMin').optional().isNumeric(),
  body('salaryMax').optional().isNumeric(),
  body('benefits').optional().isString(),
  body('description').optional().isString(),
  body('requirements').optional().isArray(),
  body('responsibilities').optional().isArray(),
  body('skills').optional().isArray(),
  body('advertImageUrls').optional({ nullable: true }).isArray(),
  body('advertImageUrls.*').optional().isString(),
  body('advertImageUrl').optional({ nullable: true }).isString(),
  body('advertImageAlt').optional({ nullable: true }).isString().isLength({ max: 160 }),
  body('advertVideoUrl').optional({ nullable: true }).isString(),
  body('status').optional().isIn(['DRAFT', 'PUBLISHED', 'ARCHIVED']),
  body('applicationQuestions').optional().isArray(),
  body('customFormFields').optional().isArray(),
  body('templateConfig').optional().isObject(),
  body('templateConfig.duration').optional().isInt({ min: 15, max: 180 }),
  body('templateConfig.interviewTypes').optional().isArray({ min: 1, max: 10 }),
  body('templateConfig.interviewTypes.*').optional().isString().isLength({ max: 50 }),
  body('templateConfig.skillFocus').optional().isArray({ max: 20 }),
  body('templateConfig.skillFocus.*').optional().isString().isLength({ max: 100 }),
  body('templateConfig.interviewPlan').optional().isObject(),
  body('templateConfig.interviewPlan.stages').optional().isArray({ min: 1, max: 10 }),
  body('templateConfig.interviewPlan.stages.*.id').optional().isString().isLength({ max: 80 }),
  body('templateConfig.interviewPlan.stages.*.name').optional().isString().isLength({ min: 2, max: 80 }),
  body('templateConfig.interviewPlan.stages.*.category').optional().isIn(['SCREENING', 'TECHNICAL', 'PANEL', 'FINAL']),
  body('templateConfig.interviewPlan.stages.*.required').optional().isBoolean(),
  body('templateConfig.interviewPlan.stages.*.advanceRule').optional().isIn(['PASS_REQUIRED', 'COMPLETE_TO_CONTINUE']),
  body('templateConfig.interviewPlan.stages.*.autoAdvanceOnPass').optional().isBoolean(),
  body('templateConfig.interviewPlan.stages.*.autoAdvanceOnComplete').optional().isBoolean(),
  body('templateConfig.interviewPlan.stages.*.failDispositionCode').optional({ nullable: true }).isIn(['NOT_SELECTED', 'SKILL_MISMATCH', 'EXPERIENCE_MISMATCH', 'OTHER']),
  body('templateConfig.interviewPlan.stages.*.templateId').optional({ nullable: true }).isString().isLength({ max: 200 }),
  body('templateConfig.interviewPlan.stages.*.durationMinutes').optional().isInt({ min: 15, max: 180 }),
  body('templateConfig.interviewPlan.stages.*.interviewTypes').optional().isArray({ min: 1, max: 10 }),
  body('templateConfig.interviewPlan.stages.*.interviewTypes.*').optional().isString().isLength({ max: 50 }),
  body('templateConfig.interviewPlan.stages.*.skillFocus').optional().isArray({ max: 20 }),
  body('templateConfig.interviewPlan.stages.*.skillFocus.*').optional().isString().isLength({ max: 100 }),
  body('acceptingApplications').optional().isBoolean(),
  body('postingDuration').optional().isInt({ min: 1, max: 365 }).withMessage('Posting duration must be between 1 and 365 days'),
  body('scheduledPublishAt').optional({ nullable: true }).isISO8601().withMessage('Scheduled publish date must be a valid ISO 8601 date'),
];

const jobDeleteValidations = [
  param('id').isString(),
  body('resolveActiveApplications').optional().isBoolean(),
  body('notifyCandidates').optional().isBoolean(),
  body('resolutionMessage').optional().isString().isLength({ max: 1000 }),
];

router.post(
  '/',
  authenticate,
  requireFeatureFlag('enableJobPosting'),
  requireApprovedOrganization,
  requireOrgRole(['ADMIN', 'RECRUITER']),
  jobValidations,
  validateRequest,
  JobController.createJob,
);

router.get(
  '/',
  authenticate,
  requireFeatureFlag('enableJobPosting'),
  allowPendingOrganization,
  requireOrganizationContext,
  requireOrgRole(['ADMIN', 'RECRUITER']),
  JobController.listJobs,
);

router.get(
  '/:id',
  authenticate,
  requireFeatureFlag('enableJobPosting'),
  allowPendingOrganization,
  requireOrganizationContext,
  requireOrgRole(['ADMIN', 'RECRUITER']),
  param('id').isString(),
  validateRequest,
  JobController.getJob,
);

router.patch(
  '/:id',
  authenticate,
  requireFeatureFlag('enableJobPosting'),
  requireApprovedOrganization,
  requireOrgRole(['ADMIN', 'RECRUITER']),
  jobUpdateValidations,
  validateRequest,
  JobController.updateJob,
);

router.patch(
  '/:id/advert-image',
  authenticate,
  requireFeatureFlag('enableJobPosting'),
  requireApprovedOrganization,
  requireOrgRole(['ADMIN', 'RECRUITER']),
  param('id').isString(),
  validateRequest,
  jobAdvertUpload.single('jobAdvertImage'),
  JobController.uploadAdvertImage,
);

router.patch(
  '/:id/advert-video',
  authenticate,
  requireFeatureFlag('enableJobPosting'),
  requireApprovedOrganization,
  requireOrgRole(['ADMIN', 'RECRUITER']),
  param('id').isString(),
  validateRequest,
  jobAdvertUpload.single('jobAdvertVideo'),
  JobController.uploadAdvertVideo,
);

router.delete(
  '/:id',
  authenticate,
  requireFeatureFlag('enableJobPosting'),
  requireApprovedOrganization,
  requireOrgRole(['ADMIN', 'RECRUITER']),
  jobDeleteValidations,
  validateRequest,
  JobController.deleteJob,
);

export default router;

