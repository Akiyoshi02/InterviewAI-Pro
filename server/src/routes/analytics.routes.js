import express from 'express';
import { authenticate, requireCompany } from '../middleware/auth.middleware.js';
import { AnalyticsController } from '../controllers/analytics.controller.js';

const router = express.Router();

router.get('/dashboard', authenticate, AnalyticsController.getDashboard);
router.get('/company/metrics', authenticate, requireCompany, AnalyticsController.getCompanyMetrics);

export default router;
