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
import admin, { firestore as db } from '../config/firebase.js';
import logger from '../utils/logger.js';

const REWARDS = {
  signup: 50,          // points when referred user signs up
  first_interview: 100, // bonus when referred user completes first interview
};

const referralsCollection = db.collection('referrals');
const referralSignupsCollection = db.collection('referral_signups');
const referralPointHistoryCollection = db.collection('referral_point_history');

const incrementBy = (value) => admin.firestore.FieldValue.increment(value);

function generateReferralCode(userId) {
  // Short, readable code derived from userId + random bytes
  const hash = crypto.createHash('sha1').update(userId + Date.now()).digest('hex');
  return `REF${hash.slice(0, 8).toUpperCase()}`;
}

async function getOrCreateReferralProfile(userId) {
  const ref = referralsCollection.doc(userId);
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
   * Internal helper to attribute referral on registration.
   * Uses deterministic signup doc IDs (`refereeId`) to avoid duplicate attribution.
   */
  static async attributeReferralInternal({ refCode, newUserId, newUserEmail }) {
    const normalizedCode = String(refCode || '').trim().toUpperCase();
    const normalizedUserId = String(newUserId || '').trim();
    const normalizedEmail = newUserEmail ? String(newUserEmail).trim().toLowerCase() : null;

    if (!normalizedCode || !normalizedUserId) {
      return { success: false, message: 'refCode and newUserId required.' };
    }

    const referrerSnapshot = await referralsCollection
      .where('code', '==', normalizedCode)
      .limit(1)
      .get();

    if (referrerSnapshot.empty) {
      return { success: false, message: 'Referral code not found.' };
    }

    const referrerDoc = referrerSnapshot.docs[0];
    const referrerId = referrerDoc.id;

    if (referrerId === normalizedUserId) {
      return { success: false, message: 'Cannot refer yourself.' };
    }

    // Backward-compat check for historic random-ID signup rows.
    const existingByReferee = await referralSignupsCollection
      .where('refereeId', '==', normalizedUserId)
      .limit(1)
      .get();
    if (!existingByReferee.empty) {
      return { success: false, message: 'User already attributed.' };
    }

    const signupRef = referralSignupsCollection.doc(normalizedUserId);
    let outcome = { success: false, message: 'User already attributed.' };

    await db.runTransaction(async (tx) => {
      const [signupDoc, latestReferrerDoc] = await Promise.all([
        tx.get(signupRef),
        tx.get(referralsCollection.doc(referrerId)),
      ]);

      if (signupDoc.exists) {
        outcome = { success: false, message: 'User already attributed.' };
        return;
      }

      const referrerData = latestReferrerDoc.exists
        ? latestReferrerDoc.data()
        : (referrerDoc.data() || {});
      const nextTotalReferrals = (referrerData.totalReferrals || 0) + 1;

      tx.set(signupRef, {
        referrerId,
        refereeId: normalizedUserId,
        refereeEmail: normalizedEmail,
        refCode: normalizedCode,
        status: 'signed_up',
        pointsAwarded: REWARDS.signup,
        createdAt: new Date().toISOString(),
      });

      tx.set(referralsCollection.doc(referrerId), {
        totalReferrals: incrementBy(1),
        totalPoints: incrementBy(REWARDS.signup),
        tier: computeTier(nextTotalReferrals),
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      tx.set(referralPointHistoryCollection.doc(), {
        userId: referrerId,
        points: REWARDS.signup,
        reason: 'referral_signup',
        refereeId: normalizedUserId,
        createdAt: new Date().toISOString(),
      });

      outcome = {
        success: true,
        message: 'Referral attributed.',
        referrerId,
      };
    });

    return outcome;
  }

  /**
   * Internal helper to award first interview bonus exactly once.
   */
  static async onFirstInterviewInternal({ userId }) {
    const normalizedUserId = String(userId || '').trim();
    if (!normalizedUserId) {
      return { success: false, message: 'userId required.' };
    }

    // Prefer deterministic ref signup doc (refereeId), fallback to legacy random-id docs.
    let signupDoc = await referralSignupsCollection.doc(normalizedUserId).get();
    if (!signupDoc.exists) {
      const signupSnap = await referralSignupsCollection
        .where('refereeId', '==', normalizedUserId)
        .where('status', '==', 'signed_up')
        .limit(1)
        .get();
      if (!signupSnap.empty) {
        signupDoc = signupSnap.docs[0];
      }
    }

    if (!signupDoc?.exists) {
      return { success: false, message: 'No pending referral for this user.' };
    }

    const signupRef = signupDoc.ref;
    let outcome = { success: false, message: 'No pending referral for this user.' };

    await db.runTransaction(async (tx) => {
      const currentSignup = await tx.get(signupRef);
      if (!currentSignup.exists) {
        outcome = { success: false, message: 'No pending referral for this user.' };
        return;
      }

      const signupData = currentSignup.data() || {};
      if (signupData.status !== 'signed_up') {
        outcome = { success: false, message: 'Referral bonus already awarded.' };
        return;
      }

      const referrerId = signupData.referrerId;
      if (!referrerId) {
        outcome = { success: false, message: 'Invalid referral signup state.' };
        return;
      }

      const referrerRef = referralsCollection.doc(referrerId);
      const referrerDoc = await tx.get(referrerRef);
      const referrerData = referrerDoc.exists ? (referrerDoc.data() || {}) : {};

      tx.update(signupRef, {
        status: 'interview_completed',
        bonusPointsAwarded: REWARDS.first_interview,
        completedAt: new Date().toISOString(),
      });

      tx.set(referrerRef, {
        completedReferrals: incrementBy(1),
        totalPoints: incrementBy(REWARDS.first_interview),
        tier: computeTier(referrerData.totalReferrals || 0),
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      tx.set(referralPointHistoryCollection.doc(), {
        userId: referrerId,
        points: REWARDS.first_interview,
        reason: 'referral_first_interview',
        refereeId: normalizedUserId,
        createdAt: new Date().toISOString(),
      });

      outcome = {
        success: true,
        bonusPoints: REWARDS.first_interview,
        referrerId,
      };
    });

    return outcome;
  }

  /**
   * GET /api/referrals/me – get own referral profile + stats
   */
  static async getMyReferral(req, res, next) {
    try {
      const userId = req.user.id;
      const profile = await getOrCreateReferralProfile(userId);

      // Fetch referred users
      const referredSnap = await referralSignupsCollection
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
      const result = await ReferralController.attributeReferralInternal({
        refCode: req.body?.refCode,
        newUserId: req.body?.newUserId,
        newUserEmail: req.body?.newUserEmail,
      });

      if (!result.success && result.message === 'refCode and newUserId required.') {
        return res.status(400).json({ success: false, error: result.message });
      }
      if (result.success) {
        logger.info(`Referral attributed: ${result.referrerId} referred ${req.body?.newUserId}`);
      }
      res.json(result);
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
      const result = await ReferralController.onFirstInterviewInternal({
        userId: req.body?.userId,
      });

      if (!result.success && result.message === 'userId required.') {
        return res.status(400).json({ success: false, error: result.message });
      }

      if (result.success) {
        logger.info(`Referral bonus awarded to ${result.referrerId} for ${req.body?.userId}'s first interview`);
      }

      res.json(result);
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
      const snap = await referralsCollection
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


