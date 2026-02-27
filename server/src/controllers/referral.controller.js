/**
 * Candidate Referral Program
 *
 * Candidates get a unique referral link. When a new user registers via that link
 * and completes their first interview, the referrer earns points/credits.
 *
 * Reward tiers:
 *  - 1 sign-up:       Bronze (50 pts)
 *  - 3 sign-ups:      Silver (200 pts)
 *  - 10 sign-ups:     Gold (750 pts)
 *
 * Points can be redeemed (concept; actual redemption is extensible).
 */

import crypto from 'crypto';
import { firestore as db } from '../config/firebase.js';
import logger from '../utils/logger.js';

const REWARDS = {
  signup: 50,          // points when referred user signs up
  first_interview: 100, // bonus when referred user completes first interview
};

function generateReferralCode(userId) {
  // Short, readable code derived from userId + random bytes
  const hash = crypto.createHash('sha1').update(userId + Date.now()).digest('hex');
  return `REF${hash.slice(0, 8).toUpperCase()}`;
}

async function getOrCreateReferralProfile(userId) {
  const ref = db.collection('referrals').doc(userId);
  const snap = await ref.get();

  if (snap.exists) return { id: snap.id, ...snap.data() };

  const code = generateReferralCode(userId);
  const data = {
    userId,
    code,
    totalReferrals: 0,
    completedReferrals: 0,
    totalPoints: 0,
    redeemedPoints: 0,
    tier: 'none',
    createdAt: new Date().toISOString(),
  };
  await ref.set(data);
  return { id: userId, ...data };
}

function computeTier(totalReferrals) {
  if (totalReferrals >= 10) return 'gold';
  if (totalReferrals >= 3) return 'silver';
  if (totalReferrals >= 1) return 'bronze';
  return 'none';
}

export class ReferralController {
  /**
   * GET /api/referrals/me – get own referral profile + stats
   */
  static async getMyReferral(req, res, next) {
    try {
      const userId = req.user.id;
      const profile = await getOrCreateReferralProfile(userId);

      // Fetch referred users
      const referredSnap = await db.collection('referral_signups')
        .where('referrerId', '==', userId)
        .orderBy('createdAt', 'desc')
        .limit(20)
        .get();

      const referred = referredSnap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          email: data.refereeEmail ? data.refereeEmail.replace(/(?<=.{3}).(?=[^@]*@)/, '*') : null,
          status: data.status,
          pointsAwarded: data.pointsAwarded || 0,
          joinedAt: data.createdAt,
        };
      });

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const referralLink = `${frontendUrl}/register?ref=${profile.code}`;

      res.json({
        success: true,
        referral: {
          ...profile,
          referralLink,
          tier: computeTier(profile.totalReferrals),
        },
        referred,
      });
    } catch (error) {
      logger.error('Get referral error:', error);
      next(error);
    }
  }

  /**
   * Called during registration to attribute a referral.
   * POST /api/referrals/attribute  { refCode, newUserId, newUserEmail }
   * (Internal – called from AuthController.register)
   */
  static async attributeReferral(req, res, next) {
    try {
      const { refCode, newUserId, newUserEmail } = req.body;
      if (!refCode || !newUserId) {
        return res.status(400).json({ success: false, error: 'refCode and newUserId required.' });
      }

      // Find referrer by code
      const snap = await db.collection('referrals')
        .where('code', '==', refCode.toUpperCase())
        .limit(1)
        .get();

      if (snap.empty) {
        return res.json({ success: false, message: 'Referral code not found.' });
      }

      const referrerId = snap.docs[0].id;
      if (referrerId === newUserId) {
        return res.json({ success: false, message: 'Cannot refer yourself.' });
      }

      // Check if newUser was already referred
      const existingSnap = await db.collection('referral_signups').where('refereeId', '==', newUserId).limit(1).get();
      if (!existingSnap.empty) {
        return res.json({ success: false, message: 'User already attributed.' });
      }

      // Create referral signup record
      await db.collection('referral_signups').add({
        referrerId,
        refereeId: newUserId,
        refereeEmail: newUserEmail || null,
        refCode,
        status: 'signed_up',
        pointsAwarded: REWARDS.signup,
        createdAt: new Date().toISOString(),
      });

      // Award signup points to referrer
      await db.collection('referrals').doc(referrerId).update({
        totalReferrals: (snap.docs[0].data().totalReferrals || 0) + 1,
        totalPoints: (snap.docs[0].data().totalPoints || 0) + REWARDS.signup,
      });

      // Record in point history
      await db.collection('referral_point_history').add({
        userId: referrerId,
        points: REWARDS.signup,
        reason: 'referral_signup',
        refereeId: newUserId,
        createdAt: new Date().toISOString(),
      });

      logger.info(`Referral attributed: ${referrerId} referred ${newUserId}`);
      res.json({ success: true, message: 'Referral attributed.' });
    } catch (error) {
      logger.error('Attribute referral error:', error);
      next(error);
    }
  }

  /**
   * Called when a referred user completes their first interview.
   * POST /api/referrals/complete-interview  { userId }
   * (Internal – called from InterviewController)
   */
  static async onFirstInterview(req, res, next) {
    try {
      const { userId } = req.body;
      if (!userId) return res.status(400).json({ success: false, error: 'userId required.' });

      const signupSnap = await db.collection('referral_signups')
        .where('refereeId', '==', userId)
        .where('status', '==', 'signed_up')
        .limit(1)
        .get();

      if (signupSnap.empty) {
        return res.json({ success: false, message: 'No pending referral for this user.' });
      }

      const doc = signupSnap.docs[0];
      const { referrerId } = doc.data();

      // Mark as completed
      await doc.ref.update({
        status: 'interview_completed',
        bonusPointsAwarded: REWARDS.first_interview,
        completedAt: new Date().toISOString(),
      });

      // Award bonus points to referrer
      const referrerSnap = await db.collection('referrals').doc(referrerId).get();
      if (referrerSnap.exists) {
        const current = referrerSnap.data();
        await referrerSnap.ref.update({
          completedReferrals: (current.completedReferrals || 0) + 1,
          totalPoints: (current.totalPoints || 0) + REWARDS.first_interview,
          tier: computeTier((current.totalReferrals || 0)),
        });
      }

      await db.collection('referral_point_history').add({
        userId: referrerId,
        points: REWARDS.first_interview,
        reason: 'referral_first_interview',
        refereeId: userId,
        createdAt: new Date().toISOString(),
      });

      logger.info(`Referral bonus awarded to ${referrerId} for ${userId}'s first interview`);
      res.json({ success: true, bonusPoints: REWARDS.first_interview });
    } catch (error) {
      logger.error('Referral first interview error:', error);
      next(error);
    }
  }

  /**
   * GET /api/referrals/leaderboard – top referrers
   */
  static async leaderboard(req, res, next) {
    try {
      const snap = await db.collection('referrals')
        .orderBy('totalPoints', 'desc')
        .limit(20)
        .get();

      const board = snap.docs.map((doc, idx) => {
        const d = doc.data();
        return {
          rank: idx + 1,
          userId: doc.id,
          // Anonymise – only show first name from Firestore if available
          displayName: d.displayName || `Candidate #${idx + 1}`,
          totalReferrals: d.totalReferrals || 0,
          completedReferrals: d.completedReferrals || 0,
          totalPoints: d.totalPoints || 0,
          tier: computeTier(d.totalReferrals || 0),
        };
      });

      res.json({ success: true, leaderboard: board });
    } catch (error) {
      logger.error('Leaderboard error:', error);
      next(error);
    }
  }
}


