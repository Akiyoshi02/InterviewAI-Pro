/**
 * Enhanced Rate Limiting Middleware
 * 
 * Implements OWASP best practices for rate limiting:
 * - IP-based rate limiting for unauthenticated requests
 * - User-based rate limiting for authenticated requests
 * - Endpoint-specific limits based on sensitivity
 * - Graceful 429 responses with retry information
 * - Sliding window algorithm for accurate rate limiting
 * 
 * @see https://cheatsheetseries.owasp.org/cheatsheets/Denial_of_Service_Cheat_Sheet.html
 */

import rateLimit from 'express-rate-limit';
import logger from '../utils/logger.js';

// =============================================================================
// CONFIGURATION CONSTANTS
// =============================================================================

/**
 * Rate limit configurations by endpoint type
 * Values are based on OWASP recommendations and practical usage patterns
 */
const RATE_LIMIT_CONFIG = {
  // General API endpoints - moderate limits
  API_GENERAL: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500, // 500 requests per window for normal SPA hydration and dashboard use
    message: 'Too many requests. Please try again in a few minutes.',
  },

  // Authentication endpoints - stricter limits to prevent brute force
  AUTH_LOGIN: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 attempts per window
    message: 'Too many login attempts. Please wait 15 minutes before trying again.',
    skipSuccessfulRequests: true, // Only count failed attempts
  },

  AUTH_REGISTER: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // 5 registrations per hour per IP
    message: 'Too many registration attempts. Please try again later.',
  },

  AUTH_EMAIL_CHECK: {
    windowMs: 60 * 1000, // 1 minute
    max: 10, // 10 checks per minute
    message: 'Too many email checks. Please slow down.',
  },

  // Email verification - prevent abuse
  EMAIL_VERIFICATION: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // 5 verification emails per hour
    message: 'Too many verification requests. Please wait before requesting another code.',
  },

  // Interview creation - prevent resource abuse
  INTERVIEW_CREATE: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // 10 interviews per hour
    message: 'Too many interview sessions created. Please try again later.',
  },

  // Public endpoints - moderate limits
  PUBLIC_READ: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200, // Higher limit for read-only public endpoints
    message: 'Too many requests. Please try again in a few minutes.',
  },

  // Newsletter subscription - prevent spam signups
  NEWSLETTER: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 subscribe/unsubscribe per hour per IP
    message: 'Too many newsletter requests. Please try again later.',
  },

  // Contact form - prevent spam
  CONTACT_FORM: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // 5 messages per hour per IP
    message: 'Too many contact messages. Please try again later.',
  },

  // File uploads - prevent abuse
  FILE_UPLOAD: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // 20 uploads per window
    message: 'Too many file uploads. Please try again later.',
  },

  // Admin bootstrap - very strict (one-time operation)
  ADMIN_BOOTSTRAP: {
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
    max: 3, // 3 attempts per day
    message: 'Admin bootstrap limit reached. Please try again tomorrow.',
  },

  // Team invitations - prevent invitation spam
  TEAM_INVITATION: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20, // 20 invitations per hour
    message: 'Too many team invitations sent. Please try again later.',
  },

  // Job applications - prevent application spam
  JOB_APPLICATION: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // 10 applications per hour
    message: 'Too many job applications submitted. Please try again later.',
  },

  // Password reset - prevent enumeration
  PASSWORD_RESET: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 3, // 3 requests per window
    message: 'Too many password reset requests. Please wait before trying again.',
  },
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Generate a key for rate limiting based on IP and optional user ID
 * Uses X-Forwarded-For header if behind a proxy
 * 
 * @param {Request} req - Express request object
 * @returns {string} Rate limit key
 */
const generateKey = (req) => {
  // Get IP address, considering proxies
  const ip = req.ip || 
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
    req.connection?.remoteAddress || 
    'unknown';
  
  // If user is authenticated, combine IP with user ID for more accurate limiting
  if (req.user?.uid) {
    return `${ip}:${req.user.uid}`;
  }
  
  return ip;
};

/**
 * Create a standardized 429 response handler
 * Returns JSON response with retry information following OWASP guidelines
 * 
 * @param {string} customMessage - Custom error message
 * @returns {Function} Express middleware handler
 */
const createRateLimitHandler = (customMessage) => (req, res, options) => {
  const retryAfterSeconds = Math.ceil(options.windowMs / 1000);
  
  // Log rate limit violation for security monitoring
  logger.warn('Rate limit exceeded', {
    ip: req.ip,
    path: req.path,
    method: req.method,
    userId: req.user?.uid || 'anonymous',
    userAgent: req.headers['user-agent'],
    retryAfter: retryAfterSeconds,
  });

  // Set Retry-After header (OWASP recommendation)
  res.setHeader('Retry-After', retryAfterSeconds);
  
  // Return consistent JSON error response
  res.status(429).json({
    success: false,
    error: customMessage || options.message,
    code: 'RATE_LIMIT_EXCEEDED',
    retryAfter: retryAfterSeconds,
    retryAfterMs: options.windowMs,
  });
};

/**
 * Skip rate limiting for certain conditions
 * 
 * @param {Request} req - Express request object
 * @param {Array<string>} skipPaths - Paths to skip
 * @returns {boolean} Whether to skip rate limiting
 */
const shouldSkip = (req, skipPaths = []) => {
  // Skip health check endpoints
  if (req.path === '/health' || req.path === '/api/health') {
    return true;
  }
  
  // Skip specified paths
  if (skipPaths.some(path => req.path.startsWith(path))) {
    return true;
  }
  
  return false;
};

