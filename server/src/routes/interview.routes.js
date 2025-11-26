import express from 'express';
import { body, param } from 'express-validator';
import { authenticate, requireCandidate, requireCompany } from '../middleware/auth.middleware.js';
import { validateRequest } from '../middleware/validation.middleware.js';
import { InterviewController } from '../controllers/interview.controller.js';

const router = express.Router();

// Create interview (Practice or Hiring)
router.post(
  '/create',
  authenticate,
  [
    body('mode').isIn(['PRACTICE', 'HIRING']).withMessage('Invalid interview mode'),
    body('jobRole').optional().isString(),
    body('experienceLevel').optional().isString(),
    body('industry').optional().isString(),
    body('interviewTypes').optional().isArray(),
    body('duration').optional().isInt({ min: 15, max: 120 }),
  ],
  validateRequest,
  InterviewController.createInterview
);

// Get interview by ID
router.get(
  '/:id',
  authenticate,
  param('id').isString(),
  validateRequest,
  InterviewController.getInterview
);

// Start interview session
router.post(
  '/:id/start',
  authenticate,
  param('id').isString(),
  validateRequest,
  InterviewController.startInterview
);

// End interview session
router.post(
  '/:id/end',
  authenticate,
  param('id').isString(),
  validateRequest,
  InterviewController.endInterview
);

// Get user's interviews
router.get(
  '/user/my-interviews',
  authenticate,
  InterviewController.getMyInterviews
);

// Get company's interviews (company only)
router.get(
  '/company/all',
  authenticate,
  requireCompany,
  InterviewController.getCompanyInterviews
);

// Get interview evaluation
router.get(
  '/:id/evaluation',
  authenticate,
  param('id').isString(),
  validateRequest,
  InterviewController.getEvaluation
);

// Mark question as asked
router.post(
  '/:id/question/asked',
  authenticate,
  param('id').isString(),
  [
    body('questionId').isString().withMessage('Question ID is required'),
  ],
  validateRequest,
  InterviewController.markQuestionAsked
);

// Submit answer for a question
router.post(
  '/:id/question/answer',
  authenticate,
  param('id').isString(),
  [
    body('questionId').isString().withMessage('Question ID is required'),
    body('answer').isString().withMessage('Answer is required'),
    body('audioUrl').optional().isString(),
  ],
  validateRequest,
  InterviewController.submitAnswer
);

export default router;
