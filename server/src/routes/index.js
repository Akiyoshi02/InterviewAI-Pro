import express from 'express';
import authRoutes from './auth.routes.js';
import interviewRoutes from './interview.routes.js';
import videoRoutes from './video.routes.js';
import analyticsRoutes from './analytics.routes.js';

const router = express.Router();

export function setupRoutes(app) {
  app.use('/api/auth', authRoutes);
  app.use('/api/interviews', interviewRoutes);
  app.use('/api/video', videoRoutes);
  app.use('/api/analytics', analyticsRoutes);

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });
}

export default router;
