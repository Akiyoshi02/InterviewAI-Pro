// Import env loader first to ensure .env is loaded
import '../config/env.js';

import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import logger from '../utils/logger.js';

// Get current directory (for resolving relative paths)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Get server root directory (go up from src/config to server/)
const serverRoot = resolve(__dirname, '../..');

// Get Firebase service account from environment
let serviceAccount;
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
const databaseURL = process.env.FIREBASE_DATABASE_URL;

if (!databaseURL) {
  throw new Error(`
❌ Missing Firebase Realtime Database URL

Please set FIREBASE_DATABASE_URL in server/.env (e.g., https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com)

This project relies on Firebase Realtime Database for live interview state sync.
  `.trim());
}

if (serviceAccountPath) {
  // Option 1: Load from file path
  try {
    // Resolve path relative to server root, or use absolute path
    const resolvedPath = serviceAccountPath.startsWith('/') || serviceAccountPath.match(/^[A-Z]:/) 
      ? serviceAccountPath 
      : resolve(serverRoot, serviceAccountPath);
    
    logger.info(`Loading Firebase service account from: ${resolvedPath}`);
    const fileContents = readFileSync(resolvedPath, 'utf8');
    serviceAccount = JSON.parse(fileContents);
    
    // Validate that it has required fields
    if (!serviceAccount.project_id || !serviceAccount.private_key) {
      throw new Error('Service account JSON is missing required fields (project_id or private_key)');
    }
  } catch (error) {
    logger.error('Failed to load Firebase service account from file:', error);
    throw new Error(`Failed to load Firebase service account from path: ${serviceAccountPath}\nError: ${error.message}`);
  }
} else if (serviceAccountJson) {
  // Option 2: Parse from JSON string
  try {
    let jsonString = typeof serviceAccountJson === 'string' 
      ? serviceAccountJson 
      : JSON.stringify(serviceAccountJson);
    
    // Clean up common .env file issues:
    // 1. Remove outer quotes if present (single or double)
    jsonString = jsonString.trim();
    if ((jsonString.startsWith('"') && jsonString.endsWith('"')) ||
        (jsonString.startsWith("'") && jsonString.endsWith("'"))) {
      jsonString = jsonString.slice(1, -1);
    }
    
    // 2. Unescape escaped quotes and newlines
    jsonString = jsonString.replace(/\\"/g, '"').replace(/\\n/g, '\n');
    
    serviceAccount = JSON.parse(jsonString);
    
    // Validate that it has required fields
    if (!serviceAccount.project_id || !serviceAccount.private_key) {
      throw new Error('Service account JSON is missing required fields (project_id or private_key)');
    }
  } catch (error) {
    logger.error('Failed to parse Firebase service account JSON:', error);
    const preview = serviceAccountJson?.substring(0, 100) || 'empty';
    throw new Error(`
Failed to parse FIREBASE_SERVICE_ACCOUNT. 

Error: ${error.message}
Received (first 100 chars): ${preview}...

Troubleshooting:
1. Make sure the JSON is on a single line in your .env file
2. Escape all quotes inside the JSON: \\" instead of "
3. Replace all actual newlines with \\n
4. Or use FIREBASE_SERVICE_ACCOUNT_PATH instead (recommended - easier!)

Example .env format:
FIREBASE_SERVICE_ACCOUNT='{"type":"service_account","project_id":"my-project",...}'

Or use file path (easier!):
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json
    `.trim());
  }
} else {
  throw new Error(`
❌ Missing Firebase service account configuration

Please set ONE of these environment variables in server/.env:

Option 1 (Recommended): JSON string
FIREBASE_SERVICE_ACCOUNT='{"type":"service_account","project_id":"...","private_key":"..."}'

Option 2: File path
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json

Get your service account key from: Firebase Console > Project Settings > Service Accounts
  `.trim());
}

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL,
    });
    logger.info('Firebase Admin initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize Firebase Admin:', error);
    throw error;
  }
}

/**
 * Verify Firebase ID token
 * @param {string} token - Firebase ID token from client
 * @returns {Promise<Object|null>} Decoded user data or null
 */
export async function verifyFirebaseToken(token) {
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    return {
      uid: decodedToken.uid,
      email: decodedToken.email,
      emailVerified: decodedToken.email_verified || false,
      metadata: {
        fullName: decodedToken.name || null,
        ...decodedToken
      }
    };
  } catch (error) {
    logger.error('Token verification error:', error);
    return null;
  }
}

/**
 * Delete a user from Firebase Auth
 * @param {string} userId - Firebase user ID (uid)
 * @returns {Promise<boolean>} Success status
 */
export async function deleteFirebaseUser(userId) {
  try {
    await admin.auth().deleteUser(userId);
    logger.info(`Successfully deleted Firebase user: ${userId}`);
    return true;
  } catch (error) {
    logger.error(`Failed to delete Firebase user ${userId}:`, error);
    return false;
  }
}

/**
 * Get user by ID
 * @param {string} userId - Firebase user ID (uid)
 * @returns {Promise<Object|null>} User record or null
 */
export async function getFirebaseUser(userId) {
  try {
    const userRecord = await admin.auth().getUser(userId);
    return {
      uid: userRecord.uid,
      email: userRecord.email,
      emailVerified: userRecord.emailVerified,
      metadata: userRecord.customClaims || {}
    };
  } catch (error) {
    logger.error(`Failed to get Firebase user ${userId}:`, error);
    return null;
  }
}

export const firestore = admin.firestore();
export const realtimeDb = admin.database();

export default admin;

