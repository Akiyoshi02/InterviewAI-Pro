import { notificationStore } from '../services/firebaseData.service.js';
import logger from '../utils/logger.js';

export class NotificationController {
  static async list(req, res, next) {
    try {
      const userId = req.user.id;
      const unreadOnly = req.query.unreadOnly === 'true';
      const limit = Math.min(parseInt(req.query.limit, 10) || 30, 50);

      const notifications = await notificationStore.listByUser(userId, { limit, unreadOnly });
      const unreadCount = await notificationStore.countUnread(userId);

      res.json({ success: true, notifications, unreadCount });
    } catch (error) {
      logger.error('List notifications error:', error);
      next(error);
    }
  }

  static async markRead(req, res, next) {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const updated = await notificationStore.markRead(id, userId);
      if (!updated) {
        return res.status(404).json({ success: false, error: 'Notification not found.' });
      }
      res.json({ success: true, notification: updated });
    } catch (error) {
      logger.error('Mark notification read error:', error);
      next(error);
    }
  }

  static async markAllRead(req, res, next) {
    try {
      const userId = req.user.id;
      const count = await notificationStore.markAllRead(userId);
      res.json({ success: true, markedCount: count });
    } catch (error) {
      logger.error('Mark all notifications read error:', error);
      next(error);
    }
  }

  static async deleteNotification(req, res, next) {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const deleted = await notificationStore.delete(id, userId);
      if (!deleted) {
        return res.status(404).json({ success: false, error: 'Notification not found.' });
      }
      res.json({ success: true });
    } catch (error) {
      logger.error('Delete notification error:', error);
      next(error);
    }
  }
}
