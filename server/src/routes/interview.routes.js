/**
 * Interview Routes
 * 
 * Interview management endpoints with:
 * - Rate limiting on creation (10 per hour)
 * - Authentication required for all endpoints
 * - Comprehensive input validation
 * 
 * Security considerations:
 * - Interview creation is rate limited to prevent resource abuse
 * - All inputs are validated and sanitized
 * - User authorization checked in controllers
 */

import express from 'express';
import { param, body, query } from 'express-validator';
import {
  authenticate,
  requireCandidate,
  requireCompany,
  requireOrgRole,
} from '../middleware/auth.middleware.js';
import { 
  validateRequest, 
  stripUnexpectedFields,
  validationSchemas,
  LENGTH_LIMITS,
} from '../middleware/inputValidation.middleware.js';
import { requireApprovedOrganization } from '../middleware/admin.middleware.js';
import { InterviewController } from '../controllers/interview.controller.js';
import { interviewRecordingUpload } from '../middleware/upload.middleware.js';

const router = express.Router();

// =============================================================================
// INTERVIEW CREATION (Rate limited: 10 per hour)
// =============================================================================

/**
 * POST /api/interviews/create
 * Create a new interview session (Practice or Hiring)
 * 
 * Rate limited: 10 interviews per hour per user
 * Validates: Mode, duration, configuration options
 */
router.post(
  '/create',
  authenticate,
  stripUnexpectedFields(validationSchemas.interview.create.allowedFields),
  validationSchemas.interview.create.validators,
  validateRequest,
  InterviewController.createInterview
);

// =============================================================================
// INTERVIEW RETRIEVAL
// =============================================================================

/**
 * GET /api/interviews/user/my-interviews
 * Get current user's interviews
 * 
 * Note: This route must be defined BEFORE /:id to avoid conflicts
 */
router.get(
  '/user/my-interviews',
  authenticate,
  [query('limit').optional().toInt().isInt({ min: 1, max: 200 })],
  validateRequest,
  InterviewController.getMyInterviews
);

/**
 * GET /api/interviews/company/all
 * Get all interviews for the company (company users only)
 */
router.get(
  '/company/all',
  authenticate,
  requireCompany,
  requireApprovedOrganization,
  requireOrgRole(['ADMIN', 'RECRUITER', 'REVIEWER']),
  [query('limit').optional().toInt().isInt({ min: 1, max: 200 })],
  validateRequest,
  InterviewController.getCompanyInterviews
);

/**
 * GET /api/interviews/:id
 * Get interview by ID
 */
router.get(
  '/:id',
  authenticate,
  [
    param('id')
      .trim()
      .notEmpty()
      .withMessage('Interview ID is required')
      .isLength({ max: LENGTH_LIMITS.ID }),
  ],
  validateRequest,
  InterviewController.getInterview
);

/**
 * GET /api/interviews/:id/evaluation
 * Get interview evaluation/feedback
 */
router.get(
  '/:id/evaluation',
  authenticate,
  [
    param('id')
      .trim()
      .notEmpty()
      .withMessage('Interview ID is required')
      .isLength({ max: LENGTH_LIMITS.ID }),
  ],
  validateRequest,
  InterviewController.getEvaluation
);

// =============================================================================
// INTERVIEW SESSION MANAGEMENT
// =============================================================================

/**
 * PATCH /api/interviews/:id/recording-consent
 * Record explicit consent for recording (audio/video) before starting session.
 * FR2: Consent and user controls for recorded text/audio/video.
 */
router.patch(
  '/:id/recording-consent',
  authenticate,
  [
    param('id')
      .trim()
      .notEmpty()
      .withMessage('Interview ID is required')
      .isLength({ max: LENGTH_LIMITS.ID }),
  ],
  stripUnexpectedFields(validationSchemas.interview.recordingConsent.allowedFields),
  validationSchemas.interview.recordingConsent.validators,
  validateRequest,
  InterviewController.recordRecordingConsent
);

/**
 * POST /api/interviews/:id/schedule
 * Schedule interview timing and meeting link.
 */
router.post(
  '/:id/schedule',
  authenticate,
  [
    param('id')
      .trim()
      .notEmpty()
      .withMessage('Interview ID is required')
      .isLength({ max: LENGTH_LIMITS.ID }),
  ],
  stripUnexpectedFields(validationSchemas.interview.schedule.allowedFields),
  validationSchemas.interview.schedule.validators,
  validateRequest,
  InterviewController.scheduleInterview,
);

