import billingService, { PLANS } from '../services/billing.service.js';
import logger from '../utils/logger.js';

export class BillingController {
  /**
   * Get available plans
   */
  static async getPlans(req, res, next) {
    try {
      res.json({
        success: true,
        plans: Object.values(PLANS),
      });
    } catch (error) {
      logger.error('Get plans error:', error);
      next(error);
    }
  }

  /**
   * Get organization subscription
   */
  static async getSubscription(req, res, next) {
    try {
      const organizationId = req.user.organizationContext?.organization?.id;
      
      const subscription = await billingService.getSubscription(organizationId);
      
      // Get plan details
      const plan = PLANS[subscription.planId.toUpperCase()];
      
      res.json({
        success: true,
        subscription: {
          ...subscription,
          plan,
        },
      });
    } catch (error) {
      logger.error('Get subscription error:', error);
      next(error);
    }
  }

  /**
   * Update subscription plan
   */
  static async updateSubscription(req, res, next) {
    try {
      const organizationId = req.user.organizationContext?.organization?.id;
      const { planId } = req.body;
      
      if (!planId) {
        return res.status(400).json({ error: 'Plan ID is required' });
      }
      
      // Validate plan exists
      if (!PLANS[planId.toUpperCase()]) {
        return res.status(400).json({ error: 'Invalid plan ID' });
      }
      
      const subscription = await billingService.updateSubscription(organizationId, planId);
      const plan = PLANS[subscription.planId.toUpperCase()];
      
      res.json({
        success: true,
        subscription: {
          ...subscription,
          plan,
        },
        message: 'Subscription updated successfully',
      });
    } catch (error) {
      logger.error('Update subscription error:', error);
      next(error);
    }
  }

  /**
   * Cancel subscription
   */
  static async cancelSubscription(req, res, next) {
    try {
      const organizationId = req.user.organizationContext?.organization?.id;
      const { cancelAtPeriodEnd = true } = req.body;
      
      const subscription = await billingService.cancelSubscription(organizationId, cancelAtPeriodEnd);
      
      res.json({
        success: true,
        subscription,
        message: cancelAtPeriodEnd
          ? 'Subscription will be canceled at the end of the billing period'
          : 'Subscription canceled immediately',
      });
    } catch (error) {
      logger.error('Cancel subscription error:', error);
      next(error);
    }
  }

  /**
   * Get usage stats
   */
  static async getUsage(req, res, next) {
    try {
      const organizationId = req.user.organizationContext?.organization?.id;
      
      const subscription = await billingService.getSubscription(organizationId);
      const plan = PLANS[subscription.planId.toUpperCase()];
      
      // Calculate usage percentages
      const usageStats = {};
      for (const [feature, limit] of Object.entries(plan.features)) {
        if (typeof limit === 'number') {
          const current = subscription.usage[feature] || 0;
          usageStats[feature] = {
            limit: limit === -1 ? 'unlimited' : limit,
            current,
            remaining: limit === -1 ? 'unlimited' : Math.max(0, limit - current),
            percentage: limit === -1 ? 0 : Math.min(100, (current / limit) * 100),
          };
        }
      }
      
      res.json({
        success: true,
        usage: usageStats,
        plan: plan.name,
      });
    } catch (error) {
      logger.error('Get usage error:', error);
      next(error);
    }
  }

  /**
   * Get billing history
   */
  static async getBillingHistory(req, res, next) {
    try {
      const organizationId = req.user.organizationContext?.organization?.id;
      const { limit = 50 } = req.query;
      
      const history = await billingService.getBillingHistory(organizationId, parseInt(limit));
      
      res.json({
        success: true,
        history,
      });
    } catch (error) {
      logger.error('Get billing history error:', error);
      next(error);
    }
  }

  /**
   * Check if feature is available (utility endpoint)
   */
  static async checkFeatureAccess(req, res, next) {
    try {
      const organizationId = req.user.organizationContext?.organization?.id;
      const { feature } = req.params;
      
      const limitCheck = await billingService.checkLimit(organizationId, feature);
      
      res.json({
        success: true,
        ...limitCheck,
      });
    } catch (error) {
      logger.error('Check feature access error:', error);
      next(error);
    }
  }

  /**
   * Create Stripe checkout session (placeholder)
   */
  static async createCheckoutSession(req, res, next) {
    try {
      const organizationId = req.user.organizationContext?.organization?.id;
      const { planId } = req.body;
      
      if (!PLANS[planId.toUpperCase()]) {
        return res.status(400).json({ error: 'Invalid plan ID' });
      }
      
      // TODO: Implement Stripe checkout session creation
      // const session = await stripe.checkout.sessions.create({
      //   customer: subscription.customerId,
      //   success_url: `${process.env.FRONTEND_URL}/billing/success`,
      //   cancel_url: `${process.env.FRONTEND_URL}/billing`,
      //   line_items: [{ price: priceId, quantity: 1 }],
      //   mode: 'subscription',
      // });
      
      logger.info(`Checkout session creation requested for org ${organizationId}, plan ${planId}`);
      
      res.json({
        success: true,
        checkoutUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/billing/checkout?plan=${planId}`,
        message: 'Stripe integration coming soon',
      });
    } catch (error) {
      logger.error('Create checkout session error:', error);
      next(error);
    }
  }
}

