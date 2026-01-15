import { analyticsStore } from '../services/firebaseData.service.js';
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

      // Also create a daily snapshot for historical tracking (fire-and-forget)
      analyticsStore.createDailySnapshot(organizationId).catch((err) => {
        logger.warn('Failed to create daily snapshot:', err.message);
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
}

