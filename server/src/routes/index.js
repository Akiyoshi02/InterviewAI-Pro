import express from 'express';
import multer from 'multer';
import authRoutes from './auth.routes.js';
import interviewRoutes from './interview.routes.js';
import videoRoutes from './video.routes.js';
import analyticsRoutes from './analytics.routes.js';
import organizationRoutes from './organization.routes.js';
import jobRoutes from './job.routes.js';
import teamInvitationRoutes from './teamInvitation.routes.js';
import publicRoutes from './public.routes.js';
import pipelineRoutes from './pipeline.routes.js';
import reviewRoutes from './review.routes.js';
import activityRoutes from './activity.routes.js';
import uploadRoutes from './upload.routes.js';
import objectStorageRoutes from './objectStorage.routes.js';
import adminRoutes from './admin.routes.js';
import applicationRoutes from './application.routes.js';
import templateRoutes from './template.routes.js';
import billingRoutes from './billing.routes.js';
import newsletterRoutes from './newsletter.routes.js';
import datasetRoutes from './dataset.routes.js';
import savedAnswerRoutes from './savedAnswer.routes.js'; // GAP FEATURE: Personal Answer Library
import notificationRoutes from './notification.routes.js';
import gdprRoutes from './gdpr.routes.js';
import twofaRoutes from './twofa.routes.js';
import oauthRoutes from './oauth.routes.js';
import webhookRoutes from './webhook.routes.js';
import referralRoutes from './referral.routes.js';
import companyProfileRoutes from './companyProfile.routes.js';
import { addMaintenanceHeader } from '../middleware/maintenance.middleware.js';
import { uploadLimiter } from '../middleware/rateLimiter.middleware.js';
import { LLMService } from '../services/llm.service.js';

const router = express.Router();
const whisperProxyUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: Math.max(5 * 1024 * 1024, Number.parseInt(process.env.WHISPER_PROXY_MAX_BYTES || '26214400', 10) || 26214400),
    files: 1,
  },
});

export function setupRoutes(app) {
  // Routes (maintenance mode is checked within each route after authentication)
  app.use('/api/auth', authRoutes);
  app.use('/api/interviews', interviewRoutes);
  app.use('/api/video', videoRoutes);
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/organizations', organizationRoutes);
  app.use('/api/jobs', jobRoutes);
  app.use('/api/organizations/me/team-invitations', teamInvitationRoutes);
  app.use('/api/public', publicRoutes);
  app.use('/api/pipeline', pipelineRoutes);
  app.use('/api/reviews', reviewRoutes);
  app.use('/api/activity', activityRoutes);
  app.use('/api/uploads', uploadRoutes);
  app.use('/api/object-storage', objectStorageRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/templates', templateRoutes);
  app.use('/api/billing', billingRoutes);
  app.use('/api/newsletter', newsletterRoutes);
  app.use('/api/datasets', datasetRoutes);
  app.use('/api/saved-answers', savedAnswerRoutes); // GAP FEATURE: Personal Answer Library
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/gdpr', gdprRoutes);
  app.use('/api/2fa', twofaRoutes);
  app.use('/api/oauth', oauthRoutes);
  app.use('/api/webhooks', webhookRoutes);
  app.use('/api/referrals', referralRoutes);
  app.use('/api/companies', companyProfileRoutes);
  app.use('/api', applicationRoutes);

  // Add maintenance header to all API responses
  app.use('/api', addMaintenanceHeader);

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // AI health check (used for demo readiness verification).
  app.get('/api/ai/health', async (req, res) => {
    try {
      const expectedModel = process.env.OLLAMA_MODEL || 'qwen3:8b';
      const runtimeModel = LLMService.getRuntimeModelStatus();
      const [ollama, whisper] = await Promise.all([
        LLMService.healthCheck({ expectedModel }),
        LLMService.getWhisperHealth(),
      ]);

      res.json({
        success: true,
        timestamp: new Date().toISOString(),
        model: expectedModel,
        ollamaReachable: Boolean(ollama.healthy),
        modelReady: Boolean(ollama.modelReady),
        ollama,
        runtimeModel,
        whisperReachable: whisper.reachable,
        whisperConfigured: whisper.configured,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        timestamp: new Date().toISOString(),
        error: error?.message || 'AI health check failed',
        runtimeModel: LLMService.getRuntimeModelStatus(),
      });
    }
  });

  app.get('/api/ai/whisper/models', async (req, res) => {
    try {
      const models = await LLMService.getWhisperModels();
      res.json(models);
    } catch (error) {
      res.status(error?.status || (error?.code === 'WHISPER_NOT_CONFIGURED' ? 503 : 500)).json({
        success: false,
        error: error?.message || 'Whisper models lookup failed',
      });
    }
  });

  app.post('/api/ai/whisper/transcribe', uploadLimiter, whisperProxyUpload.single('audio'), async (req, res) => {
    try {
      if (!req.file?.buffer?.length) {
        return res.status(400).json({
          success: false,
          error: 'No audio file provided',
        });
      }

      const payload = await LLMService.proxyWhisperTranscription({
        audioBuffer: req.file.buffer,
        fileName: req.file.originalname,
        mimeType: req.file.mimetype,
        language: req.body?.language,
        task: req.body?.task,
      });

      return res.json(payload);
    } catch (error) {
      return res.status(error?.status || (error?.code === 'WHISPER_NOT_CONFIGURED' ? 503 : 500)).json({
        success: false,
        error: error?.message || 'Whisper transcription proxy failed',
      });
    }
  });
}

export default router;