// =============================================================================
// RATE LIMITER FACTORY
// =============================================================================

/**
 * Create a rate limiter with the specified configuration
 * 
 * @param {Object} config - Rate limiter configuration
 * @param {Object} options - Additional options
 * @returns {Function} Express rate limit middleware
 */
const createRateLimiter = (config, options = {}) => {
  return rateLimit({
    windowMs: config.windowMs,
    max: config.max,
    message: config.message,
    standardHeaders: true, // Return rate limit info in RateLimit-* headers (draft-6)
    legacyHeaders: false, // Disable X-RateLimit-* headers
    keyGenerator: options.keyGenerator || generateKey,
    handler: createRateLimitHandler(config.message),
    skip: options.skip || (() => false),
    skipSuccessfulRequests: config.skipSuccessfulRequests || false,
    skipFailedRequests: config.skipFailedRequests || false,
  });
};

// =============================================================================
// EXPORTED RATE LIMITERS
// =============================================================================

/**
 * General API rate limiter
 * Applied to all /api/* routes as a baseline
 */
export const apiLimiter = createRateLimiter(RATE_LIMIT_CONFIG.API_GENERAL, {
  skip: (req) => {
    if (req.originalUrl?.startsWith('/api/auth/me')) {
      return true;
    }
    return shouldSkip(req, ['/api/health']);
  },
});

/**
 * Authentication rate limiter
 * Applied to login endpoints to prevent brute force attacks
 */
export const authLimiter = createRateLimiter(RATE_LIMIT_CONFIG.AUTH_LOGIN, {
  skip: (req) => {
    // Skip rate limiting for delete-unregistered-auth-user endpoint
    return req.path === '/delete-unregistered-auth-user';
  },
});

/**
 * Registration rate limiter
 * Prevents mass account creation
 */
export const registrationLimiter = createRateLimiter(RATE_LIMIT_CONFIG.AUTH_REGISTER);

/**
 * Email check rate limiter
 * Prevents email enumeration attacks
 */
export const emailCheckLimiter = createRateLimiter(RATE_LIMIT_CONFIG.AUTH_EMAIL_CHECK);

/**
 * Email verification rate limiter
 * Prevents abuse of verification system
 */
export const emailVerificationLimiter = createRateLimiter(RATE_LIMIT_CONFIG.EMAIL_VERIFICATION);

/**
 * Interview creation rate limiter
 * Prevents resource abuse
 */
export const interviewLimiter = createRateLimiter(RATE_LIMIT_CONFIG.INTERVIEW_CREATE);

/**
 * Public endpoint rate limiter
 * Higher limits for read-only public endpoints
 */
export const publicLimiter = createRateLimiter(RATE_LIMIT_CONFIG.PUBLIC_READ);

/**
 * Newsletter rate limiter
 * Prevents subscription spam
 */
export const newsletterLimiter = createRateLimiter(RATE_LIMIT_CONFIG.NEWSLETTER);

/**
 * Contact form rate limiter
 * Prevents contact form spam
 */
export const contactLimiter = createRateLimiter(RATE_LIMIT_CONFIG.CONTACT_FORM);

/**
 * File upload rate limiter
 * Prevents upload abuse
 */
export const uploadLimiter = createRateLimiter(RATE_LIMIT_CONFIG.FILE_UPLOAD);

/**
 * Admin bootstrap rate limiter
 * Very strict limits for admin creation
 */
export const adminBootstrapLimiter = createRateLimiter(RATE_LIMIT_CONFIG.ADMIN_BOOTSTRAP);

/**
 * Team invitation rate limiter
 * Prevents invitation spam
 */
export const teamInvitationLimiter = createRateLimiter(RATE_LIMIT_CONFIG.TEAM_INVITATION);

/**
 * Job application rate limiter
 * Prevents application spam
 */
export const jobApplicationLimiter = createRateLimiter(RATE_LIMIT_CONFIG.JOB_APPLICATION);

/**
 * Password reset rate limiter
 * Prevents enumeration and abuse
 */
export const passwordResetLimiter = createRateLimiter(RATE_LIMIT_CONFIG.PASSWORD_RESET);

// =============================================================================
// UTILITY EXPORTS
// =============================================================================

/**
 * Export configuration for testing and documentation
 */
export const RATE_LIMITS = RATE_LIMIT_CONFIG;

/**
 * Create a custom rate limiter with specific configuration
 * Useful for endpoint-specific rate limiting
 * 
 * @param {Object} customConfig - Custom configuration
 * @returns {Function} Express rate limit middleware
 */
export const createCustomLimiter = (customConfig) => {
  const config = {
    windowMs: customConfig.windowMs || RATE_LIMIT_CONFIG.API_GENERAL.windowMs,
    max: customConfig.max || RATE_LIMIT_CONFIG.API_GENERAL.max,
    message: customConfig.message || RATE_LIMIT_CONFIG.API_GENERAL.message,
    skipSuccessfulRequests: customConfig.skipSuccessfulRequests || false,
    skipFailedRequests: customConfig.skipFailedRequests || false,
  };
  
  return createRateLimiter(config, {
    keyGenerator: customConfig.keyGenerator,
    skip: customConfig.skip,
  });
};

export default {
  apiLimiter,
  authLimiter,
  registrationLimiter,
  emailCheckLimiter,
  emailVerificationLimiter,
  interviewLimiter,
  publicLimiter,
  newsletterLimiter,
  contactLimiter,
  uploadLimiter,
  adminBootstrapLimiter,
  teamInvitationLimiter,
  jobApplicationLimiter,
  passwordResetLimiter,
  createCustomLimiter,
  RATE_LIMITS,
};
