/**
 * Security Middleware
 * 
 * Implements comprehensive security measures following OWASP guidelines:
 * - HTTP Security Headers (Helmet)
 * - CORS Configuration
 * - Rate Limiting (imported from rateLimiter.middleware.js)
 * - Request Logging
 * - Security Event Monitoring
 * 
 * @see https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html
 */

import helmet from 'helmet';
import cors from 'cors';
import logger from '../utils/logger.js';

// Import comprehensive rate limiters from dedicated module
import {
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
} from './rateLimiter.middleware.js';

// =============================================================================
// SECURITY CONFIGURATION
// =============================================================================

/**
 * Content Security Policy directives
 * Configured to allow necessary resources while blocking malicious content
 */
const cspDirectives = {
  defaultSrc: ["'self'"],
  styleSrc: ["'self'", "'unsafe-inline'"], // Required for some UI frameworks
  scriptSrc: ["'self'"],
  imgSrc: ["'self'", "data:", "https:", "blob:"],
  connectSrc: [
    "'self'",
    "https://api.openai.com",
    "https://firestore.googleapis.com",
    "https://firebase.googleapis.com",
    "https://identitytoolkit.googleapis.com",
    "wss:", // WebSocket connections
  ],
  fontSrc: ["'self'", "https:", "data:"],
  objectSrc: ["'none'"],
  mediaSrc: ["'self'", "blob:"],
  frameSrc: ["'none'"],
  baseUri: ["'self'"],
  formAction: ["'self'"],
  frameAncestors: ["'none'"], // Prevents clickjacking
  upgradeInsecureRequests: [], // Upgrade HTTP to HTTPS
};

/**
 * CORS configuration
 * Restricts cross-origin requests to trusted domains
 */
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) {
      callback(null, true);
      return;
    }
    
    const allowedOrigins = [
      process.env.FRONTEND_URL || 'http://localhost:4028',
      'http://localhost:4028',
      'http://localhost:5173', // Vite dev server
    ];
    
    // Allow configured origins
    if (allowedOrigins.some(allowed => origin === allowed || origin.startsWith(allowed))) {
      callback(null, true);
    } else {
      logger.warn('CORS blocked request from origin:', { origin });
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Meeting-Token',
    'X-CSRF-Token',
    'X-Requested-With',
    'Accept',
    'Accept-Version',
    'Content-Length',
    'Content-MD5',
    'Date',
    'X-Api-Version',
  ],
  exposedHeaders: [
    'RateLimit-Limit',
    'RateLimit-Remaining',
    'RateLimit-Reset',
    'Retry-After',
  ],
  maxAge: 86400, // 24 hours
  optionsSuccessStatus: 204,
};

// =============================================================================
// MAIN SECURITY SETUP
// =============================================================================

/**
 * Configure all security middleware for the Express application
 * 
 * @param {Express} app - Express application instance
 */
export function setupSecurity(app) {
  // Trust proxy (required for rate limiting behind reverse proxy)
  // Set to 1 if behind a single proxy (like nginx), adjust if behind multiple
  app.set('trust proxy', 1);

  // ===========================================================================
  // HTTP Security Headers (Helmet)
  // ===========================================================================
  app.use(helmet({
    contentSecurityPolicy: {
      directives: cspDirectives,
    },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginEmbedderPolicy: false, // Required for WebRTC
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    dnsPrefetchControl: { allow: false },
    frameguard: { action: 'deny' }, // Prevents clickjacking
    hidePoweredBy: true, // Hide X-Powered-By header
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
    ieNoOpen: true,
    noSniff: true,
    originAgentCluster: true,
    permittedCrossDomainPolicies: { permittedPolicies: 'none' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xssFilter: true,
  }));

  // ===========================================================================
  // CORS Configuration
  // ===========================================================================
  app.use(cors(corsOptions));

  // ===========================================================================
  // Rate Limiting
  // ===========================================================================
  
  // General API rate limiting (baseline)
  app.use('/api/', apiLimiter);
  
  // Authentication endpoints - stricter limits
  app.use('/api/auth/register', registrationLimiter);
  app.use('/api/auth/check-email', emailCheckLimiter);
  app.use('/api/auth/email-verification', emailVerificationLimiter);
  // Do not apply login-style throttling to session/profile routes such as /api/auth/me.
  // The app polls those endpoints during normal navigation and role switching.
  
  // Interview creation - prevent resource abuse
  app.use('/api/interviews/create', interviewLimiter);
  
  // Public endpoints
  app.use('/api/public/jobs', publicLimiter);
  app.use('/api/public/team-invitations', publicLimiter);
  app.use('/api/public/contact', contactLimiter);
  app.use('/api/public/maintenance-status', publicLimiter);
  
  // Newsletter endpoints
  app.use('/api/newsletter/subscribe', newsletterLimiter);
  app.use('/api/newsletter/unsubscribe', newsletterLimiter);
  
  // File upload endpoints
  app.use('/api/uploads', uploadLimiter);
  
  // Admin bootstrap (very strict)
  app.use('/api/admin/auth/bootstrap-admin', adminBootstrapLimiter);
  app.use('/api/admin/auth/seed-admin', adminBootstrapLimiter);
  
  // Team invitations
  app.use('/api/organizations/me/team-invitations', teamInvitationLimiter);
  
  // Job applications
  app.use('/api/jobs/:jobId/apply', jobApplicationLimiter);

  // ===========================================================================
  // Additional Security Headers
  // ===========================================================================
  app.use((req, res, next) => {
    // Cache control for API responses
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    
    // Additional security headers not covered by Helmet
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('X-Download-Options', 'noopen');
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    
    next();
  });

  // ===========================================================================
  // Request Logging and Security Monitoring
  // ===========================================================================
  app.use((req, res, next) => {
    // Log request for security monitoring
    if (process.env.NODE_ENV === 'development') {
      console.log(`${req.method} ${req.path}`);
    }
    
    // Log suspicious activity patterns
    const suspiciousPatterns = [
      /\.\.\//,           // Path traversal
      /<script/i,         // XSS attempt
      /javascript:/i,     // XSS attempt
      /on\w+=/i,          // Event handler injection
      /union.*select/i,   // SQL injection
      /;.*--/,            // SQL comment
      /'.*or.*'/i,        // SQL injection
    ];
    
    const requestData = JSON.stringify({
      body: req.body,
      query: req.query,
      params: req.params,
    });
    
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(requestData) || pattern.test(req.path)) {
        logger.warn('Suspicious request detected', {
          ip: req.ip,
          path: req.path,
          method: req.method,
          userAgent: req.headers['user-agent'],
          pattern: pattern.toString(),
        });
        break;
      }
    }
    
    next();
  });

  // ===========================================================================
  // CSRF Protection Note
  // ===========================================================================
  // For JWT-based authentication (tokens in Authorization header), CSRF protection
  // is not typically required as the token is not stored in cookies.
  // CORS + rate limiting + Helmet provides sufficient protection for REST APIs.
  // If you need CSRF protection later, implement a custom solution compatible with ES modules.
}

// =============================================================================
// EXPORTS
// =============================================================================

// Re-export rate limiters for use in specific routes
export {
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
};
