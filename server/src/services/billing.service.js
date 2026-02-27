import logger from '../utils/logger.js';
import admin from '../config/firebase.js';

const subscriptionsCollection = admin.firestore().collection('subscriptions');
const billingEventsCollection = admin.firestore().collection('billingEvents');

/**
 * Billing Service
 * 
 * Manages subscriptions, billing, and usage tracking.
 * Designed to integrate with payment providers like Stripe.
 */

// Subscription plans
export const PLANS = {
  FREE: {
    id: 'free',
    name: 'Free',
    price: 0,
    interval: 'month',
    features: {
      interviews: 5,
      jobs: 1,
      teammembers: 1,
      storage: 1, // GB
      support: 'community',
      aiModels: ['basic'],
    },
  },
  STARTER: {
    id: 'starter',
    name: 'Starter',
    price: 99,
    interval: 'month',
    features: {
      interviews: 50,
      jobs: 5,
      teamMembers: 3,
      storage: 10,
      support: 'email',
      aiModels: ['basic', 'advanced'],
    },
  },
  PROFESSIONAL: {
    id: 'professional',
    name: 'Professional',
    price: 299,
    interval: 'month',
    features: {
      interviews: 200,
      jobs: 20,
      teamMembers: 10,
      storage: 50,
      support: 'priority',
      aiModels: ['basic', 'advanced', 'premium'],
      customBranding: true,
      apiAccess: true,
    },
  },
  ENTERPRISE: {
    id: 'enterprise',
    name: 'Enterprise',
    price: 999,
    interval: 'month',
    features: {
      interviews: -1, // unlimited
      jobs: -1,
      teamMembers: -1,
      storage: 500,
      support: 'dedicated',
      aiModels: ['basic', 'advanced', 'premium', 'custom'],
      customBranding: true,
      apiAccess: true,
      sso: true,
      customContracts: true,
      dedicatedInfrastructure: true,
    },
  },
};

/**
 * Get subscription for organization
 */
export async function getSubscription(organizationId) {
  try {
    const doc = await subscriptionsCollection.doc(organizationId).get();
    
    if (!doc.exists) {
      // Create default free subscription
      return await createSubscription(organizationId, 'free');
    }
    
    return doc.data();
  } catch (error) {
    logger.error('Get subscription error:', error);
    throw error;
  }
}

/**
 * Create a new subscription
 */
