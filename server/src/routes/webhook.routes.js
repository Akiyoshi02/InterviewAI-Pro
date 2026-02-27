import express from 'express';
import { body, param } from 'express-validator';
import { WebhookController } from '../controllers/webhook.controller.js';
import {
  authenticate,
  requireOrganizationContext,
  requireOrgRole,
} from '../middleware/auth.middleware.js';
import { validateRequest } from '../middleware/validation.middleware.js';

const router = express.Router();

// All webhook management requires auth + org context + ADMIN role
router.use(authenticate, requireOrganizationContext, requireOrgRole(['ADMIN']));

router.get('/', WebhookController.list);

router.post(
  '/',
  [
    body('url').isURL({ protocols: ['http', 'https'] }).withMessage('Must be a valid HTTP(S) URL'),
    body('events').isArray({ min: 1 }).withMessage('At least one event type required'),
    body('description').optional().isString().isLength({ max: 200 }),
  ],
  validateRequest,
  WebhookController.create,
);

router.put(
  '/:id',
  [
    param('id').isString().notEmpty(),
    body('url').optional().isURL({ protocols: ['http', 'https'] }),
    body('events').optional().isArray({ min: 1 }),
    body('active').optional().isBoolean(),
  ],
  validateRequest,
  WebhookController.update,
);

router.delete('/:id', [param('id').isString().notEmpty()], validateRequest, WebhookController.remove);

router.post('/:id/test', [param('id').isString().notEmpty()], validateRequest, WebhookController.test);

router.get('/:id/deliveries', [param('id').isString().notEmpty()], validateRequest, WebhookController.deliveries);

export default router;
