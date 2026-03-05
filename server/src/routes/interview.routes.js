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
 * GET /api/interviews/:id/validate-meeting-access
 * Validate a meeting token and return interview data if access is valid.
 * Used by the interview lobby when a candidate opens the meeting link.
 */
router.get(
  '/:id/validate-meeting-access',
  authenticate,
  [
    param('id')
      .trim()
      .notEmpty()
      .withMessage('Interview ID is required')
      .isLength({ max: LENGTH_LIMITS.ID }),
  ],
  validateRequest,
  InterviewController.validateMeetingLink
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
 * POST /api/interviews/:id/reschedule-request
 * Candidate requests interview rescheduling with a valid reason.
 */
router.post(
  '/:id/reschedule-request',
  authenticate,
  requireCandidate,
  [
    param('id')
      .trim()
      .notEmpty()
      .withMessage('Interview ID is required')
      .isLength({ max: LENGTH_LIMITS.ID }),
  ],
  stripUnexpectedFields(validationSchemas.interview.requestReschedule.allowedFields),
  validationSchemas.interview.requestReschedule.validators,
  validateRequest,
  InterviewController.requestInterviewReschedule,
);

/**
 * POST /api/interviews/:id/reschedule-request/:requestId/reject
 * Company rejects a pending candidate reschedule request.
 */
router.post(
  '/:id/reschedule-request/:requestId/reject',
  authenticate,
  requireCompany,
  requireApprovedOrganization,
  requireOrgRole(['ADMIN', 'RECRUITER']),
  [
    param('id')
      .trim()
      .notEmpty()
      .withMessage('Interview ID is required')
      .isLength({ max: LENGTH_LIMITS.ID }),
    param('requestId')
      .trim()
      .notEmpty()
      .withMessage('Request ID is required')
      .isLength({ max: LENGTH_LIMITS.ID }),
  ],
  stripUnexpectedFields(validationSchemas.interview.rejectRescheduleRequest.allowedFields),
  validationSchemas.interview.rejectRescheduleRequest.validators,
  validateRequest,
  InterviewController.rejectInterviewRescheduleRequest,
);

/**
 * POST /api/interviews/:id/contact-company
 * Candidate sends a message to the company about this interview.
 */
router.post(
  '/:id/contact-company',
  authenticate,
  requireCandidate,
  [
    param('id')
      .trim()
      .notEmpty()
      .withMessage('Interview ID is required')
      .isLength({ max: LENGTH_LIMITS.ID }),
  ],
  stripUnexpectedFields(validationSchemas.interview.contactCompany.allowedFields),
  validationSchemas.interview.contactCompany.validators,
  validateRequest,
  InterviewController.contactCompanyAboutInterview,
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

/**
 * PATCH /api/interviews/:id/question/:questionId/notes
 * GAP FEATURE: Save prep notes for a question
 */
router.patch(
  '/:id/question/:questionId/notes',
  authenticate,
  [
    param('id')
      .trim()
      .notEmpty()
      .withMessage('Interview ID is required')
      .isLength({ max: LENGTH_LIMITS.ID }),
    param('questionId')
      .trim()
      .notEmpty()
      .withMessage('Question ID is required')
      .isLength({ max: LENGTH_LIMITS.ID }),
    body('prepNotes')
      .optional()
      .isString()
      .isLength({ max: 500 })
      .withMessage('Prep notes must be 500 characters or less'),
  ],
  validateRequest,
  InterviewController.saveQuestionNotes
);

/**
 * POST /api/interviews/:id/share-token
 * Generate or retrieve a share token for interview results
 */
router.post(
  '/:id/share-token',
  authenticate,
  [
    param('id')
      .trim()
      .notEmpty()
      .withMessage('Interview ID is required')
      .isLength({ max: LENGTH_LIMITS.ID }),
  ],
  validateRequest,
  InterviewController.createShareToken
);

/**
 * GET /api/interviews/shared/:token
 * Get shared interview results by token (public, no auth required)
 */
router.get(
  '/shared/:token',
  [
    param('token')
      .trim()
      .notEmpty()
      .withMessage('Token is required')
      .isLength({ max: 64 }),
  ],
  validateRequest,
  InterviewController.getSharedResults
);

export default router;
