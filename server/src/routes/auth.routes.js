/**
 * Authentication Routes
 * 
 * Implements secure authentication endpoints with:
 * - Schema-based validation
 * - Input sanitization
 * - Field whitelisting
 * - Rate limiting (applied in security middleware)
 * 
 * @see OWASP Authentication Cheat Sheet
 */

import express from 'express';
import { authenticate, requireCandidate, requireCompany, verifyFirebaseAuth } from '../middleware/auth.middleware.js';
import { checkMaintenanceMode } from '../middleware/maintenance.middleware.js';
import { 
  validateRequest, 
  stripUnexpectedFields,
  validationSchemas,
} from '../middleware/inputValidation.middleware.js';
import { AuthController } from '../controllers/auth.controller.js';
import { registrationUpload } from '../middleware/upload.middleware.js';

const router = express.Router();

// File upload handler for registration
const registrationUploadHandler = registrationUpload.fields([
  { name: 'profilePhoto', maxCount: 1 },
  { name: 'resumeFile', maxCount: 1 },
  { name: 'companyLogo', maxCount: 1 },
  { name: 'companyProof', maxCount: 1 },
]);

// =============================================================================
// REGISTRATION ENDPOINTS
// =============================================================================

/**
 * POST /api/auth/register
 * Register a new user (sync with Firebase Auth)
 * User must sign up with Firebase Auth first, then sync with our database
 * 
 * Rate limited: 5 registrations per hour per IP
 * Validates: All registration fields with type checking and length limits
 */
router.post(
  '/register',
  verifyFirebaseAuth, // Only verify token - user doesn't exist in DB yet
  registrationUploadHandler,
  stripUnexpectedFields(validationSchemas.auth.register.allowedFields),
  validationSchemas.auth.register.validators,
  validateRequest,
  AuthController.register
);

/**
 * POST /api/auth/check-email
 * Check email availability before registration
 * 
 * Rate limited: 10 checks per minute per IP
 * Prevents email enumeration through rate limiting
 */
router.post(
  '/check-email',
  stripUnexpectedFields(validationSchemas.auth.checkEmail.allowedFields),
  validationSchemas.auth.checkEmail.validators,
  validateRequest,
  AuthController.checkEmailAvailability
);

// =============================================================================
// EMAIL VERIFICATION ENDPOINTS
// =============================================================================

/**
 * POST /api/auth/email-verification/start
 * Start email verification process (send verification code)
 * 
 * Rate limited: 5 verification emails per hour
 * Controller has additional rate limiting to prevent abuse
 */
router.post(
  '/email-verification/start',
  verifyFirebaseAuth,
  stripUnexpectedFields(validationSchemas.auth.emailVerificationStart.allowedFields),
  validationSchemas.auth.emailVerificationStart.validators,
  validateRequest,
  AuthController.startEmailVerification
);

/**
 * POST /api/auth/email-verification/verify-code
 * Verify email using 8-digit code
 * 
 * Validates: Code must be exactly 8 digits
 * Controller has additional attempt limiting
 */
router.post(
  '/email-verification/verify-code',
  verifyFirebaseAuth,
  stripUnexpectedFields(validationSchemas.auth.verifyEmailCode.allowedFields),
  validationSchemas.auth.verifyEmailCode.validators,
  validateRequest,
  AuthController.verifyEmailCode
);

// =============================================================================
// USER PROFILE ENDPOINTS
// =============================================================================

/**
 * GET /api/auth/me
 * Get current authenticated user profile
 */
router.get('/me', authenticate, AuthController.getMe);

/**
 * POST /api/auth/me/organization/request-rereview
 * Request a new manual review for a rejected organization (owner only)
 */
router.post(
  '/me/organization/request-rereview',
  authenticate,
  requireCompany,
  stripUnexpectedFields(validationSchemas.auth.requestOrganizationReReview.allowedFields),
  validationSchemas.auth.requestOrganizationReReview.validators,
  validateRequest,
  AuthController.requestOrganizationReReview
);

/**
 * PATCH /api/auth/me
 * Update current user profile
 * 
 * Note: Field validation is handled in controller for flexible partial updates
 */
router.patch(
  '/me',
  authenticate,
  AuthController.updateMe
);

/**
 * PATCH /api/auth/me/profile-photo
 * Update candidate profile photo
 * 
 * Rate limited: Through upload limiter (20 uploads per 15 minutes)
 * Validates: Image moderation in controller
 */
router.patch(
  '/me/profile-photo',
  authenticate,
  requireCandidate,
  registrationUpload.single('profilePhoto'),
  AuthController.updateProfilePhoto
);

/**
 * PATCH /api/auth/me/company-logo
 * Update company logo
 * 
 * Rate limited: Through upload limiter
 * Validates: Image moderation in controller
 */
router.patch(
  '/me/company-logo',
  authenticate,
  requireCompany,
  registrationUpload.single('companyLogo'),
  AuthController.updateCompanyLogo
);

/**
 * PATCH /api/auth/me/company-cover
 * Update company cover image
 *
 * Rate limited: Through upload limiter
 * Validates: Image moderation in controller
 */
router.patch(
  '/me/company-cover',
  authenticate,
  requireCompany,
  registrationUpload.single('companyCover'),
  AuthController.updateCompanyCover
);

/**
 * PATCH /api/auth/me/company-proof
 * Update company verification document
 *
 * Rate limited: Through upload limiter
 * Validates: Business document verification in controller
 */
router.patch(
  '/me/company-proof',
  authenticate,
  requireCompany,
  registrationUpload.single('companyProof'),
  AuthController.updateCompanyVerificationDocument
);

/**
 * PATCH /api/auth/me/resume
 * Update candidate resume
 * 
 * Rate limited: Through upload limiter
 * Validates: Document moderation in controller
 */
router.patch(
  '/me/resume',
  authenticate,
  requireCandidate,
  registrationUpload.single('resumeFile'),
  AuthController.updateResume
);

/**
 * POST /api/auth/me/parse-resume
 * Parse uploaded or existing resume and extract profile data
 * Returns structured profile fields extracted by the LLM
 */
router.post(
  '/me/parse-resume',
  verifyFirebaseAuth,
  checkMaintenanceMode,
  registrationUpload.single('resumeFile'),
  AuthController.parseResume
);

// =============================================================================
// CLEANUP ENDPOINTS
// =============================================================================

/**
 * POST /api/auth/delete-unregistered-auth-user
 * Delete Firebase Auth user that never completed registration
 * 
 * Security: Caller must be the same Firebase user being deleted
 * This is a cleanup operation for abandoned registrations
 */
router.post(
  '/delete-unregistered-auth-user',
  verifyFirebaseAuth,
  stripUnexpectedFields(validationSchemas.auth.deleteUnregisteredUser.allowedFields),
  validationSchemas.auth.deleteUnregisteredUser.validators,
  validateRequest,
  AuthController.deleteUnregisteredAuthUser
);

export default router;
