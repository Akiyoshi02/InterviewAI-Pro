import express from 'express';
import { body } from 'express-validator';
import { GDPRController } from '../controllers/gdpr.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { validateRequest } from '../middleware/validation.middleware.js';

const router = express.Router();

// Data export (requires auth)
router.get('/export', authenticate, GDPRController.exportData);

// Request full account + data deletion
router.post(
  '/delete',
  authenticate,
  GDPRController.requestDeletion,
);

// Cancel a pending deletion request
router.delete(
  '/delete',
  authenticate,
  GDPRController.cancelDeletion,
);

// Save cookie / marketing consent (optionally authenticated)
router.post(
  '/consent',
  [
    body('analytics').optional().isBoolean(),
    body('marketing').optional().isBoolean(),
    body('functional').optional().isBoolean(),
  ],
  validateRequest,
  GDPRController.saveConsent,
);

// Get consent record (requires auth)
router.get('/consent', authenticate, GDPRController.getConsent);

export default router;
