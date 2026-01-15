import express from 'express';
import { authenticate, requireCompany } from '../middleware/auth.middleware.js';
import { AnalyticsController } from '../controllers/analytics.controller.js';

const router = express.Router();

router.get('/dashboard', authenticate, AnalyticsController.getDashboard);
router.get('/company/metrics', authenticate, requireCompany, AnalyticsController.getCompanyMetrics);

// New: Dashboard metrics with historical comparison
router.get('/dashboard-metrics', authenticate, requireCompany, AnalyticsController.getDashboardMetrics);

// New: Historical metrics snapshots for trend analysis
router.get('/historical', authenticate, requireCompany, AnalyticsController.getHistoricalMetrics);

export default router;
