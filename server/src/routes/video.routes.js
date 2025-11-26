import express from 'express';
import { param } from 'express-validator';
import { authenticate } from '../middleware/auth.middleware.js';
import { validateRequest } from '../middleware/validation.middleware.js';
import { VideoController } from '../controllers/video.controller.js';

const router = express.Router();

// Get WebRTC configuration (STUN/TURN servers)
router.get('/config', VideoController.getWebRTCConfig);

// Create/join video session
router.post(
  '/session/:interviewId',
  authenticate,
  param('interviewId').isString(),
  validateRequest,
  VideoController.createSession
);

// Get session details
router.get(
  '/session/:interviewId',
  authenticate,
  param('interviewId').isString(),
  validateRequest,
  VideoController.getSession
);

export default router;
