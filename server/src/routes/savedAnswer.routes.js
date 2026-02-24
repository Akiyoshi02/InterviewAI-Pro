import express from 'express';
import { authenticate, requireCandidate } from '../middleware/auth.middleware.js';
import { SavedAnswerController } from '../controllers/savedAnswer.controller.js';
import { stripUnexpectedFields, validateRequest } from '../middleware/inputValidation.middleware.js';
import { validationSchemas } from '../middleware/inputValidation.middleware.js';

const router = express.Router();

/**
 * GAP FEATURE: Personal Answer Library Routes
 * All routes require candidate authentication
 */

// Save answer to library
router.post(
  '/',
  authenticate,
  requireCandidate,
  stripUnexpectedFields(validationSchemas.savedAnswer.create.allowedFields),
  validationSchemas.savedAnswer.create.validators,
  validateRequest,
  SavedAnswerController.saveAnswer
);

// List saved answers
router.get(
  '/',
  authenticate,
  requireCandidate,
  SavedAnswerController.listSavedAnswers
);

// Update saved answer
router.patch(
  '/:id',
  authenticate,
  requireCandidate,
  stripUnexpectedFields(validationSchemas.savedAnswer.update.allowedFields),
  validationSchemas.savedAnswer.update.validators,
  validateRequest,
  SavedAnswerController.updateSavedAnswer
);

// Delete saved answer
router.delete(
  '/:id',
  authenticate,
  requireCandidate,
  SavedAnswerController.deleteSavedAnswer
);

export default router;
