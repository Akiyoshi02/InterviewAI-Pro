import { activityLogStore, userStore } from '../services/firebaseData.service.js';
import logger from '../utils/logger.js';

const sanitizeActivity = (entry, actorSummary = null) => ({
  id: entry.id,
  organizationId: entry.organizationId,
  actorId: entry.actorId,
  actorRole: entry.actorRole,
  action: entry.action,
  targetType: entry.targetType,
  targetId: entry.targetId,
  metadata: entry.metadata || {},
  createdAt: entry.createdAt,
  actor: actorSummary
    ? {
        id: actorSummary.id,
        email: actorSummary.email,
        fullName: actorSummary.fullName,
      }
    : null,
});

export class ActivityController {
  static async listOrganizationActivity(req, res, next) {
    try {
      const organizationId = req.user.organizationContext?.organization?.id;
      if (!organizationId) {
        return res.status(404).json({ error: 'Organization not found' });
      }

      const logs = await activityLogStore.listByOrganization(
        organizationId,
        parseInt(req.query.limit, 10) || 50,
      );
      const actorSummaries = await userStore.getSummaries(
        logs.map((log) => log.actorId).filter(Boolean),
      );

      res.json({
        success: true,
        activity: logs.map((log) => sanitizeActivity(log, actorSummaries.get(log.actorId))),
      });
    } catch (error) {
      logger.error('List activity error:', error);
      next(error);
    }
  }
}

export { sanitizeActivity };

