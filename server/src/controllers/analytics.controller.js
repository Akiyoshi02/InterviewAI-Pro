import { analyticsStore } from '../services/firebaseData.service.js';
import { queueAnalyticsJob } from '../services/backgroundJobQueue.service.js';
import logger from '../utils/logger.js';

export class AnalyticsController {
  static async getDashboard(req, res, next) {
    try {
      const userId = req.user.id;
      const accountType = req.user.accountType;

      const stats = await analyticsStore.getStatsForUser(userId, accountType);

      res.json({
        success: true,
        stats,
      });
    } catch (error) {
      logger.error('Get dashboard error:', error);
      next(error);
    }
  }

  static async getCompanyMetrics(req, res, next) {
    try {
      const companyId = req.user.id;

      const metrics = await analyticsStore.getCompanyMetrics(companyId);

      res.json({
        success: true,
        metrics,
      });
    } catch (error) {
      logger.error('Get company metrics error:', error);
      next(error);
    }
  }

  /**
   * Get comprehensive dashboard metrics with historical comparison data
   * This endpoint provides real-time metrics with week-over-week comparisons
   */
  static async getDashboardMetrics(req, res, next) {
    try {
      const organizationId = req.user.profile?.primaryOrganizationId;

      if (!organizationId) {
        return res.status(400).json({
          success: false,
          error: 'Organization context required',
        });
      }

      const metrics = await analyticsStore.getDashboardMetricsWithComparison(organizationId);

      // Create a daily snapshot in background to keep response latency stable.
      queueAnalyticsJob({
        type: 'ORG_DAILY_SNAPSHOT',
        payload: { organizationId },
        handler: async ({ organizationId: orgId }) => {
          await analyticsStore.createDailySnapshot(orgId);
        },
      });

      res.json({
        success: true,
        metrics,
      });
    } catch (error) {
      logger.error('Get dashboard metrics error:', error);
      next(error);
    }
  }

  /**
   * Get historical metrics snapshots for trend analysis
   */
  static async getHistoricalMetrics(req, res, next) {
    try {
      const organizationId = req.user.profile?.primaryOrganizationId;
      const days = Math.min(parseInt(req.query.days, 10) || 7, 30); // Max 30 days

      if (!organizationId) {
        return res.status(400).json({
          success: false,
          error: 'Organization context required',
        });
      }

      const snapshots = await analyticsStore.getSnapshots(organizationId, days);

      res.json({
        success: true,
        snapshots,
      });
    } catch (error) {
      logger.error('Get historical metrics error:', error);
      next(error);
    }
  }

  // ============================================
  // CANDIDATE ANALYTICS ENDPOINTS
  // ============================================

  /**
   * Get candidate dashboard metrics with historical comparison data
   * This endpoint provides real-time metrics with week-over-week comparisons for candidates
   */
  static async getCandidateDashboardMetrics(req, res, next) {
    try {
      const candidateId = req.user.id;

      if (req.user.accountType?.toUpperCase() !== 'CANDIDATE') {
        return res.status(403).json({
          success: false,
          error: 'This endpoint is for candidates only',
        });
      }

      const metrics = await analyticsStore.getCandidateDashboardMetricsWithComparison(candidateId);

      // Create candidate snapshot in background to avoid blocking dashboard responses.
      queueAnalyticsJob({
        type: 'CANDIDATE_DAILY_SNAPSHOT',
        payload: { candidateId },
        handler: async ({ candidateId: targetCandidateId }) => {
          await analyticsStore.createCandidateDailySnapshot(targetCandidateId);
        },
      });

      res.json({
        success: true,
        metrics,
      });
    } catch (error) {
      logger.error('Get candidate dashboard metrics error:', error);
      next(error);
    }
  }

  /**
   * Get candidate historical metrics snapshots for trend analysis
   */
  static async getCandidateHistoricalMetrics(req, res, next) {
    try {
      const candidateId = req.user.id;
      const days = Math.min(parseInt(req.query.days, 10) || 7, 30); // Max 30 days

      if (req.user.accountType?.toUpperCase() !== 'CANDIDATE') {
        return res.status(403).json({
          success: false,
          error: 'This endpoint is for candidates only',
        });
      }

      const snapshots = await analyticsStore.getCandidateSnapshots(candidateId, days);

      res.json({
        success: true,
        snapshots,
      });
    } catch (error) {
      logger.error('Get candidate historical metrics error:', error);
      next(error);
    }
  }
}

