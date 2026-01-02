import express from 'express';
import { body } from 'express-validator';
import { authenticate, requireCandidate, requireCompany, verifyFirebaseAuth } from '../middleware/auth.middleware.js';
import { validateRequest } from '../middleware/validation.middleware.js';
import { AuthController } from '../controllers/auth.controller.js';
import { registrationUpload } from '../middleware/upload.middleware.js';

const registrationUploadHandler = registrationUpload.fields([
  { name: 'profilePhoto', maxCount: 1 },
  { name: 'resumeFile', maxCount: 1 },
  { name: 'companyLogo', maxCount: 1 },
  { name: 'companyProof', maxCount: 1 },
]);

const router = express.Router();

// Register user (sync with Firebase Auth)
// User must sign up with Firebase Auth first, then sync with our database
// NOTE: We only use verifyFirebaseAuth (not authenticate) because the user doesn't exist in our DB yet
router.post(
  '/register',
  verifyFirebaseAuth, // Only verify token - user doesn't exist in DB yet, so don't use loadUser
  registrationUploadHandler,
  [
    body('accountType')
      .customSanitizer((value) => value?.toString()?.toUpperCase?.() || value)
      .isIn(['CANDIDATE', 'COMPANY'])
      .withMessage('Invalid account type'),
    body('fullName').optional().isString(),
    body('experienceLevel').optional().isString(),
    body('gender').optional().isString(),
    body('targetRole').optional().isString(),
    body('careerGoals').optional().isString(),
    body('location').optional().isString(),
    body('preferredLanguage').optional().isString(),
    body('companyName').optional().isString(),
    body('industry').optional().isString(),
    body('companySize').optional().isString(),
    body('jobTitle').optional().isString(),
    body('department').optional().isString(),
    body('hiringVolume').optional().isString(),
    body('companyWebsite').optional().isString(),
    body('companyLocation').optional().isString(),
    body('phoneNumber').optional().isString(),
  ],
  validateRequest,
  AuthController.register
);

// Check email availability before registration
router.post(
  '/check-email',
  [
    body('email').trim().isEmail().withMessage('Valid email is required'),
  ],
  validateRequest,
  AuthController.checkEmailAvailability
);

// Get current user
router.get('/me', authenticate, AuthController.getMe);

// Update current user profile
router.patch(
  '/me',
  authenticate,
  // Basic validation could be added here as needed
  AuthController.updateMe
);

router.patch(
  '/me/profile-photo',
  authenticate,
  requireCandidate,
  registrationUpload.single('profilePhoto'),
  AuthController.updateProfilePhoto
);

router.patch(
  '/me/company-logo',
  authenticate,
  requireCompany,
  registrationUpload.single('companyLogo'),
  AuthController.updateCompanyLogo
);

router.patch(
  '/me/resume',
  authenticate,
  requireCandidate,
  registrationUpload.single('resumeFile'),
  AuthController.updateResume
);

// Delete unregistered auth user
// This endpoint requires Firebase auth; the caller must be the same Firebase user being deleted
router.post(
  '/delete-unregistered-auth-user',
  verifyFirebaseAuth,
  [
    body('userId').notEmpty().withMessage('userId is required'),
  ],
  validateRequest,
  AuthController.deleteUnregisteredAuthUser
);

export default router;
