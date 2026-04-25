import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import crypto from 'crypto';
import { firestore as db } from '../config/firebase.js';
import logger from '../utils/logger.js';
import { emailService } from '../services/email.service.js';

const APP_NAME = process.env.APP_NAME || 'Interviewer';
const EMAIL_OTP_EXPIRY_MINUTES = 10;

/**
 * Two-Factor Authentication controller.
 *
 * Supports two methods:
 *   1. TOTP (Authenticator app) via speakeasy RFC 6238
 *   2. Email OTP via 6-digit code with 10-minute TTL
 *
 * Endpoints
 *   POST /api/2fa/totp/setup      generate secret + QR code URI
 *   POST /api/2fa/totp/verify     verify token and enable TOTP
 *   POST /api/2fa/totp/disable    disable TOTP
 *   POST /api/2fa/email/send      send email OTP
 *   POST /api/2fa/email/verify    verify email OTP
 *   GET  /api/2fa/status          current 2FA status for user
 */
export class TwoFAController {
  static async totpSetup(req, res, next) {
    try {
      const userId = req.user.id;
      const email = req.user.email;

      const secret = speakeasy.generateSecret({
        name: `${APP_NAME} (${email})`,
        issuer: APP_NAME,
        length: 32,
      });

      // Store secret (unconfirmed) in Firestore
      await db.collection('user_2fa').doc(userId).set({
        totpSecret: secret.base32,
        totpEnabled: false,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      const qrDataUrl = await QRCode.toDataURL(secret.otpauth_url);

      res.json({
        success: true,
        secret: secret.base32,
        qrCodeDataUrl: qrDataUrl,
        manualEntryKey: secret.base32,
      });
    } catch (error) {
      logger.error('TOTP setup error:', error);
      next(error);
    }
  }

  static async totpVerify(req, res, next) {
    try {
      const userId = req.user.id;
      const { token } = req.body;

      const snap = await db.collection('user_2fa').doc(userId).get();
      if (!snap.exists || !snap.data().totpSecret) {
        return res.status(400).json({ success: false, error: 'TOTP not set up. Call /api/2fa/totp/setup first.' });
      }

      const { totpSecret } = snap.data();
      const verified = speakeasy.totp.verify({
        secret: totpSecret,
        encoding: 'base32',
        token: String(token).replace(/\s/g, ''),
        window: 2,
      });

      if (!verified) {
        return res.status(400).json({ success: false, error: 'Invalid or expired token. Please try again.' });
      }

      // Generate backup codes (one-time use)
      const backupCodes = Array.from({ length: 8 }, () =>
        crypto.randomBytes(4).toString('hex').toUpperCase()
      );

      await db.collection('user_2fa').doc(userId).set({
        totpEnabled: true,
        backupCodes: backupCodes.map((c) => ({ code: c, used: false })),
        totpEnabledAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      await db.collection('users').doc(userId).update({ twoFactorEnabled: true, twoFactorMethod: 'totp' });

      logger.info(`TOTP enabled for user ${userId}`);
      res.json({ success: true, message: 'TOTP authenticator enabled.', backupCodes });
    } catch (error) {
      logger.error('TOTP verify error:', error);
      next(error);
    }
  }

  static async totpDisable(req, res, next) {
    try {
      const userId = req.user.id;
      const { token } = req.body;

      const snap = await db.collection('user_2fa').doc(userId).get();
      if (!snap.exists || !snap.data().totpEnabled) {
        return res.status(400).json({ success: false, error: 'TOTP is not currently enabled.' });
      }

      const verified = speakeasy.totp.verify({
        secret: snap.data().totpSecret,
        encoding: 'base32',
        token: String(token).replace(/\s/g, ''),
        window: 2,
      });

      if (!verified) {
        return res.status(400).json({ success: false, error: 'Invalid token.' });
      }

      await db.collection('user_2fa').doc(userId).update({
        totpEnabled: false,
        totpSecret: null,
        backupCodes: [],
        updatedAt: new Date().toISOString(),
      });

      await db.collection('users').doc(userId).update({ twoFactorEnabled: false, twoFactorMethod: null });

      logger.info(`TOTP disabled for user ${userId}`);
      res.json({ success: true, message: 'TOTP authenticator disabled.' });
    } catch (error) {
      logger.error('TOTP disable error:', error);
      next(error);
    }
  }

  static async emailOtpSend(req, res, next) {
    try {
      const userId = req.user.id;
      const email = req.user.email;
      const fullName = req.user.fullName || req.user.metadata?.fullName || null;

      const otp = String(Math.floor(100000 + Math.random() * 900000));
      const expiresAt = new Date(Date.now() + EMAIL_OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();

      await db.collection('user_2fa').doc(userId).set({
        emailOtp: otp,
        emailOtpExpiresAt: expiresAt,
        emailOtpAttempts: 0,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      // Send OTP email
      try {
        await emailService.sendTwoFactorVerificationCode({
          email,
          fullName,
          verificationCode: otp,
          expiresInMinutes: EMAIL_OTP_EXPIRY_MINUTES,
        });
      } catch (emailErr) {
        logger.warn('Failed to send 2FA email OTP:', emailErr);
        logger.debug(`[DEV] Email OTP for ${email}: ${otp}`);
      }

      res.json({ success: true, message: `Verification code sent to ${email}` });
    } catch (error) {
      logger.error('Email OTP send error:', error);
      next(error);
    }
  }

  static async emailOtpVerify(req, res, next) {
    try {
      const userId = req.user.id;
      const { otp } = req.body;

      const snap = await db.collection('user_2fa').doc(userId).get();
      if (!snap.exists || !snap.data().emailOtp) {
        return res.status(400).json({ success: false, error: 'No OTP pending. Request a new code first.' });
      }

      const { emailOtp, emailOtpExpiresAt, emailOtpAttempts = 0 } = snap.data();

      if (emailOtpAttempts >= 5) {
        return res.status(429).json({ success: false, error: 'Too many attempts. Request a new code.' });
      }

      if (new Date(emailOtpExpiresAt) < new Date()) {
        return res.status(400).json({ success: false, error: 'Code has expired. Request a new one.' });
      }

      if (String(otp) !== String(emailOtp)) {
        await db.collection('user_2fa').doc(userId).update({
          emailOtpAttempts: emailOtpAttempts + 1,
        });
        return res.status(400).json({ success: false, error: 'Invalid code.' });
      }

      // Clear OTP and enable email 2FA
      await db.collection('user_2fa').doc(userId).update({
        emailOtp: null,
        emailOtpExpiresAt: null,
        emailOtpAttempts: 0,
        emailOtpEnabled: true,
        updatedAt: new Date().toISOString(),
      });

      await db.collection('users').doc(userId).update({ twoFactorEnabled: true, twoFactorMethod: 'email' });

      res.json({ success: true, message: 'Email OTP verified. Two-factor authentication enabled.' });
    } catch (error) {
      logger.error('Email OTP verify error:', error);
      next(error);
    }
  }

  static async getStatus(req, res, next) {
    try {
      const userId = req.user.id;

      const snap = await db.collection('user_2fa').doc(userId).get();
      const data = snap.exists ? snap.data() : {};

      res.json({
        success: true,
        twoFaEnabled: Boolean(data.totpEnabled || data.emailOtpEnabled),
        totpEnabled: Boolean(data.totpEnabled),
        emailOtpEnabled: Boolean(data.emailOtpEnabled),
        method: data.totpEnabled ? 'totp' : data.emailOtpEnabled ? 'email' : null,
        backupCodesRemaining: (data.backupCodes || []).filter((c) => !c.used).length,
      });
    } catch (error) {
      logger.error('2FA status error:', error);
      next(error);
    }
  }

  static async useBackupCode(req, res, next) {
    try {
      const userId = req.user.id;
      const { code } = req.body;

      const snap = await db.collection('user_2fa').doc(userId).get();
      if (!snap.exists) {
        return res.status(400).json({ success: false, error: '2FA not configured.' });
      }

      const { backupCodes = [] } = snap.data();
      const idx = backupCodes.findIndex((c) => c.code === String(code).toUpperCase() && !c.used);

      if (idx === -1) {
        return res.status(400).json({ success: false, error: 'Invalid or already used backup code.' });
      }

      backupCodes[idx].used = true;
      backupCodes[idx].usedAt = new Date().toISOString();

      await db.collection('user_2fa').doc(userId).update({ backupCodes, updatedAt: new Date().toISOString() });

      res.json({ success: true, message: 'Backup code accepted.', remaining: backupCodes.filter((c) => !c.used).length });
    } catch (error) {
      logger.error('Backup code error:', error);
      next(error);
    }
  }
}