export async function createSubscription(organizationId, planId, customerId = null, subscriptionId = null) {
  try {
    const plan = PLANS[planId.toUpperCase()] || PLANS.FREE;
    
    const subscription = {
      organizationId,
      planId: plan.id,
      planName: plan.name,
      status: 'active',
      currentPeriodStart: new Date().toISOString(),
      currentPeriodEnd: getNextBillingDate(plan.interval),
      customerId,
      subscriptionId,
      usage: {
        interviews: 0,
        jobs: 0,
        storage: 0,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    await subscriptionsCollection.doc(organizationId).set(subscription);
    
    // Log billing event
    await recordBillingEvent(organizationId, 'SUBSCRIPTION_CREATED', {
      planId: plan.id,
      planName: plan.name,
    });
    
    logger.info(`Subscription created for organization ${organizationId}: ${plan.name}`);
    
    return subscription;
  } catch (error) {
    logger.error('Create subscription error:', error);
    throw error;
  }
}

/**
 * Update subscription plan
 */
export async function updateSubscription(organizationId, newPlanId, stripeCustomerId, stripeSubscriptionId) {
  try {
    const currentSubscription = await getSubscription(organizationId);
    const newPlan = PLANS[newPlanId.toUpperCase()];
    
    if (!newPlan) {
      throw new Error('Invalid plan ID');
    }
    
    const updates = {
      planId: newPlan.id,
      planName: newPlan.name,
      updatedAt: new Date().toISOString(),
    };

    if (stripeCustomerId) updates.stripeCustomerId = stripeCustomerId;
    if (stripeSubscriptionId) updates.stripeSubscriptionId = stripeSubscriptionId;
    
    // If upgrading, reset usage counters
    if (getPlanTier(newPlanId) > getPlanTier(currentSubscription.planId)) {
      updates.usage = {
        interviews: 0,
        jobs: 0,
        storage: 0,
      };
    }
    
    await subscriptionsCollection.doc(organizationId).update(updates);
    
    // Log billing event
    await recordBillingEvent(organizationId, 'SUBSCRIPTION_UPDATED', {
      oldPlan: currentSubscription.planName,
      newPlan: newPlan.name,
    });
    
    logger.info(`Subscription updated for organization ${organizationId}: ${currentSubscription.planName} -> ${newPlan.name}`);
    
    return { ...currentSubscription, ...updates };
  } catch (error) {
    logger.error('Update subscription error:', error);
    throw error;
  }
}

/**
 * Cancel subscription
 */
export async function cancelSubscription(organizationId, cancelAtPeriodEnd = true) {
  try {
    const updates = {
      status: cancelAtPeriodEnd ? 'canceling' : 'canceled',
      canceledAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    if (!cancelAtPeriodEnd) {
      // Downgrade to free immediately
      updates.planId = 'free';
      updates.planName = 'Free';
    }
    
    await subscriptionsCollection.doc(organizationId).update(updates);
    
    // Log billing event
    await recordBillingEvent(organizationId, 'SUBSCRIPTION_CANCELED', {
      cancelAtPeriodEnd,
    });
    
    logger.info(`Subscription canceled for organization ${organizationId}`);
    
    const subscription = await getSubscription(organizationId);
    return subscription;
  } catch (error) {
    logger.error('Cancel subscription error:', error);
    throw error;
  }
}

/**
 * Check if organization can perform action based on plan limits
 */
export async function checkLimit(organizationId, feature) {
  try {
    const subscription = await getSubscription(organizationId);
    const plan = PLANS[subscription.planId.toUpperCase()];
    
    if (!plan || !plan.features[feature]) {
      return { allowed: true }; // Default to allow if feature not defined
    }
    
    const limit = plan.features[feature];
    
    // -1 means unlimited
    if (limit === -1) {
      return { allowed: true, unlimited: true };
    }
    
    const currentUsage = subscription.usage[feature] || 0;
    
    return {
      allowed: currentUsage < limit,
      limit,
      current: currentUsage,
      remaining: Math.max(0, limit - currentUsage),
    };
  } catch (error) {
    logger.error('Check limit error:', error);
    // Default to allow on error
    return { allowed: true };
  }
}

/**
 * Increment usage counter
 */
export async function incrementUsage(organizationId, feature, amount = 1) {
  try {
    await subscriptionsCollection.doc(organizationId).update({
      [`usage.${feature}`]: admin.firestore.FieldValue.increment(amount),
      updatedAt: new Date().toISOString(),
    });
    
    logger.info(`Usage incremented for ${organizationId}: ${feature} +${amount}`);
  } catch (error) {
    logger.error('Increment usage error:', error);
    // Don't throw, usage tracking is not critical
  }
}

/**
 * Get billing history
 */
export async function getBillingHistory(organizationId, limit = 50) {
  try {
    const snapshot = await billingEventsCollection
      .where('organizationId', '==', organizationId)
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get();
    
    return snapshot.docs.map((doc) => doc.data());
  } catch (error) {
    // Some environments may miss the composite index for this query.
    // Fall back to an unordered query and sort in-memory so billing UI still works.
    logger.warn('Get billing history ordered query failed, using fallback query:', error?.message || error);

    try {
      const fallbackSnapshot = await billingEventsCollection
        .where('organizationId', '==', organizationId)
        .limit(limit)
        .get();

      return fallbackSnapshot.docs
        .map((doc) => doc.data())
        .sort((a, b) => {
          const aTs = Date.parse(a?.timestamp || '') || 0;
          const bTs = Date.parse(b?.timestamp || '') || 0;
          return bTs - aTs;
        });
    } catch (fallbackError) {
      logger.error('Get billing history fallback error:', fallbackError);
      return [];
    }
  }
}

/**
 * Record billing event
 */
async function recordBillingEvent(organizationId, eventType, metadata = {}) {
  try {
    const ref = billingEventsCollection.doc();
    const event = {
      id: ref.id,
      organizationId,
      eventType,
      metadata,
      timestamp: new Date().toISOString(),
    };
    
    await ref.set(event);
  } catch (error) {
    logger.error('Record billing event error:', error);
    // Don't throw, event logging is not critical
  }
}

/**
 * Helper functions
 */
function getNextBillingDate(interval) {
  const now = new Date();
  
  if (interval === 'month') {
    return new Date(now.setMonth(now.getMonth() + 1)).toISOString();
  } else if (interval === 'year') {
    return new Date(now.setFullYear(now.getFullYear() + 1)).toISOString();
  }
  
  return new Date(now.setMonth(now.getMonth() + 1)).toISOString();
}

function getPlanTier(planId) {
  const tiers = {
    free: 0,
    starter: 1,
    professional: 2,
    enterprise: 3,
  };
  return tiers[planId.toLowerCase()] || 0;
}

/**
 * Stripe integration helpers (to be implemented)
 */
export const stripe = {
  /**
   * Create Stripe customer
   */
  async createCustomer(organizationId, email, name) {
    // TODO: Implement Stripe customer creation
    // const Stripe = require('stripe');
    // const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    // const customer = await stripe.customers.create({ email, name });
    // return customer.id;
    
    logger.info(`Stripe customer creation placeholder for ${organizationId}`);
    return `cus_${organizationId}_placeholder`;
  },

  /**
   * Create Stripe subscription
   */
  async createStripeSubscription(customerId, priceId) {
    // TODO: Implement Stripe subscription creation
    // const subscription = await stripe.subscriptions.create({
    //   customer: customerId,
    //   items: [{ price: priceId }],
    // });
    // return subscription;
    
    logger.info(`Stripe subscription creation placeholder for customer ${customerId}`);
    return { id: `sub_placeholder_${Date.now()}` };
  },

  /**
   * Cancel Stripe subscription
   */
  async cancelStripeSubscription(subscriptionId) {
    // TODO: Implement Stripe subscription cancellation
    // await stripe.subscriptions.cancel(subscriptionId);
    
    logger.info(`Stripe subscription cancellation placeholder for ${subscriptionId}`);
  },

  /**
   * Update Stripe subscription
   */
  async updateStripeSubscription(subscriptionId, newPriceId) {
    // TODO: Implement Stripe subscription update
    // const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    // await stripe.subscriptions.update(subscriptionId, {
    //   items: [{ id: subscription.items.data[0].id, price: newPriceId }],
    // });
    
    logger.info(`Stripe subscription update placeholder for ${subscriptionId}`);
  },
};

export default {
  PLANS,
  getSubscription,
  createSubscription,
  updateSubscription,
  cancelSubscription,
  checkLimit,
  incrementUsage,
  getBillingHistory,
  stripe,
};
