import express from 'express';
import { body, param, query } from 'express-validator';
import { BillingController } from '../controllers/billing.controller.js';
import {
  authenticate,
  requireOrganizationContext,
  requireOrgRole,
} from '../middleware/auth.middleware.js';
import { validateRequest } from '../middleware/validation.middleware.js';

const router = express.Router();

// Get available plans (public)
router.get('/plans', BillingController.getPlans);

// Get organization subscription
router.get(
  '/subscription',
  authenticate,
  requireOrganizationContext,
  requireOrgRole(['ADMIN']),
  BillingController.getSubscription,
);

// Update subscription plan
router.put(
  '/subscription',
  authenticate,
  requireOrganizationContext,
  requireOrgRole(['ADMIN']),
  [
    body('planId')
      .isString()
      .trim()
      .notEmpty()
      .isIn(['free', 'starter', 'professional', 'enterprise'])
      .withMessage('Invalid plan ID'),
  ],
  validateRequest,
  BillingController.updateSubscription,
);

// Cancel subscription
router.delete(
  '/subscription',
  authenticate,
  requireOrganizationContext,
  requireOrgRole(['ADMIN']),
  [body('cancelAtPeriodEnd').optional().isBoolean()],
  validateRequest,
  BillingController.cancelSubscription,
);

// Get usage statistics
router.get(
  '/usage',
  authenticate,
  requireOrganizationContext,
  BillingController.getUsage,
);

// Get billing history
router.get(
  '/history',
  authenticate,
  requireOrganizationContext,
  requireOrgRole(['ADMIN']),
  [query('limit').optional().isInt({ min: 1, max: 200 })],
  validateRequest,
  BillingController.getBillingHistory,
);

// Check feature access
router.get(
  '/check/:feature',
  authenticate,
  requireOrganizationContext,
  [param('feature').isString().notEmpty()],
  validateRequest,
  BillingController.checkFeatureAccess,
);

// Create Stripe checkout session
router.post(
  '/checkout',
  authenticate,
  requireOrganizationContext,
  requireOrgRole(['ADMIN']),
  [body('planId').isString().trim().notEmpty()],
  validateRequest,
  BillingController.createCheckoutSession,
);

// Stripe webhook (raw body required – no auth middleware)
router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  BillingController.handleWebhook,
);

export default router;

