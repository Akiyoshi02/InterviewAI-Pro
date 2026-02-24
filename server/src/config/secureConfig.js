/**
 * Secure Configuration Validation
 * Validates required environment variables and configuration
 */

import logger from '../utils/logger.js';

const REQUIRED_ENV_VARS = [
  'NODE_ENV',
  'PORT',
  'FIREBASE_PROJECT_ID',
  'JWT_SECRET',
];

const OPTIONAL_ENV_VARS = [
  'FIREBASE_SERVICE_ACCOUNT_PATH',
  'FIREBASE_PRIVATE_KEY',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_DATABASE_URL',
  'FIREBASE_STORAGE_BUCKET',
  'OLLAMA_BASE_URL',
  'OLLAMA_MODEL',
  'WHISPER_BASE_URL',
  'SENDGRID_API_KEY',
  'SENDGRID_FROM_EMAIL',
  'SIGHTENGINE_API_USER',
  'SIGHTENGINE_API_SECRET',
  'FRONTEND_URL',
  'CORS_ORIGIN',
];

/**
 * Validate required environment variables
 */
function validateRequiredEnvVars() {
  const missing = [];
  
  for (const varName of REQUIRED_ENV_VARS) {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }
  
  if (missing.length > 0) {
    logger.error('Missing required environment variables:', missing);
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

/**
 * Validate Firebase configuration
 */
function validateFirebaseConfig() {
  const hasServiceAccountPath = !!process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  const hasEnvCredentials = !!(process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL);
  
  if (!hasServiceAccountPath && !hasEnvCredentials) {
    logger.warn('No Firebase credentials found. Will attempt to use application default credentials.');
  }
  
  if (!process.env.FIREBASE_PROJECT_ID) {
    throw new Error('FIREBASE_PROJECT_ID is required');
  }
}

/**
 * Validate security configuration
 */
function validateSecurityConfig() {
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
      throw new Error('JWT_SECRET must be at least 32 characters in production');
    }
    
    if (!process.env.CORS_ORIGIN) {
      logger.warn('CORS_ORIGIN not set in production. Using FRONTEND_URL or wildcard.');
    }
  }
}

/**
 * Log configuration status
 */
function logConfigStatus() {
  logger.info('Configuration loaded:', {
    nodeEnv: process.env.NODE_ENV,
    port: process.env.PORT,
    firebaseProject: process.env.FIREBASE_PROJECT_ID,
    ollamaConfigured: !!process.env.OLLAMA_BASE_URL,
    whisperConfigured: !!process.env.WHISPER_BASE_URL,
    sendgridConfigured: !!process.env.SENDGRID_API_KEY,
    sightengineConfigured: !!(process.env.SIGHTENGINE_API_USER && process.env.SIGHTENGINE_API_SECRET),
  });
}

/**
 * Initialize and validate secure configuration
 */
export function initializeSecureConfig() {
  try {
    logger.info('Validating configuration...');
    
    validateRequiredEnvVars();
    validateFirebaseConfig();
    validateSecurityConfig();
    logConfigStatus();
    
    logger.info('✅ Configuration validated successfully');
    return true;
  } catch (error) {
    logger.error('❌ Configuration validation failed:', error.message);
    throw error;
  }
}

export default {
  initializeSecureConfig,
};
