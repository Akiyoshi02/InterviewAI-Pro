import express from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { NotificationController } from '../controllers/notification.controller.js';

const router = express.Router();

router.get('/', authenticate, NotificationController.list);
router.patch('/:id/read', authenticate, NotificationController.markRead);
router.patch('/read-all', authenticate, NotificationController.markAllRead);
router.delete('/:id', authenticate, NotificationController.deleteNotification);

export default router;
