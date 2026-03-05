/**
 * Firebase Admin SDK Configuration
 * Initializes Firebase Admin for Firestore, Auth, and Realtime Database
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { resolve, dirname, isAbsolute } from 'path';
import { fileURLToPath } from 'url';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let firebaseInitialized = false;

try {
  // Try to load service account key
  const configuredServiceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  const serviceAccountPath = configuredServiceAccountPath
    ? (
        isAbsolute(configuredServiceAccountPath)
          ? configuredServiceAccountPath
          : resolve(__dirname, '../../', configuredServiceAccountPath)
      )
    : resolve(__dirname, '../../../firebase-service-account.json');
  
  let credential;
  
  try {
    const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
    credential = admin.credential.cert(serviceAccount);
    logger.info('Firebase initialized with service account file');
  } catch (fileError) {
    // Fallback to environment variables
    if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
      credential = admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      });
      logger.info('Firebase initialized with environment variables');
    } else {
      // Use application default credentials
      credential = admin.credential.applicationDefault();
      logger.info('Firebase initialized with application default credentials');
    }
  }

  admin.initializeApp({
    credential,
    databaseURL: process.env.FIREBASE_DATABASE_URL || 
                 `https://${process.env.FIREBASE_PROJECT_ID}-default-rtdb.firebaseio.com`,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 
                   `${process.env.FIREBASE_PROJECT_ID}.appspot.com`,
  });

  firebaseInitialized = true;
  logger.info('Firebase Admin SDK initialized successfully');
} catch (error) {
  logger.error('Firebase initialization error:', error);
  throw new Error('Failed to initialize Firebase Admin SDK');
}

// Export firestore and realtimeDb instances
export const firestore = admin.firestore();
export const realtimeDb = admin.database();
export const auth = admin.auth();
export const storage = admin.storage();

// Set Firestore settings
firestore.settings({
  ignoreUndefinedProperties: true,
});

/**
 * Verify Firebase ID token
 * @param {string} token - Firebase ID token
 * @returns {Promise<Object|null>} - Decoded token data or null if invalid
 */
export async function verifyFirebaseToken(token) {
  try {
    if (!token) {
      return null;
    }
    
    const decodedToken = await auth.verifyIdToken(token);
    return {
      uid: decodedToken.uid,
      email: decodedToken.email,
      emailVerified: decodedToken.email_verified,
      ...decodedToken,
    };
  } catch (error) {
    logger.error('Token verification error:', error.message);
    return null;
  }
}

/**
 * Delete a Firebase user
 * @param {string} uid - User ID to delete
 * @returns {Promise<void>}
 */
export async function deleteFirebaseUser(uid) {
  try {
    if (!uid) {
      throw new Error('User ID is required');
    }
    
    await auth.deleteUser(uid);
    logger.info(`Firebase user deleted: ${uid}`);
  } catch (error) {
    logger.error(`Failed to delete Firebase user ${uid}:`, error.message);
    throw error;
  }
}

export default admin;
