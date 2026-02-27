import { firestore as db } from '../config/firebase.js';
import logger from '../utils/logger.js';

/**
 * GDPR compliance endpoints:
 *  - GET  /api/gdpr/export      – full data export for authenticated user
 *  - DELETE /api/gdpr/delete    – request account + data deletion
 *  - POST /api/gdpr/consent     – record cookie/marketing consent
 *  - GET  /api/gdpr/consent     – retrieve stored consent record
 */
export class GDPRController {
  /**
   * Export all personal data for the authenticated user.
   * Returns a JSON object containing every document owned by the user.
   */
  static async exportData(req, res, next) {
    try {
      const userId = req.user.id;
      const email = req.user.email;

      // Collect data from all relevant collections in parallel
      const [
        profileSnap,
        interviewSnaps,
        applicationSnaps,
        notificationSnaps,
        consentSnaps,
      ] = await Promise.allSettled([
        db.collection('users').doc(userId).get(),
        db.collection('interviews').where('userId', '==', userId).get(),
        db.collection('applications').where('candidateId', '==', userId).get(),
        db.collection('notifications').where('userId', '==', userId).get(),
        db.collection('gdpr_consents').where('userId', '==', userId).get(),
      ]);

      const safeData = (snap) => {
        if (snap.status !== 'fulfilled' || !snap.value) return [];
        const val = snap.value;
        if (val.exists) return [{ id: val.id, ...val.data() }];
        if (val.docs) return val.docs.map((d) => ({ id: d.id, ...d.data() }));
        return [];
      };

      const profileData = safeData(profileSnap)[0] || null;
      // Strip sensitive server fields
      if (profileData) {
        delete profileData.passwordHash;
        delete profileData.refreshToken;
        delete profileData.passwordResetToken;
      }

      const exportPayload = {
        exportedAt: new Date().toISOString(),
        requestedBy: email,
        userId,
        profile: profileData,
        interviews: safeData(interviewSnaps),
        applications: safeData(applicationSnaps),
        notifications: safeData(notificationSnaps),
        consentHistory: safeData(consentSnaps),
      };

      // Log the export event
      await db.collection('gdpr_audit_log').add({
        userId,
        action: 'DATA_EXPORT',
        timestamp: new Date().toISOString(),
        ip: req.ip,
      }).catch(() => {});

      res.setHeader('Content-Disposition', `attachment; filename="data-export-${userId}.json"`);
      res.setHeader('Content-Type', 'application/json');
      res.json({ success: true, data: exportPayload });
    } catch (error) {
      logger.error('GDPR export error:', error);
      next(error);
    }
  }

  /**
   * Request deletion of account and all associated data.
   * For GDPR "right to erasure". Marks the account for deletion
   * (a background job or admin review should complete the wipe).
   */
  static async requestDeletion(req, res, next) {
    try {
      const userId = req.user.id;
      const email = req.user.email;

      // Check if already requested
      const existingSnap = await db.collection('gdpr_deletion_requests')
        .where('userId', '==', userId)
        .where('status', 'in', ['pending', 'processing'])
        .get();

      if (!existingSnap.empty) {
        return res.json({
          success: true,
          message: 'A deletion request is already pending.',
          requestId: existingSnap.docs[0].id,
          alreadyPending: true,
        });
      }

      const requestRef = await db.collection('gdpr_deletion_requests').add({
        userId,
        email,
        status: 'pending',
        requestedAt: new Date().toISOString(),
        scheduledDeletionAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30-day grace
        ip: req.ip,
      });

      // Mark user as pending deletion so login can show a warning
      await db.collection('users').doc(userId).update({
        pendingDeletion: true,
        pendingDeletionRequestedAt: new Date().toISOString(),
        pendingDeletionId: requestRef.id,
      }).catch(() => {});

      // Audit log
      await db.collection('gdpr_audit_log').add({
        userId,
        action: 'DELETION_REQUESTED',
        requestId: requestRef.id,
        timestamp: new Date().toISOString(),
        ip: req.ip,
      }).catch(() => {});

      logger.info(`GDPR deletion requested for user ${userId} (${email})`);

      res.json({
        success: true,
        message: 'Deletion request submitted. Your account and data will be permanently deleted within 30 days. You can cancel this request before then.',
        requestId: requestRef.id,
        scheduledAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      });
    } catch (error) {
      logger.error('GDPR deletion request error:', error);
      next(error);
    }
  }

  /**
   * Cancel a pending deletion request.
   */
  static async cancelDeletion(req, res, next) {
    try {
      const userId = req.user.id;

      const snap = await db.collection('gdpr_deletion_requests')
        .where('userId', '==', userId)
        .where('status', '==', 'pending')
        .get();

      if (snap.empty) {
        return res.status(404).json({ success: false, error: 'No pending deletion request found.' });
      }

      const batch = db.batch();
      snap.docs.forEach((doc) => batch.update(doc.ref, { status: 'cancelled', cancelledAt: new Date().toISOString() }));
      await batch.commit();

      await db.collection('users').doc(userId).update({
        pendingDeletion: false,
        pendingDeletionId: null,
      }).catch(() => {});

      await db.collection('gdpr_audit_log').add({
        userId,
        action: 'DELETION_CANCELLED',
        timestamp: new Date().toISOString(),
      }).catch(() => {});

      res.json({ success: true, message: 'Deletion request cancelled. Your account is safe.' });
    } catch (error) {
      logger.error('GDPR cancel deletion error:', error);
      next(error);
    }
  }

  /**
   * Save cookie / marketing consent preferences.
   */
  static async saveConsent(req, res, next) {
    try {
      const userId = req.user?.id || null;
      const { analytics, marketing, functional, sessionId } = req.body;

      const consentRecord = {
        userId,
        sessionId: sessionId || null,
        analytics: Boolean(analytics),
        marketing: Boolean(marketing),
        functional: functional !== false, // default true
        timestamp: new Date().toISOString(),
        ip: req.ip,
        userAgent: req.headers['user-agent'] || null,
      };

      if (userId) {
        await db.collection('gdpr_consents').doc(userId).set(consentRecord, { merge: false });
      } else {
        await db.collection('gdpr_consents').add(consentRecord);
      }

      res.json({ success: true, consent: consentRecord });
    } catch (error) {
      logger.error('GDPR save consent error:', error);
      next(error);
    }
  }

  /**
   * Retrieve consent record for the authenticated user.
   */
  static async getConsent(req, res, next) {
    try {
      const userId = req.user.id;
      const snap = await db.collection('gdpr_consents').doc(userId).get();

      if (!snap.exists) {
        return res.json({ success: true, consent: null });
      }

      res.json({ success: true, consent: { id: snap.id, ...snap.data() } });
    } catch (error) {
      logger.error('GDPR get consent error:', error);
      next(error);
    }
  }
}
