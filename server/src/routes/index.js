import express from 'express';
import authRoutes from './auth.routes.js';
import interviewRoutes from './interview.routes.js';
import videoRoutes from './video.routes.js';
import analyticsRoutes from './analytics.routes.js';
import organizationRoutes from './organization.routes.js';
import jobRoutes from './job.routes.js';
import invitationRoutes from './invitation.routes.js';
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
import { addMaintenanceHeader } from '../middleware/maintenance.middleware.js';

const router = express.Router();

export function setupRoutes(app) {
  // Routes (maintenance mode is checked within each route after authentication)
  app.use('/api/auth', authRoutes);
  app.use('/api/interviews', interviewRoutes);
  app.use('/api/video', videoRoutes);
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/organizations', organizationRoutes);
  app.use('/api/jobs', jobRoutes);
  app.use('/api/invitations', invitationRoutes);
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
  app.use('/api', applicationRoutes);

  // Add maintenance header to all API responses
  app.use('/api', addMaintenanceHeader);

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });
}

export default router;
