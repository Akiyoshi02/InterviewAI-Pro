/**
 * Upload Routes
 * 
 * File upload and moderation endpoints with:
 * - Rate limiting (20 uploads per 15 minutes)
 * - File size validation in upload middleware
 * - Content moderation for images and documents
 * 
 * Security considerations:
 * - File size limits enforced
 * - Content type validation
 * - Image moderation for inappropriate content
 * - Document validation for authenticity
 */

import express from 'express';
import { registrationUpload } from '../middleware/upload.middleware.js';
import {
  moderateCompanyLogo,
  moderateCompanyProof,
  moderateProfilePhoto,
  moderateResumeDocument,
} from '../controllers/upload.controller.js';

const router = express.Router();

// =============================================================================
// IMAGE MODERATION ENDPOINTS
// =============================================================================

/**
 * POST /api/uploads/moderate/profile-photo
 * Moderate a candidate profile photo
 * 
 * Rate limited: 20 uploads per 15 minutes
 * Validates: Image content, single face requirement
 * Max size: 5MB
 */
router.post(
  '/moderate/profile-photo',
  registrationUpload.single('file'),
  moderateProfilePhoto
);

/**
 * POST /api/uploads/moderate/company-logo
 * Moderate a company logo
 * 
 * Rate limited: 20 uploads per 15 minutes
 * Validates: Image content, no faces allowed
 * Max size: 5MB
 */
router.post(
  '/moderate/company-logo',
  registrationUpload.single('file'),
  moderateCompanyLogo
);

// =============================================================================
// DOCUMENT MODERATION ENDPOINTS
// =============================================================================

/**
 * POST /api/uploads/moderate/resume
 * Moderate a candidate resume/CV
 * 
 * Rate limited: 20 uploads per 15 minutes
 * Validates: Document format, content authenticity
 * Max size: 10MB
 */
router.post(
  '/moderate/resume',
  registrationUpload.single('resumeFile'),
  moderateResumeDocument
);

/**
 * POST /api/uploads/moderate/company-proof
 * Moderate a company verification document
 * 
 * Rate limited: 20 uploads per 15 minutes
 * Validates: Document format, business document authenticity
 * Max size: 15MB
 */
router.post(
  '/moderate/company-proof',
  registrationUpload.single('companyProof'),
  moderateCompanyProof
);

export default router;

