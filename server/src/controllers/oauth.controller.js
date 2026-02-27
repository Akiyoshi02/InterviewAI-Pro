/**
 * OAuth callbacks for LinkedIn and GitHub.
 *
 * Flow:
 *  1. Frontend redirects user to provider (LinkedIn/GitHub authorization URL)
 *  2. Provider redirects back to /api/oauth/:provider/callback?code=...&state=...
 *  3. Backend exchanges code for access token
 *  4. Backend fetches user profile from provider
 *  5. Backend upserts user in Firebase Auth / Firestore
 *  6. Backend returns a short-lived session token and redirects to frontend
 *
 * Environment variables required:
 *  - LINKEDIN_CLIENT_ID / LINKEDIN_CLIENT_SECRET
 *  - GITHUB_CLIENT_ID   / GITHUB_CLIENT_SECRET
 *  - FRONTEND_URL
 */

import { firestore as db, auth as adminAuth } from '../config/firebase.js';
import logger from '../utils/logger.js';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const SERVER_URL = process.env.SERVER_URL || `http://localhost:${process.env.PORT || 3000}`;

const requireOAuthConfig = (provider) => {
  if (provider === 'linkedin') {
    if (!process.env.LINKEDIN_CLIENT_ID || !process.env.LINKEDIN_CLIENT_SECRET) {
      throw new Error('LinkedIn OAuth is not configured.');
    }
  }

  if (provider === 'github') {
    if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
      throw new Error('GitHub OAuth is not configured.');
    }
  }
};

async function upsertOAuthUser({ provider, providerUserId, email, fullName, avatarUrl }) {
  const usersRef = db.collection('users');

  // Look up by provider+id first
  const existingSnap = await usersRef
    .where(`oauth.${provider}.id`, '==', providerUserId)
    .limit(1)
    .get();

  if (!existingSnap.empty) {
    const doc = existingSnap.docs[0];
    await doc.ref.update({ lastLoginAt: new Date().toISOString(), [`oauth.${provider}.lastUsed`]: new Date().toISOString() });
    return { uid: doc.id, isNew: false };
  }

  // Try email match
  if (email) {
    const emailSnap = await usersRef.where('email', '==', email).limit(1).get();
    if (!emailSnap.empty) {
      const doc = emailSnap.docs[0];
      await doc.ref.update({
        [`oauth.${provider}`]: { id: providerUserId, linkedAt: new Date().toISOString() },
        lastLoginAt: new Date().toISOString(),
      });
      return { uid: doc.id, isNew: false };
    }
  }

  // Create new user
  let firebaseUser;
  try {
    firebaseUser = await adminAuth.createUser({
      email: email || `${provider}-${providerUserId}@oauth.local`,
      displayName: fullName || email || provider,
      photoURL: avatarUrl || null,
      emailVerified: Boolean(email),
    });
  } catch (err) {
    if (err.code === 'auth/email-already-exists') {
      firebaseUser = await adminAuth.getUserByEmail(email);
    } else {
      throw err;
    }
  }

  await usersRef.doc(firebaseUser.uid).set({
    email: email || null,
    fullName: fullName || email || provider,
    avatarUrl: avatarUrl || null,
    accountType: 'CANDIDATE',
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
    emailVerified: Boolean(email),
    [`oauth.${provider}`]: { id: providerUserId, linkedAt: new Date().toISOString() },
  });

  return { uid: firebaseUser.uid, isNew: true };
}

export class OAuthController {
  // ── LinkedIn ────────────────────────────────────────────────────────────

  static async linkedinCallback(req, res) {
    const { code, state, error } = req.query;

    if (error) {
      return res.redirect(`${FRONTEND_URL}/login?oauth_error=${encodeURIComponent(error)}`);
    }

    if (!code) {
      return res.redirect(`${FRONTEND_URL}/login?oauth_error=no_code`);
    }

    try {
      requireOAuthConfig('linkedin');

      // Exchange code for access token
      const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: `${SERVER_URL}/api/oauth/linkedin/callback`,
          client_id: process.env.LINKEDIN_CLIENT_ID,
          client_secret: process.env.LINKEDIN_CLIENT_SECRET,
        }),
      });

      const tokenData = await tokenRes.json();
      if (!tokenData.access_token) {
        throw new Error(tokenData.error_description || 'Token exchange failed');
      }

      // Fetch profile
      const profileRes = await fetch('https://api.linkedin.com/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const profile = await profileRes.json();

      const { uid } = await upsertOAuthUser({
        provider: 'linkedin',
        providerUserId: profile.sub,
        email: profile.email,
        fullName: profile.name,
        avatarUrl: profile.picture,
      });

      // Create a Firebase custom token the frontend can sign in with
      const customToken = await adminAuth.createCustomToken(uid, { provider: 'linkedin' });

      logger.info(`LinkedIn OAuth: user ${uid} authenticated`);
      res.redirect(`${FRONTEND_URL}/oauth/callback?token=${encodeURIComponent(customToken)}&provider=linkedin`);
    } catch (err) {
      logger.error('LinkedIn OAuth callback error:', err);
      res.redirect(`${FRONTEND_URL}/login?oauth_error=${encodeURIComponent(err.message)}`);
    }
  }

  // ── GitHub ──────────────────────────────────────────────────────────────

  static async githubCallback(req, res) {
    const { code, error } = req.query;

    if (error) {
      return res.redirect(`${FRONTEND_URL}/login?oauth_error=${encodeURIComponent(error)}`);
    }

    if (!code) {
      return res.redirect(`${FRONTEND_URL}/login?oauth_error=no_code`);
    }

    try {
      requireOAuthConfig('github');

      // Exchange code for access token
      const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          client_id: process.env.GITHUB_CLIENT_ID,
          client_secret: process.env.GITHUB_CLIENT_SECRET,
          code,
          redirect_uri: `${SERVER_URL}/api/oauth/github/callback`,
        }),
      });

      const tokenData = await tokenRes.json();
      if (!tokenData.access_token) {
        throw new Error(tokenData.error_description || 'Token exchange failed');
      }

      // Fetch user profile
      const [profileRes, emailsRes] = await Promise.all([
        fetch('https://api.github.com/user', {
          headers: { Authorization: `Bearer ${tokenData.access_token}`, Accept: 'application/vnd.github+json' },
        }),
        fetch('https://api.github.com/user/emails', {
          headers: { Authorization: `Bearer ${tokenData.access_token}`, Accept: 'application/vnd.github+json' },
        }),
      ]);

      const profile = await profileRes.json();
      const emails = await emailsRes.json().catch(() => []);

      const primaryEmail = Array.isArray(emails)
        ? (emails.find((e) => e.primary && e.verified)?.email || emails[0]?.email)
        : profile.email;

      const { uid } = await upsertOAuthUser({
        provider: 'github',
        providerUserId: String(profile.id),
        email: primaryEmail,
        fullName: profile.name || profile.login,
        avatarUrl: profile.avatar_url,
      });

      const customToken = await adminAuth.createCustomToken(uid, { provider: 'github' });

      logger.info(`GitHub OAuth: user ${uid} authenticated`);
      res.redirect(`${FRONTEND_URL}/oauth/callback?token=${encodeURIComponent(customToken)}&provider=github`);
    } catch (err) {
      logger.error('GitHub OAuth callback error:', err);
      res.redirect(`${FRONTEND_URL}/login?oauth_error=${encodeURIComponent(err.message)}`);
    }
  }
}


