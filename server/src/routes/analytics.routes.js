import express from 'express';
import { authenticate, requireCompany } from '../middleware/auth.middleware.js';
import { AnalyticsController } from '../controllers/analytics.controller.js';

const router = express.Router();

router.get('/dashboard', authenticate, AnalyticsController.getDashboard);
router.get('/company/metrics', authenticate, requireCompany, AnalyticsController.getCompanyMetrics);

// Company: Dashboard metrics with historical comparison
router.get('/dashboard-metrics', authenticate, requireCompany, AnalyticsController.getDashboardMetrics);

// Company: Historical metrics snapshots for trend analysis
router.get('/historical', authenticate, requireCompany, AnalyticsController.getHistoricalMetrics);

// Candidate: Dashboard metrics with historical comparison
router.get('/candidate/dashboard-metrics', authenticate, AnalyticsController.getCandidateDashboardMetrics);

// Candidate: Historical metrics snapshots for trend analysis
router.get('/candidate/historical', authenticate, AnalyticsController.getCandidateHistoricalMetrics);

export default router;
