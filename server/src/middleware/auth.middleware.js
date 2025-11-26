import { verifyFirebaseToken } from '../config/firebase.js';
import { userStore } from '../services/firebaseData.service.js';
import logger from '../utils/logger.js';

/**
 * Middleware to verify Firebase authentication token
 */
export async function verifyFirebaseAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split('Bearer ')[1];
    
    const userData = await verifyFirebaseToken(token);
    
    if (!userData) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    req.user = {
      uid: userData.uid,
      email: userData.email,
      emailVerified: userData.emailVerified,
      metadata: userData.metadata,
    };

    next();
  } catch (error) {
    logger.error('Auth middleware error:', error);
    return res.status(500).json({ error: 'Authentication error' });
  }
}


/**
 * Middleware to load user from database after token verification
 */
export async function loadUser(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const user = await userStore.getByUid(req.user.uid);

    if (!user) {
      return res.status(404).json({ error: 'User not found in database' });
    }

    req.user = {
      ...req.user,
      id: user.id,
      accountType: user.accountType,
      fullName: user.fullName,
      profile: user,
    };

    next();
  } catch (error) {
    logger.error('Load user error:', error);
    return res.status(500).json({ error: 'Failed to load user' });
  }
}

/**
 * Middleware to check if user is a candidate
 */
export function requireCandidate(req, res, next) {
  if (req.user.accountType !== 'CANDIDATE') {
    return res.status(403).json({ error: 'Candidate access required' });
  }
  next();
}

/**
 * Middleware to check if user is a company
 */
export function requireCompany(req, res, next) {
  if (req.user.accountType !== 'COMPANY') {
    return res.status(403).json({ error: 'Company access required' });
  }
  next();
}

/**
 * Combined auth middleware
 */
export const authenticate = [verifyFirebaseAuth, loadUser];
