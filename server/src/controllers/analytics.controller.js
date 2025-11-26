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
}

