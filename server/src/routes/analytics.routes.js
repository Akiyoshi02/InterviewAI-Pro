import express from 'express';
import {
  authenticate,
  requireCandidate,
  requireCompany,
  requireOrgRole,
} from '../middleware/auth.middleware.js';
import { requireApprovedOrganization } from '../middleware/admin.middleware.js';
import { requireFeatureFlag } from '../middleware/featureFlags.middleware.js';
import { AnalyticsController } from '../controllers/analytics.controller.js';

const router = express.Router();

router.get('/dashboard', authenticate, requireFeatureFlag('enableAnalytics'), AnalyticsController.getDashboard);
router.get('/company/metrics', authenticate, requireFeatureFlag('enableAnalytics'), requireCompany, requireApprovedOrganization, requireOrgRole(['ADMIN', 'RECRUITER']), AnalyticsController.getCompanyMetrics);

// Company: Dashboard metrics with historical comparison
router.get('/dashboard-metrics', authenticate, requireFeatureFlag('enableAnalytics'), requireCompany, requireApprovedOrganization, requireOrgRole(['ADMIN', 'RECRUITER']), AnalyticsController.getDashboardMetrics);

// Company: Historical metrics snapshots for trend analysis
router.get('/historical', authenticate, requireFeatureFlag('enableAnalytics'), requireCompany, requireApprovedOrganization, requireOrgRole(['ADMIN', 'RECRUITER']), AnalyticsController.getHistoricalMetrics);

// Candidate: Dashboard metrics with historical comparison
router.get('/candidate/dashboard-metrics', authenticate, requireFeatureFlag('enableAnalytics'), requireCandidate, AnalyticsController.getCandidateDashboardMetrics);

// Candidate: Historical metrics snapshots for trend analysis
router.get('/candidate/historical', authenticate, requireFeatureFlag('enableAnalytics'), requireCandidate, AnalyticsController.getCandidateHistoricalMetrics);

// Candidate: Full analytics — all sessions, trend, skill averages, role breakdown
router.get('/candidate/full', authenticate, requireFeatureFlag('enableAnalytics'), requireCandidate, AnalyticsController.getCandidateFullAnalytics);

// Longitudinal study data — anonymised dataset for research export
router.get('/longitudinal', authenticate, requireFeatureFlag('enableAnalytics'), AnalyticsController.getLongitudinalData);

export default router;
