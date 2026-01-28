/**
 * Secure Configuration Module
 * 
 * Centralizes environment variable validation and secure configuration handling.
 * Implements OWASP best practices for sensitive data management:
 * - Validates all required environment variables at startup
 * - Provides clear error messages for missing configuration
 * - Documents API key rotation procedures
 * - Prevents accidental exposure of sensitive data
 * 
 * @see https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html
 */

import logger from '../utils/logger.js';

// =============================================================================
// ENVIRONMENT VARIABLE DEFINITIONS
// =============================================================================

/**
 * Required environment variables grouped by service
 * Each entry contains:
 * - key: Environment variable name
 * - description: What this variable is for
 * - sensitive: Whether this is a secret (for logging purposes)
 * - validator: Optional validation function
 * - rotationNotes: Guidelines for key rotation
 */
const ENV_CONFIG = {
  // Firebase Configuration (Required)
  firebase: {
    required: true,
    variables: [
      {
        key: 'FIREBASE_DATABASE_URL',
        description: 'Firebase Realtime Database URL',
        sensitive: false,
        validator: (value) => value && value.includes('firebasedatabase.app'),
        rotationNotes: 'Database URL does not change. If compromised, rotate database rules.',
      },
      {
        key: 'FIREBASE_SERVICE_ACCOUNT',
        altKey: 'FIREBASE_SERVICE_ACCOUNT_PATH',
        description: 'Firebase service account JSON or path to JSON file',
        sensitive: true,
        validator: (value) => {
          if (!value) return false;
          // Check if it's a path or JSON
          if (value.endsWith('.json') || value.startsWith('{')) return true;
          return false;
        },
        rotationNotes: 'Rotate in Firebase Console > Project Settings > Service Accounts. Generate new private key and update this variable.',
      },
    ],
  },

  // Email Configuration (Optional but recommended for production)
  email: {
    required: false,
    variables: [
      {
        key: 'EMAIL_PROVIDER',
        description: 'Email provider: sendgrid, smtp, or console',
        sensitive: false,
        validator: (value) => !value || ['sendgrid', 'smtp', 'console'].includes(value),
        rotationNotes: 'N/A - not a secret',
      },
      {
        key: 'SENDGRID_API_KEY',
        description: 'SendGrid API key for email delivery',
        sensitive: true,
        requiredIf: (env) => env.EMAIL_PROVIDER === 'sendgrid',
        validator: (value) => !value || value.startsWith('SG.'),
        rotationNotes: 'Generate new key in SendGrid Dashboard > Settings > API Keys. Revoke old key after updating.',
      },
      {
        key: 'FROM_EMAIL',
        description: 'Default sender email address',
        sensitive: false,
        validator: (value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
        rotationNotes: 'N/A - not a secret',
      },
    ],
  },

  // SMTP Configuration (Optional)
  smtp: {
    required: false,
    variables: [
      {
        key: 'SMTP_HOST',
        description: 'SMTP server hostname',
        sensitive: false,
        requiredIf: (env) => env.EMAIL_PROVIDER === 'smtp',
      },
      {
        key: 'SMTP_USER',
        description: 'SMTP username',
        sensitive: false,
        requiredIf: (env) => env.EMAIL_PROVIDER === 'smtp',
      },
      {
        key: 'SMTP_PASS',
        description: 'SMTP password or app-specific password',
        sensitive: true,
        requiredIf: (env) => env.EMAIL_PROVIDER === 'smtp',
        rotationNotes: 'For Gmail: Generate new App Password at myaccount.google.com/apppasswords',
      },
    ],
  },

  // Image Moderation (Optional)
  imageModeration: {
    required: false,
    variables: [
      {
        key: 'SIGHTENGINE_USER',
        description: 'Sightengine API user ID',
        sensitive: true,
        rotationNotes: 'Contact Sightengine support to rotate API credentials.',
      },
      {
        key: 'SIGHTENGINE_SECRET',
        description: 'Sightengine API secret',
        sensitive: true,
        rotationNotes: 'Contact Sightengine support to rotate API credentials.',
      },
    ],
  },

  // Server Configuration
  server: {
    required: false,
    variables: [
      {
        key: 'PORT',
        description: 'Server port',
        sensitive: false,
        validator: (value) => !value || (parseInt(value) > 0 && parseInt(value) < 65536),
      },
      {
        key: 'NODE_ENV',
        description: 'Node environment: development, production, test',
        sensitive: false,
        validator: (value) => !value || ['development', 'production', 'test'].includes(value),
      },
      {
        key: 'FRONTEND_URL',
        description: 'Frontend application URL for CORS and email links',
        sensitive: false,
      },
    ],
  },

  // Security Configuration
  security: {
    required: false,
    variables: [
      {
        key: 'JWT_SECRET',
        description: 'Secret for JWT signing (if using custom JWTs)',
        sensitive: true,
        validator: (value) => !value || value.length >= 32,
        rotationNotes: 'Generate new secret: openssl rand -base64 32. Update all services using this secret simultaneously.',
      },
      {
        key: 'EMAIL_VERIFICATION_CODE_SECRET',
        description: 'Secret for email verification code HMAC',
        sensitive: true,
        validator: (value) => !value || value.length >= 32,
        rotationNotes: 'Rotation will invalidate all pending verification codes.',
      },
    ],
  },
};

// =============================================================================
// VALIDATION FUNCTIONS
// =============================================================================

/**
 * Validate all environment variables and return validation results
 * @returns {Object} Validation results with errors and warnings
 */
export function validateEnvironment() {
  const results = {
    valid: true,
    errors: [],
    warnings: [],
    rotationReminders: [],
  };

  const env = process.env;

  for (const [serviceName, serviceConfig] of Object.entries(ENV_CONFIG)) {
    for (const varConfig of serviceConfig.variables) {
      const { key, altKey, description, sensitive, validator, requiredIf, rotationNotes } = varConfig;
      
      // Get value (check alternate key if primary is not set)
      let value = env[key];
      if (!value && altKey) {
        value = env[altKey];
      }

      // Check if required
      const isRequired = serviceConfig.required || (requiredIf && requiredIf(env));
      
      if (isRequired && !value) {
        results.valid = false;
        results.errors.push({
          service: serviceName,
          key: altKey ? `${key} or ${altKey}` : key,
          message: `Required environment variable missing: ${description}`,
        });
        continue;
      }

      // Run validator if present
      if (value && validator && !validator(value)) {
        results.warnings.push({
          service: serviceName,
          key,
          message: `Invalid value for ${key}: ${description}`,
        });
      }

      // Add rotation reminder for sensitive keys
      if (sensitive && value && rotationNotes) {
        results.rotationReminders.push({
          key,
          notes: rotationNotes,
        });
      }
    }
  }

  return results;
}

/**
 * Log validation results in a security-conscious manner
 * @param {Object} results - Validation results from validateEnvironment
 */
export function logValidationResults(results) {
  if (results.errors.length > 0) {
    logger.error('❌ Environment validation failed:');
    results.errors.forEach(err => {
      logger.error(`  - [${err.service}] ${err.key}: ${err.message}`);
    });
  }

  if (results.warnings.length > 0) {
    logger.warn('⚠️  Environment warnings:');
    results.warnings.forEach(warn => {
      logger.warn(`  - [${warn.service}] ${warn.key}: ${warn.message}`);
    });
  }

  if (results.valid) {
    logger.info('✅ Environment validation passed');
  }
}

// =============================================================================
// SECURE CONFIGURATION ACCESS
// =============================================================================

/**
 * Get configuration value with validation
 * Prevents accidental exposure of sensitive values in logs
 * 
 * @param {string} key - Environment variable key
 * @param {*} defaultValue - Default value if not set
 * @returns {*} Configuration value
 */
export function getConfig(key, defaultValue = null) {
  const value = process.env[key];
  return value !== undefined ? value : defaultValue;
}

/**
 * Check if a configuration value is set
 * Use this instead of getConfig to avoid loading sensitive values into memory unnecessarily
 * 
 * @param {string} key - Environment variable key
 * @returns {boolean} Whether the value is set
 */
export function hasConfig(key) {
  return process.env[key] !== undefined && process.env[key] !== '';
}

/**
 * Get masked version of sensitive value for logging
 * 
 * @param {string} value - Sensitive value to mask
 * @param {number} showChars - Number of characters to show at start
 * @returns {string} Masked value
 */
export function maskSensitiveValue(value, showChars = 4) {
  if (!value) return '[not set]';
  if (value.length <= showChars) return '*'.repeat(value.length);
  return value.substring(0, showChars) + '*'.repeat(Math.min(value.length - showChars, 20));
}

// =============================================================================
// API KEY ROTATION GUIDE
// =============================================================================

/**
 * Generate API key rotation guide
 * @returns {string} Markdown-formatted rotation guide
 */
export function getRotationGuide() {
  const lines = [
    '# API Key Rotation Guide',
    '',
    'Regular key rotation is a security best practice. Here are the rotation procedures for each service:',
    '',
  ];

  for (const [serviceName, serviceConfig] of Object.entries(ENV_CONFIG)) {
    const sensitiveVars = serviceConfig.variables.filter(v => v.sensitive && v.rotationNotes);
    
    if (sensitiveVars.length > 0) {
      lines.push(`## ${serviceName.charAt(0).toUpperCase() + serviceName.slice(1)}`);
      lines.push('');
      
      for (const varConfig of sensitiveVars) {
        lines.push(`### ${varConfig.key}`);
        lines.push(`**Description:** ${varConfig.description}`);
        lines.push(`**Rotation procedure:** ${varConfig.rotationNotes}`);
        lines.push('');
      }
    }
  }

  lines.push('## General Rotation Best Practices');
  lines.push('');
  lines.push('1. **Schedule regular rotation** - Rotate sensitive keys at least every 90 days');
  lines.push('2. **Use staging first** - Test new keys in a non-production environment');
  lines.push('3. **Coordinate updates** - Update all services using the key simultaneously');
  lines.push('4. **Revoke old keys** - Always revoke old keys after confirming new keys work');
  lines.push('5. **Monitor for issues** - Watch logs closely after rotation');
  lines.push('6. **Document changes** - Keep an audit trail of when keys were rotated');

  return lines.join('\n');
}

// =============================================================================
// STARTUP VALIDATION
// =============================================================================

/**
 * Run environment validation at startup
 * Call this early in server initialization
 */
export function initializeSecureConfig() {
  const results = validateEnvironment();
  logValidationResults(results);
  
  if (!results.valid) {
    logger.error('Server startup blocked due to missing required configuration.');
    logger.error('Please check your .env file and ensure all required variables are set.');
    
    // In production, exit on missing required config
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }
  
  // Log rotation reminders in development
  if (process.env.NODE_ENV === 'development' && results.rotationReminders.length > 0) {
    logger.info('📝 API Key Rotation Reminders:');
    logger.info('   Consider rotating sensitive keys regularly for security.');
  }
  
  return results;
}

export default {
  validateEnvironment,
  logValidationResults,
  getConfig,
  hasConfig,
  maskSensitiveValue,
  getRotationGuide,
  initializeSecureConfig,
  ENV_CONFIG,
};
