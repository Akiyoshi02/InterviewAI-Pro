import express from 'express';
import authRoutes from './auth.routes.js';
import interviewRoutes from './interview.routes.js';
import videoRoutes from './video.routes.js';
import analyticsRoutes from './analytics.routes.js';
import organizationRoutes from './organization.routes.js';
import jobRoutes from './job.routes.js';
import invitationRoutes from './invitation.routes.js';
import publicRoutes from './public.routes.js';
import pipelineRoutes from './pipeline.routes.js';
import reviewRoutes from './review.routes.js';
import activityRoutes from './activity.routes.js';
import uploadRoutes from './upload.routes.js';

const router = express.Router();

export function setupRoutes(app) {
  app.use('/api/auth', authRoutes);
  app.use('/api/interviews', interviewRoutes);
  app.use('/api/video', videoRoutes);
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/organizations', organizationRoutes);
  app.use('/api/jobs', jobRoutes);
  app.use('/api/invitations', invitationRoutes);
  app.use('/api/public', publicRoutes);
  app.use('/api/pipeline', pipelineRoutes);
  app.use('/api/reviews', reviewRoutes);
  app.use('/api/activity', activityRoutes);
  app.use('/api/uploads', uploadRoutes);

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });
}

export default router;
