import billingService, { PLANS } from '../services/billing.service.js';
import logger from '../utils/logger.js';
import Stripe from 'stripe';

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' })
  : null;

// Map plan IDs to Stripe price IDs (configured via environment variables)
const STRIPE_PRICE_IDS = {
  starter: process.env.STRIPE_PRICE_STARTER || null,
  professional: process.env.STRIPE_PRICE_PROFESSIONAL || null,
  enterprise: process.env.STRIPE_PRICE_ENTERPRISE || null,
};

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
      
      if (!stripe) {
        // Stripe not configured – return a placeholder URL for demo/dev
        logger.warn('Stripe not configured. Returning placeholder checkout URL.');
        return res.json({
          success: true,
          checkoutUrl: null,
          message: 'Stripe is not yet configured. Set STRIPE_SECRET_KEY and STRIPE_PRICE_* environment variables to enable payments.',
          configured: false,
        });
      }

      const priceId = STRIPE_PRICE_IDS[planId.toLowerCase()];
      if (!priceId) {
        return res.status(400).json({ success: false, error: `No Stripe price configured for plan "${planId}".` });
      }

      const subscription = await billingService.getSubscription(organizationId);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

      const sessionParams = {
        mode: 'subscription',
        success_url: `${frontendUrl}/company-billing?session_id={CHECKOUT_SESSION_ID}&status=success`,
        cancel_url: `${frontendUrl}/company-billing?status=cancelled`,
        line_items: [{ price: priceId, quantity: 1 }],
        metadata: { organizationId, planId },
        subscription_data: { metadata: { organizationId, planId } },
      };

      // Attach existing customer if available
      if (subscription?.stripeCustomerId) {
        sessionParams.customer = subscription.stripeCustomerId;
      } else if (req.user.email) {
        sessionParams.customer_email = req.user.email;
      }

      const session = await stripe.checkout.sessions.create(sessionParams);
      logger.info(`Stripe checkout session created: ${session.id} for org ${organizationId}, plan ${planId}`);

      res.json({
        success: true,
        checkoutUrl: session.url,
        sessionId: session.id,
        configured: true,
      });
    } catch (error) {
      logger.error('Create checkout session error:', error);
      next(error);
    }
  }

  /**
   * POST /api/billing/webhook
   * Handles incoming Stripe webhook events.
   */
  static async handleWebhook(req, res) {
    if (!stripe) {
      return res.status(501).json({ error: 'Stripe not configured' });
    }

    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    let event;

    try {
      event = webhookSecret
        ? stripe.webhooks.constructEvent(req.body, sig, webhookSecret)
        : JSON.parse(req.body.toString());
    } catch (err) {
      logger.error('Stripe webhook signature verification failed:', err);
      return res.status(400).json({ error: `Webhook Error: ${err.message}` });
    }

    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object;
          const { organizationId, planId } = session.metadata || {};
          if (organizationId && planId) {
            await billingService.updateSubscription(
              organizationId,
              planId,
              session.customer,
              session.subscription,
            );
            logger.info(`Subscription activated for org ${organizationId}, plan ${planId}`);
          }
          break;
        }
        case 'customer.subscription.updated': {
          const sub = event.data.object;
          const { organizationId } = sub.metadata || {};
          if (organizationId) {
            const planIdFromPriceId = Object.entries(STRIPE_PRICE_IDS)
              .find(([, pid]) => sub.items?.data?.[0]?.price?.id === pid)?.[0];
            if (planIdFromPriceId) {
              await billingService.updateSubscription(organizationId, planIdFromPriceId, sub.customer, sub.id);
            }
          }
          break;
        }
        case 'customer.subscription.deleted': {
          const sub = event.data.object;
          const { organizationId } = sub.metadata || {};
          if (organizationId) {
            await billingService.cancelSubscription(organizationId, false);
            logger.info(`Subscription cancelled for org ${organizationId}`);
          }
          break;
        }
        default:
          logger.debug(`Unhandled Stripe event type: ${event.type}`);
      }
      res.json({ received: true });
    } catch (err) {
      logger.error('Stripe webhook processing error:', err);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  }
}