/**
 * PATCH /api/interviews/:id/reschedule
 * Reschedule existing interview.
 */
router.patch(
  '/:id/reschedule',
  authenticate,
  [
    param('id')
      .trim()
      .notEmpty()
      .withMessage('Interview ID is required')
      .isLength({ max: LENGTH_LIMITS.ID }),
  ],
  stripUnexpectedFields(validationSchemas.interview.reschedule.allowedFields),
  validationSchemas.interview.reschedule.validators,
  validateRequest,
  InterviewController.rescheduleInterview,
);

/**
 * POST /api/interviews/:id/cancel
 * Cancel an interview schedule.
 */
router.post(
  '/:id/cancel',
  authenticate,
  [
    param('id')
      .trim()
      .notEmpty()
      .withMessage('Interview ID is required')
      .isLength({ max: LENGTH_LIMITS.ID }),
  ],
  stripUnexpectedFields(validationSchemas.interview.cancel.allowedFields),
  validationSchemas.interview.cancel.validators,
  validateRequest,
  InterviewController.cancelInterview,
);

/**
 * POST /api/interviews/:id/recording
 * Upload full-session recording file for an interview.
 */
router.post(
  '/:id/recording',
  authenticate,
  [
    param('id')
      .trim()
      .notEmpty()
      .withMessage('Interview ID is required')
      .isLength({ max: LENGTH_LIMITS.ID }),
  ],
  validateRequest,
  interviewRecordingUpload.single('recording'),
  InterviewController.uploadRecording,
);

/**
 * GET /api/interviews/:id/recording-url
 * Retrieve authorized playback URL for full-session recording.
 */
router.get(
  '/:id/recording-url',
  authenticate,
  [
    param('id')
      .trim()
      .notEmpty()
      .withMessage('Interview ID is required')
      .isLength({ max: LENGTH_LIMITS.ID }),
  ],
  validateRequest,
  InterviewController.getRecordingUrl,
);

/**
 * POST /api/interviews/:id/start
 * Start an interview session
 */
router.post(
  '/:id/start',
  authenticate,
  [
    param('id')
      .trim()
      .notEmpty()
      .withMessage('Interview ID is required')
      .isLength({ max: LENGTH_LIMITS.ID }),
  ],
  validateRequest,
  InterviewController.startInterview
);

/**
 * POST /api/interviews/:id/end
 * End an interview session
 */
router.post(
  '/:id/end',
  authenticate,
  [
    param('id')
      .trim()
      .notEmpty()
      .withMessage('Interview ID is required')
      .isLength({ max: LENGTH_LIMITS.ID }),
  ],
  validateRequest,
  InterviewController.endInterview
);

/**
 * POST /api/interviews/:id/run-evaluation
 * Run interview evaluation now (idempotent).
 */
router.post(
  '/:id/run-evaluation',
  authenticate,
  [
    param('id')
      .trim()
      .notEmpty()
      .withMessage('Interview ID is required')
      .isLength({ max: LENGTH_LIMITS.ID }),
  ],
  validateRequest,
  InterviewController.runEvaluation,
);

// =============================================================================
// QUESTION/ANSWER MANAGEMENT
// =============================================================================

/**
 * POST /api/interviews/:id/question/asked
 * Mark a question as asked
 */
router.post(
  '/:id/question/asked',
  authenticate,
  [
    param('id')
      .trim()
      .notEmpty()
      .withMessage('Interview ID is required')
      .isLength({ max: LENGTH_LIMITS.ID }),
    body('questionId')
      .trim()
      .notEmpty()
      .withMessage('Question ID is required')
      .isLength({ max: LENGTH_LIMITS.ID }),
  ],
  validateRequest,
  InterviewController.markQuestionAsked
);

/**
 * POST /api/interviews/:id/question/answer
 * Submit an answer for a question
 */
router.post(
  '/:id/question/answer',
  authenticate,
  [
    param('id')
      .trim()
      .notEmpty()
      .withMessage('Interview ID is required')
      .isLength({ max: LENGTH_LIMITS.ID }),
  ],
  stripUnexpectedFields(validationSchemas.interview.submitAnswer.allowedFields),
  validationSchemas.interview.submitAnswer.validators,
  validateRequest,
  InterviewController.submitAnswer
);

export default router;
