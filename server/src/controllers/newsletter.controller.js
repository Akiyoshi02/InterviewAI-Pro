import { firestore } from '../config/firebase.js';
import logger from '../utils/logger.js';
import { sendTemplatedEmail } from '../services/email.service.js';

/**
 * Newsletter Controller
 * Handles newsletter subscription functionality
 */
export class NewsletterController {
  /**
   * Subscribe to newsletter
   * POST /api/newsletter/subscribe
   */
  static async subscribe(req, res, next) {
    try {
      const { email } = req.body;

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({
          success: false,
          error: 'Valid email address is required'
        });
      }

      // Check if email already subscribed
      const newsletterRef = firestore.collection('newsletterSubscriptions');
      const existingSubscription = await newsletterRef.where('email', '==', email.toLowerCase()).get();

      if (!existingSubscription.empty) {
        return res.status(200).json({
          success: true,
          message: 'You are already subscribed to our newsletter!',
          alreadySubscribed: true
        });
      }

      // Create new subscription
      const subscriptionData = {
        email: email.toLowerCase(),
        subscribedAt: new Date().toISOString(),
        status: 'active',
        source: 'homepage'
      };

      const docRef = await newsletterRef.add(subscriptionData);

      logger.info(`📧 New newsletter subscription: ${email}`);

      // Send welcome email
      try {
        await sendTemplatedEmail('NEWSLETTER_WELCOME', {
          email: email,
          unsubscribeUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/unsubscribe?email=${encodeURIComponent(email)}`
        });
      } catch (emailError) {
        logger.error('Failed to send welcome email:', emailError);
        // Don't fail the subscription if email fails
      }

      return res.status(201).json({
        success: true,
        message: 'Successfully subscribed to newsletter!',
        subscriptionId: docRef.id
      });
    } catch (error) {
      logger.error('Newsletter subscription error:', error);
      next(error);
    }
  }

  /**
   * Unsubscribe from newsletter
   * POST /api/newsletter/unsubscribe
   */
  static async unsubscribe(req, res, next) {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          success: false,
          error: 'Email address is required'
        });
      }

      const newsletterRef = firestore.collection('newsletterSubscriptions');
      const subscriptionDocs = await newsletterRef.where('email', '==', email.toLowerCase()).get();

      if (subscriptionDocs.empty) {
        return res.status(404).json({
          success: false,
          error: 'Email not found in subscription list'
        });
      }

      // Update status to unsubscribed
      const batch = firestore.batch();
      subscriptionDocs.forEach(doc => {
        batch.update(doc.ref, {
          status: 'unsubscribed',
          unsubscribedAt: new Date().toISOString()
        });
      });
      await batch.commit();

      logger.info(`📧 Newsletter unsubscribed: ${email}`);

      return res.status(200).json({
        success: true,
        message: 'Successfully unsubscribed from newsletter'
      });
    } catch (error) {
      logger.error('Newsletter unsubscribe error:', error);
      next(error);
    }
  }

  /**
   * Get subscription count (admin only)
   * GET /api/newsletter/stats
   */
  static async getStats(req, res, next) {
    try {
      const newsletterRef = firestore.collection('newsletterSubscriptions');
      
      const activeQuery = await newsletterRef.where('status', '==', 'active').get();
      const totalQuery = await newsletterRef.get();

      return res.status(200).json({
        success: true,
        stats: {
          active: activeQuery.size,
          total: totalQuery.size,
          unsubscribed: totalQuery.size - activeQuery.size
        }
      });
    } catch (error) {
      logger.error('Newsletter stats error:', error);
      next(error);
    }
  }
}
