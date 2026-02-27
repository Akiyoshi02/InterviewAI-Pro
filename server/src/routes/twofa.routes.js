import express from 'express';
import { body } from 'express-validator';
import { TwoFAController } from '../controllers/twofa.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { validateRequest } from '../middleware/validation.middleware.js';

const router = express.Router();

// All 2FA routes require authentication
router.use(authenticate);

// Status
router.get('/status', TwoFAController.getStatus);

// TOTP
router.post('/totp/setup', TwoFAController.totpSetup);
router.post(
  '/totp/verify',
  [body('token').isString().trim().notEmpty()],
  validateRequest,
  TwoFAController.totpVerify,
);
router.post(
  '/totp/disable',
  [body('token').isString().trim().notEmpty()],
  validateRequest,
  TwoFAController.totpDisable,
);

// Email OTP
router.post('/email/send', TwoFAController.emailOtpSend);
router.post(
  '/email/verify',
  [body('otp').isString().trim().notEmpty()],
  validateRequest,
  TwoFAController.emailOtpVerify,
);

// Backup codes
router.post(
  '/backup/use',
  [body('code').isString().trim().notEmpty()],
  validateRequest,
  TwoFAController.useBackupCode,
);

export default router;
