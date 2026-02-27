import express from 'express';
import { OAuthController } from '../controllers/oauth.controller.js';

const router = express.Router();

// LinkedIn OAuth callback
router.get('/linkedin/callback', OAuthController.linkedinCallback);

// GitHub OAuth callback
router.get('/github/callback', OAuthController.githubCallback);

export default router;
