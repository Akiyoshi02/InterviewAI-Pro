/**
 * Comprehensive Input Validation and Sanitization Middleware
 * 
 * Implements OWASP best practices for input validation:
 * - Schema-based validation with type checking
 * - Length limits on all string inputs
 * - Sanitization to prevent XSS and injection attacks
 * - Rejection of unexpected fields
 * - Whitelist approach for allowed values
 * 
 * @see https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html
 */

import { body, param, query, validationResult, matchedData } from 'express-validator';
import logger from '../utils/logger.js';

/**
 * HTML escape function to prevent XSS attacks
 * Escapes: & < > " ' / ` =
 * 
 * @param {string} str - Input string to escape
 * @returns {string} Escaped string safe for HTML output
 */
const escapeHtml = (str) => {
  if (typeof str !== 'string') return str;
  
  const htmlEscapes = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '/': '&#x2F;',
    '`': '&#x60;',
    '=': '&#x3D;',
  };
  
  return str.replace(/[&<>"'`=/]/g, char => htmlEscapes[char]);
};

// =============================================================================
// CONFIGURATION CONSTANTS
// =============================================================================

/**
 * Maximum length limits for different field types
 * Based on practical usage and security considerations
 */
const LENGTH_LIMITS = {
  // Personal information
  NAME: 100,
  EMAIL: 254, // RFC 5321 maximum
  PHONE: 20,
  SHORT_TEXT: 100,
  MEDIUM_TEXT: 500,
  LONG_TEXT: 2000,
  VERY_LONG_TEXT: 5000,
  
  // URLs
  URL: 2083, // IE limit, commonly used as standard
  
  // IDs and tokens
  ID: 128,
  TOKEN: 512,
  UUID: 36,
  
  // Code and verification
  VERIFICATION_CODE: 8,
  PASSWORD: 128,
  
  // Arrays
  ARRAY_MAX_ITEMS: 100,
  
  // File names
  FILENAME: 255,
};

/**
 * Regular expression patterns for validation
 */
const PATTERNS = {
  // UUID v4 format
  UUID: /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  
  // Firebase UID format (alphanumeric, 28 chars typically)
  FIREBASE_UID: /^[a-zA-Z0-9]{20,128}$/,
  
  // Simple alphanumeric ID
  ALPHANUMERIC_ID: /^[a-zA-Z0-9_-]{1,128}$/,
  
  // Verification code (8 digits)
  VERIFICATION_CODE: /^\d{8}$/,
  
  // Phone number (international format)
  PHONE: /^[+]?[0-9\s\-().]{7,20}$/,
  
  // Safe string (no script tags or HTML)
  SAFE_STRING: /^[^<>]*$/,
  
  // Slug format
  SLUG: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
  
  // Year format (4 digits)
  YEAR: /^(19|20)\d{2}$/,
};

/**
 * Allowed values for enumerated fields
 */
const ALLOWED_VALUES = {
  ACCOUNT_TYPE: ['CANDIDATE', 'COMPANY'],
  ORGANIZATION_ROLE: ['ADMIN', 'RECRUITER', 'REVIEWER'],
  ORGANIZATION_STATUS: ['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'],
  REJECTION_REASON_CODE: [
    'DOCUMENT_MISSING',
    'DOCUMENT_MISMATCH',
    'IDENTITY_MISMATCH',
    'DOMAIN_MISMATCH',
    'PUBLIC_EMAIL_DOMAIN',
    'INSUFFICIENT_PUBLIC_PRESENCE',
    'HIGH_RISK_SIGNALS',
    'INCOMPLETE_REGISTRATION',
    'OTHER',
  ],
  APPLICATION_STATUS: ['SUBMITTED', 'SCREENING', 'INTERVIEWING', 'SHORTLISTED', 'REJECTED', 'HIRED'],
  JOB_STATUS: ['DRAFT', 'PUBLISHED', 'ARCHIVED'],
  INTERVIEW_MODE: ['PRACTICE', 'HIRING'],
  INTERVIEW_STATUS: ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'PAUSED', 'CANCELLED'],
  INTERVIEW_SCHEDULE_STATUS: ['SCHEDULED', 'RESCHEDULED', 'CANCELLED'],
  PIPELINE_STATUS: ['SCREENING', 'INTERVIEW', 'FINAL', 'HIRED', 'REJECTED'],
  MEMBER_STATUS: ['ACTIVE', 'INACTIVE'],
  USER_ACCOUNT_STATUS: ['ACTIVE', 'SUSPENDED'],
  PLAN_ID: ['free', 'starter', 'professional', 'enterprise'],
  EMPLOYMENT_TYPE: ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'TEMPORARY'],
  WORK_TYPE: ['REMOTE', 'ONSITE', 'HYBRID'],
  EXPERIENCE_LEVEL: ['ENTRY', 'JUNIOR', 'MID', 'SENIOR', 'LEAD', 'EXECUTIVE'],
  GENDER: ['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'],
};

// =============================================================================
// SANITIZATION FUNCTIONS
// =============================================================================

/**
 * Sanitize a string to prevent XSS attacks
 * Escapes HTML special characters
 * 
 * @param {string} value - Input string
 * @returns {string} Sanitized string
 */
const sanitizeString = (value) => {
  if (typeof value !== 'string') return value;
  return escapeHtml(value.trim());
};

/**
 * Sanitize an object by removing unexpected fields
 * Uses whitelist approach for security
 * 
 * @param {Object} obj - Input object
 * @param {Array<string>} allowedFields - Whitelist of allowed field names
 * @returns {Object} Sanitized object with only allowed fields
 */
const sanitizeObject = (obj, allowedFields) => {
  if (!obj || typeof obj !== 'object') return {};
  
  const sanitized = {};
  allowedFields.forEach(field => {
    if (Object.prototype.hasOwnProperty.call(obj, field) && obj[field] !== undefined) {
      sanitized[field] = obj[field];
    }
  });
  
  return sanitized;
};

/**
 * Sanitize an array of strings
 * 
 * @param {Array} arr - Input array
 * @param {number} maxItems - Maximum allowed items
 * @returns {Array} Sanitized array
 */
const sanitizeStringArray = (arr, maxItems = LENGTH_LIMITS.ARRAY_MAX_ITEMS) => {
  if (!Array.isArray(arr)) return [];
  
  return arr
    .slice(0, maxItems)
    .filter(item => typeof item === 'string')
    .map(item => sanitizeString(item))
    .filter(item => item.length > 0);
};

/**
 * Normalize and sanitize email address
 * 
 * @param {string} email - Input email
 * @returns {string} Normalized email
 */
const normalizeEmail = (email) => {
  if (typeof email !== 'string') return '';
  return email.trim().toLowerCase();
};

// =============================================================================
// VALIDATION MIDDLEWARE
// =============================================================================

/**
 * Middleware to validate request and return errors
 * Should be called after all validation rules
 */
export const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorDetails = errors.array().map(err => ({
      field: err.path || err.param,
      message: err.msg,
      value: err.value !== undefined ? '[REDACTED]' : undefined, // Don't expose values
    }));
    
    // Log validation failure for security monitoring
    logger.warn('Validation failed', {
      path: req.path,
      method: req.method,
      ip: req.ip,
      errors: errorDetails.map(e => e.field),
    });
    
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      errors: errorDetails,
    });
  }
  
  next();
};

/**
 * Middleware to strip unexpected fields from request body
 * Uses whitelist approach - only allows specified fields
 * 
 * @param {Array<string>} allowedFields - Whitelist of allowed field names
 * @returns {Function} Express middleware
 */
export const stripUnexpectedFields = (allowedFields) => (req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    const unexpectedFields = Object.keys(req.body).filter(
      field => !allowedFields.includes(field)
    );
    
    if (unexpectedFields.length > 0) {
      logger.warn('Unexpected fields stripped from request', {
        path: req.path,
        method: req.method,
        ip: req.ip,
        unexpectedFields,
      });
    }
    
    req.body = sanitizeObject(req.body, allowedFields);
  }
  
  next();
};

// =============================================================================
// COMMON VALIDATION RULES
// =============================================================================

/**
 * Common validation rules for reuse across routes
 */
export const commonValidators = {
  // ID validation
  id: () => param('id')
    .trim()
    .notEmpty()
    .withMessage('ID is required')
    .isLength({ max: LENGTH_LIMITS.ID })
    .withMessage(`ID must be ${LENGTH_LIMITS.ID} characters or less`)
    .matches(PATTERNS.ALPHANUMERIC_ID)
    .withMessage('Invalid ID format'),

  // Firebase UID validation
  firebaseUid: (field = 'uid') => body(field)
    .trim()
    .notEmpty()
    .withMessage('User ID is required')
    .matches(PATTERNS.FIREBASE_UID)
    .withMessage('Invalid user ID format'),

  // Email validation
  email: (field = 'email', required = true) => {
    let validator = body(field)
      .trim()
      .normalizeEmail();
    
    if (required) {
      validator = validator
        .notEmpty()
        .withMessage('Email is required');
    } else {
      validator = validator.optional({ nullable: true, checkFalsy: true });
    }
    
    return validator
      .isEmail()
      .withMessage('Valid email address is required')
      .isLength({ max: LENGTH_LIMITS.EMAIL })
      .withMessage(`Email must be ${LENGTH_LIMITS.EMAIL} characters or less`);
  },

  // Name validation
  name: (field = 'name', required = true) => {
    let validator = body(field)
      .trim()
      .customSanitizer(sanitizeString);
    
    if (required) {
      validator = validator
        .notEmpty()
        .withMessage('Name is required');
    } else {
      validator = validator.optional({ nullable: true, checkFalsy: true });
    }
    
    return validator
      .isLength({ max: LENGTH_LIMITS.NAME })
      .withMessage(`Name must be ${LENGTH_LIMITS.NAME} characters or less`)
      .matches(PATTERNS.SAFE_STRING)
      .withMessage('Name contains invalid characters');
  },

  // Short text validation
  shortText: (field, required = false) => {
    let validator = body(field)
      .trim()
      .customSanitizer(sanitizeString);
    
    if (required) {
      validator = validator
        .notEmpty()
        .withMessage(`${field} is required`);
    } else {
      validator = validator.optional({ nullable: true, checkFalsy: true });
    }
    
    return validator
      .isLength({ max: LENGTH_LIMITS.SHORT_TEXT })
      .withMessage(`${field} must be ${LENGTH_LIMITS.SHORT_TEXT} characters or less`);
  },

  // Medium text validation
  mediumText: (field, required = false) => {
    let validator = body(field)
      .trim()
      .customSanitizer(sanitizeString);
    
    if (required) {
      validator = validator
        .notEmpty()
        .withMessage(`${field} is required`);
    } else {
      validator = validator.optional({ nullable: true, checkFalsy: true });
    }
    
    return validator
      .isLength({ max: LENGTH_LIMITS.MEDIUM_TEXT })
      .withMessage(`${field} must be ${LENGTH_LIMITS.MEDIUM_TEXT} characters or less`);
  },

  // Long text validation (for descriptions, messages)
  longText: (field, required = false) => {
    let validator = body(field)
      .trim()
      .customSanitizer(sanitizeString);
    
    if (required) {
      validator = validator
        .notEmpty()
        .withMessage(`${field} is required`);
    } else {
      validator = validator.optional({ nullable: true, checkFalsy: true });
    }
    
    return validator
      .isLength({ max: LENGTH_LIMITS.LONG_TEXT })
      .withMessage(`${field} must be ${LENGTH_LIMITS.LONG_TEXT} characters or less`);
  },

  // Very long text validation (for very long content)
  veryLongText: (field, required = false) => {
    let validator = body(field)
      .trim()
      .customSanitizer(sanitizeString);
    
    if (required) {
      validator = validator
        .notEmpty()
        .withMessage(`${field} is required`);
    } else {
      validator = validator.optional({ nullable: true, checkFalsy: true });
    }
    
    return validator
      .isLength({ max: LENGTH_LIMITS.VERY_LONG_TEXT })
      .withMessage(`${field} must be ${LENGTH_LIMITS.VERY_LONG_TEXT} characters or less`);
  },

  // URL validation
  url: (field, required = false) => {
    let validator = body(field);
    
    if (required) {
      validator = validator
        .trim()
        .notEmpty()
        .withMessage(`${field} is required`);
    } else {
      validator = validator
        .optional({ nullable: true, checkFalsy: true })
        .trim();
    }
    
    return validator
      .isURL({ protocols: ['http', 'https'], require_protocol: true, require_tld: false })
      .withMessage(`${field} must be a valid URL`)
      .isLength({ max: LENGTH_LIMITS.URL })
      .withMessage(`${field} must be ${LENGTH_LIMITS.URL} characters or less`);
  },

  // Phone validation
  phone: (field = 'phoneNumber', required = false) => {
    let validator = body(field)
      .trim();
    
    if (required) {
      validator = validator
        .notEmpty()
        .withMessage('Phone number is required');
    } else {
      validator = validator.optional({ nullable: true, checkFalsy: true });
    }
    
    return validator
      .isLength({ max: LENGTH_LIMITS.PHONE })
      .withMessage(`Phone number must be ${LENGTH_LIMITS.PHONE} characters or less`)
      .matches(PATTERNS.PHONE)
      .withMessage('Invalid phone number format');
  },

  // Token validation
  token: (field = 'token') => body(field)
    .trim()
    .notEmpty()
    .withMessage('Token is required')
    .isLength({ max: LENGTH_LIMITS.TOKEN })
    .withMessage('Invalid token format'),

  // Verification code validation
  verificationCode: () => body('code')
    .trim()
    .notEmpty()
    .withMessage('Verification code is required')
    .matches(PATTERNS.VERIFICATION_CODE)
    .withMessage('Verification code must be 8 digits'),

  // Enum validation
  enum: (field, allowedValues, required = false) => {
    let validator = body(field)
      .trim()
      .customSanitizer(v => v?.toUpperCase?.() || v);
    
    if (required) {
      validator = validator
        .notEmpty()
        .withMessage(`${field} is required`);
    } else {
      validator = validator.optional({ nullable: true, checkFalsy: true });
    }
    
    return validator
      .isIn(allowedValues)
      .withMessage(`${field} must be one of: ${allowedValues.join(', ')}`);
  },

  // Array of strings validation
  stringArray: (field, required = false, maxItems = LENGTH_LIMITS.ARRAY_MAX_ITEMS) => {
    let validator = body(field)
      .customSanitizer(value => {
        if (Array.isArray(value)) return sanitizeStringArray(value, maxItems);
        if (typeof value === 'string') {
          // Handle comma-separated string
          return sanitizeStringArray(value.split(','), maxItems);
        }
        return [];
      });
    
    if (required) {
      validator = validator
        .isArray({ min: 1 })
        .withMessage(`${field} must have at least one item`);
    } else {
      validator = validator.optional({ nullable: true });
    }
    
    return validator
      .isArray({ max: maxItems })
      .withMessage(`${field} must have at most ${maxItems} items`);
  },

  // Integer validation
  integer: (field, { min, max, required = false } = {}) => {
    let validator = body(field)
      .toInt();
    
    if (required) {
      validator = validator
        .notEmpty()
        .withMessage(`${field} is required`);
    } else {
      validator = validator.optional({ nullable: true, checkFalsy: true });
    }
    
    validator = validator.isInt();
    
    if (min !== undefined) {
      validator = validator.isInt({ min }).withMessage(`${field} must be at least ${min}`);
    }
    if (max !== undefined) {
      validator = validator.isInt({ max }).withMessage(`${field} must be at most ${max}`);
    }
    
    return validator;
  },

  // Boolean validation
  boolean: (field, required = false) => {
    let validator = body(field)
      .toBoolean();
    
    if (required) {
      validator = validator
        .notEmpty()
        .withMessage(`${field} is required`);
    } else {
      validator = validator.optional({ nullable: true });
    }
    
    return validator.isBoolean().withMessage(`${field} must be a boolean`);
  },

  // Date/ISO8601 validation
  isoDate: (field, required = false) => {
    let validator = body(field)
      .trim();
    
    if (required) {
      validator = validator
        .notEmpty()
        .withMessage(`${field} is required`);
    } else {
      validator = validator.optional({ nullable: true, checkFalsy: true });
    }
    
    return validator
      .isISO8601()
      .withMessage(`${field} must be a valid ISO 8601 date`);
  },

  // Year validation
  year: (field = 'year', required = false) => {
    let validator = body(field)
      .trim();
    
    if (required) {
      validator = validator
        .notEmpty()
        .withMessage('Year is required');
    } else {
      validator = validator.optional({ nullable: true, checkFalsy: true });
    }
    
    return validator
      .matches(PATTERNS.YEAR)
      .withMessage('Year must be a valid 4-digit year');
  },

  // Query parameter validation
  queryParam: {
    limit: (defaultVal = 50, maxVal = 500) => query('limit')
      .optional()
      .toInt()
      .isInt({ min: 1, max: maxVal })
      .withMessage(`Limit must be between 1 and ${maxVal}`)
      .default(defaultVal),
    
    offset: () => query('offset')
      .optional()
      .toInt()
      .isInt({ min: 0 })
      .withMessage('Offset must be 0 or greater')
      .default(0),
    
    status: (allowedValues) => query('status')
      .optional()
      .trim()
      .isIn(allowedValues)
      .withMessage(`Status must be one of: ${allowedValues.join(', ')}`),
  },
};

// =============================================================================
// VALIDATION SCHEMAS FOR SPECIFIC ENDPOINTS
// =============================================================================

/**
 * Validation schemas organized by route
 */
export const validationSchemas = {
  // Authentication schemas
  auth: {
    register: {
      allowedFields: [
        'email', 'accountType', 'fullName', 'experienceLevel', 'gender', 'targetRole',
        'careerGoals', 'location', 'preferredLanguage', 'phoneNumber',
        'highestQualification', 'fieldOfStudy', 'institutionName', 'graduationYear',
        'skills', 'linkedinUrl', 'githubUrl', 'portfolioUrl',
        'certifications', 'availability', 'preferredWorkType', 'preferredEmploymentType',
        'expectedSalary', 'companyName', 'companyType', 'industry', 'companySize',
        'jobTitle', 'department', 'hiringVolume', 'companyWebsite', 'companyLocation',
        'companyAddress', 'companyDescription', 'businessRegistrationNumber',
        'companyEmail', 'companyPhoneNumber', 'establishedYear', 'facebookUrl', 'companyLinkedinUrl',
        'teamInvitationToken', 'refCode',
      ],
      validators: [
        commonValidators.email('email', false),
        commonValidators.enum('accountType', ALLOWED_VALUES.ACCOUNT_TYPE, true),
        commonValidators.name('fullName', false),
        commonValidators.shortText('experienceLevel'),
        commonValidators.enum('gender', ALLOWED_VALUES.GENDER),
        commonValidators.shortText('targetRole'),
        commonValidators.longText('careerGoals'),
        commonValidators.shortText('location'),
        commonValidators.shortText('preferredLanguage'),
        commonValidators.phone('phoneNumber'),
        commonValidators.shortText('highestQualification'),
        commonValidators.shortText('fieldOfStudy'),
        commonValidators.shortText('institutionName'),
        commonValidators.year('graduationYear'),
        commonValidators.stringArray('skills'),
        commonValidators.url('linkedinUrl'),
        commonValidators.url('githubUrl'),
        commonValidators.url('portfolioUrl'),
        commonValidators.stringArray('certifications'),
        commonValidators.shortText('availability'),
        commonValidators.shortText('preferredWorkType'),
        commonValidators.shortText('preferredEmploymentType'),
        commonValidators.shortText('expectedSalary'),
        commonValidators.name('companyName', false),
        commonValidators.shortText('companyType'),
        commonValidators.shortText('industry'),
        commonValidators.shortText('companySize'),
        commonValidators.shortText('jobTitle'),
        commonValidators.shortText('department'),
        commonValidators.shortText('hiringVolume'),
        commonValidators.url('companyWebsite'),
        commonValidators.shortText('companyLocation'),
        commonValidators.mediumText('companyAddress'),
        commonValidators.longText('companyDescription'),
        commonValidators.shortText('businessRegistrationNumber'),
        commonValidators.email('companyEmail', false),
        commonValidators.phone('companyPhoneNumber'),
        commonValidators.year('establishedYear'),
        commonValidators.url('facebookUrl'),
        commonValidators.url('companyLinkedinUrl'),
        commonValidators.token('teamInvitationToken').optional(),
        commonValidators.token('refCode').optional(),
      ],
    },
    
    checkEmail: {
      allowedFields: ['email'],
      validators: [
        commonValidators.email('email', true),
      ],
    },
    
    emailVerificationStart: {
      allowedFields: ['email', 'fullName'],
      validators: [
        commonValidators.email('email', false),
        commonValidators.name('fullName', false),
      ],
    },
    
    verifyEmailCode: {
      allowedFields: ['code'],
      validators: [
        commonValidators.verificationCode(),
      ],
    },
    
    deleteUnregisteredUser: {
      allowedFields: ['userId'],
      validators: [
        body('userId')
          .trim()
          .notEmpty()
          .withMessage('User ID is required')
          .isLength({ max: LENGTH_LIMITS.ID })
          .withMessage('Invalid user ID'),
      ],
    },

    requestOrganizationReReview: {
      allowedFields: ['note'],
      validators: [
        commonValidators.longText('note', true),
        body('note')
          .trim()
          .isLength({ min: 15 })
          .withMessage('Re-review note must be at least 15 characters'),
      ],
    },
  },

  // Contact form schema
  contact: {
    submit: {
      allowedFields: ['name', 'email', 'subject', 'message'],
      validators: [
        commonValidators.name('name', true),
        commonValidators.email('email', true),
        commonValidators.shortText('subject', true)
          .isLength({ max: 150 })
          .withMessage('Subject must be 150 characters or less'),
        commonValidators.veryLongText('message', true),
      ],
    },
  },

  // Newsletter schemas
  newsletter: {
    subscribe: {
      allowedFields: ['email'],
      validators: [
        commonValidators.email('email', true),
      ],
    },
    unsubscribe: {
      allowedFields: ['email'],
      validators: [
        commonValidators.email('email', true),
      ],
    },
  },

  // Interview schemas
  interview: {
    create: {
      allowedFields: [
        'mode', 'jobRole', 'experienceLevel', 'industry', 'interviewTypes',
        'duration', 'difficulty', 'personality', 'totalQuestions', 'skillFocus',
        'candidateId', 'jobId', 'jobStage', 'invitationId', 'status',
        'pipelineStatus', 'reviewerAssignments', 'config',
        'scheduledFor', 'timezone', 'scheduleStatus',
      ],
      validators: [
        commonValidators.enum('mode', ALLOWED_VALUES.INTERVIEW_MODE, true),
        commonValidators.shortText('jobRole'),
        commonValidators.shortText('experienceLevel'),
        commonValidators.shortText('industry'),
        commonValidators.stringArray('interviewTypes'),
        commonValidators.integer('duration', { min: 15, max: 120 }),
        commonValidators.shortText('difficulty'),
        commonValidators.shortText('personality'),
        commonValidators.integer('totalQuestions', { min: 1, max: 50 }),
        commonValidators.stringArray('skillFocus'),
        body('candidateId')
          .optional()
          .trim()
          .isLength({ min: 1, max: LENGTH_LIMITS.ID })
          .withMessage('candidateId must be a valid identifier'),
        body('jobId')
          .optional()
          .trim()
          .isLength({ min: 1, max: LENGTH_LIMITS.ID })
          .withMessage('jobId must be a valid identifier'),
        body('jobStage').optional().isString().isLength({ max: LENGTH_LIMITS.SHORT_TEXT }),
        body('invitationId')
          .optional()
          .trim()
          .isLength({ min: 1, max: LENGTH_LIMITS.ID })
          .withMessage('invitationId must be a valid identifier'),
        commonValidators.enum('status', ALLOWED_VALUES.INTERVIEW_STATUS),
        commonValidators.enum('scheduleStatus', ALLOWED_VALUES.INTERVIEW_SCHEDULE_STATUS),
        commonValidators.enum('pipelineStatus', ALLOWED_VALUES.PIPELINE_STATUS),
        body('reviewerAssignments').optional().isArray({ max: 20 }),
        body('reviewerAssignments.*').optional().isString().isLength({ max: LENGTH_LIMITS.ID }),
        body('config').optional().isObject(),
        body('config.prepNotes')
          .optional()
          .isString()
          .isLength({ max: 500 })
          .withMessage('Prep notes must be 500 characters or less'),
        body('scheduledFor')
          .optional()
          .isISO8601()
          .withMessage('scheduledFor must be a valid ISO 8601 datetime'),
        body('timezone')
          .optional()
          .trim()
          .isLength({ max: 64 })
          .withMessage('timezone must be at most 64 characters'),
      ],
    },

    schedule: {
      allowedFields: ['scheduledFor', 'strategy', 'timezone', 'duration', 'interviewTypes', 'notes'],
      validators: [
        body('scheduledFor')
          .optional({ nullable: true, checkFalsy: true })
          .trim()
          .isISO8601()
          .withMessage('scheduledFor must be a valid ISO 8601 datetime'),
        body('strategy')
          .optional({ nullable: true })
          .customSanitizer((value) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
          .isIn(['MANUAL', 'AUTO', 'PREFERRED_FIRST'])
          .withMessage('strategy must be MANUAL, AUTO, or PREFERRED_FIRST'),
        body('timezone')
          .optional()
          .trim()
          .isLength({ max: 64 })
          .withMessage('timezone must be at most 64 characters'),
        commonValidators.integer('duration', { min: 15, max: 180 }),
        commonValidators.stringArray('interviewTypes'),
        body('notes')
          .optional()
          .trim()
          .isLength({ max: 500 })
          .withMessage('notes must be at most 500 characters'),
      ],
    },

    reschedule: {
      allowedFields: [
        'scheduledFor',
        'strategy',
        'timezone',
        'duration',
        'interviewTypes',
        'notes',
        'rescheduleRequestId',
        'rescheduleDecisionNote',
      ],
      validators: [
        body('scheduledFor')
          .optional({ nullable: true, checkFalsy: true })
          .trim()
          .isISO8601()
          .withMessage('scheduledFor must be a valid ISO 8601 datetime'),
        body('strategy')
          .optional({ nullable: true })
          .customSanitizer((value) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
          .isIn(['MANUAL', 'AUTO', 'PREFERRED_FIRST'])
          .withMessage('strategy must be MANUAL, AUTO, or PREFERRED_FIRST'),
        body('timezone')
          .optional()
          .trim()
          .isLength({ max: 64 })
          .withMessage('timezone must be at most 64 characters'),
        commonValidators.integer('duration', { min: 15, max: 180 }),
        commonValidators.stringArray('interviewTypes'),
        body('notes')
          .optional()
          .trim()
          .isLength({ max: 500 })
          .withMessage('notes must be at most 500 characters'),
        body('rescheduleRequestId')
          .optional()
          .trim()
          .isLength({ max: LENGTH_LIMITS.ID })
          .withMessage('rescheduleRequestId must be a valid identifier'),
        body('rescheduleDecisionNote')
          .optional()
          .trim()
          .isLength({ max: 500 })
          .withMessage('rescheduleDecisionNote must be at most 500 characters'),
      ],
    },

    requestReschedule: {
      allowedFields: ['reason', 'preferredSlots', 'timezone'],
      validators: [
        body('reason')
          .trim()
          .notEmpty()
          .withMessage('reason is required')
          .isLength({ min: 20, max: 500 })
          .withMessage('reason must be between 20 and 500 characters'),
        body('preferredSlots')
          .optional()
          .isArray({ max: 3 })
          .withMessage('preferredSlots can include up to 3 values'),
        body('preferredSlots.*')
          .optional()
          .isISO8601()
          .withMessage('Each preferred slot must be a valid ISO 8601 datetime'),
        body('timezone')
          .optional()
          .trim()
          .isLength({ max: 64 })
          .withMessage('timezone must be at most 64 characters'),
      ],
    },

    rejectRescheduleRequest: {
      allowedFields: ['reason'],
      validators: [
        body('reason')
          .optional()
          .trim()
          .isLength({ max: 500 })
          .withMessage('reason must be at most 500 characters'),
      ],
    },

    contactCompany: {
      allowedFields: ['message'],
      validators: [
        body('message')
          .trim()
          .notEmpty()
          .withMessage('message is required')
          .isLength({ min: 10, max: 1000 })
          .withMessage('message must be between 10 and 1000 characters'),
      ],
    },

    cancel: {
      allowedFields: ['reason'],
      validators: [
        body('reason')
          .optional()
          .trim()
          .isLength({ max: LENGTH_LIMITS.SHORT_TEXT })
          .withMessage('reason must be at most 200 characters'),
      ],
    },
    
    submitAnswer: {
      allowedFields: ['questionId', 'answer', 'audioUrl'],
      validators: [
        body('questionId')
          .trim()
          .notEmpty()
          .withMessage('Question ID is required')
          .isLength({ max: LENGTH_LIMITS.ID }),
        commonValidators.veryLongText('answer', true),
        commonValidators.url('audioUrl'),
      ],
    },

    recordingConsent: {
      allowedFields: ['recordingConsentGivenAt', 'recordingConsentVersion'],
      validators: [
        body('recordingConsentGivenAt')
          .trim()
          .notEmpty()
          .withMessage('Recording consent timestamp is required')
          .isISO8601()
          .withMessage('Must be a valid ISO 8601 date'),
        body('recordingConsentVersion')
          .optional()
          .trim()
          .isLength({ max: 32 })
          .withMessage('Version must be at most 32 characters'),
      ],
    },
  },

  // Job schemas
  job: {
    create: {
      allowedFields: [
        'title', 'department', 'location', 'employmentType', 'experienceLevel',
        'compensationRange', 'salaryCurrency', 'salaryMin', 'salaryMax', 'benefits',
        'description', 'requirements', 'responsibilities', 'skills', 'status',
        'applicationQuestions', 'customFormFields', 'acceptingApplications', 'postingDuration',
        'scheduledPublishAt',
      ],
      validators: [
        commonValidators.shortText('title', true)
          .isLength({ min: 3 })
          .withMessage('Title must be at least 3 characters'),
        commonValidators.shortText('department'),
        commonValidators.shortText('location'),
        commonValidators.shortText('employmentType'),
        commonValidators.shortText('experienceLevel'),
        commonValidators.shortText('compensationRange'),
        commonValidators.shortText('salaryCurrency'),
        commonValidators.integer('salaryMin', { min: 0 }),
        commonValidators.integer('salaryMax', { min: 0 }),
        commonValidators.longText('benefits'),
        commonValidators.veryLongText('description'),
        commonValidators.stringArray('requirements'),
        commonValidators.stringArray('responsibilities'),
        commonValidators.stringArray('skills'),
        commonValidators.enum('status', ALLOWED_VALUES.JOB_STATUS),
        body('applicationQuestions').optional().isArray(),
        body('customFormFields').optional().isArray(),
        commonValidators.boolean('acceptingApplications'),
        commonValidators.integer('postingDuration', { min: 1, max: 365 }),
        commonValidators.isoDate('scheduledPublishAt'),
      ],
    },
  },

  // Application schemas
  application: {
    submit: {
      allowedFields: ['resumeUrl', 'coverLetter', 'answers'],
      validators: [
        commonValidators.url('resumeUrl'),
        commonValidators.longText('coverLetter'),
        body('answers')
          .optional({ nullable: true })
          .isArray({ max: 50 })
          .withMessage('Answers must be an array'),
        body('answers.*.questionId')
          .optional()
          .isString()
          .isLength({ max: LENGTH_LIMITS.ID }),
        body('answers.*.answer')
          .optional()
          .isString()
          .isLength({ max: LENGTH_LIMITS.LONG_TEXT }),
      ],
    },
    
    updateStatus: {
      allowedFields: ['status'],
      validators: [
        commonValidators.enum('status', ALLOWED_VALUES.APPLICATION_STATUS, true),
      ],
    },
  },

  // Team invitation schemas
  teamInvitation: {
    send: {
      allowedFields: ['email', 'role'],
      validators: [
        commonValidators.email('email', true),
        commonValidators.enum('role', ALLOWED_VALUES.ORGANIZATION_ROLE, true),
      ],
    },
  },

  // Organization schemas
  organization: {
    update: {
      allowedFields: ['name', 'displayName', 'industry', 'companySize', 'branding', 'settings'],
      validators: [
        commonValidators.name('name', false)
          .isLength({ min: 2 })
          .withMessage('Name must be at least 2 characters'),
        commonValidators.name('displayName', false)
          .isLength({ min: 2 })
          .withMessage('Display name must be at least 2 characters'),
        commonValidators.shortText('industry'),
        commonValidators.shortText('companySize'),
        body('branding').optional().isObject(),
        body('settings').optional().isObject(),
      ],
    },
    
    upsertMember: {
      allowedFields: ['userId', 'role', 'status', 'permissions'],
      validators: [
        body('userId')
          .trim()
          .notEmpty()
          .withMessage('User ID is required')
          .isLength({ max: LENGTH_LIMITS.ID }),
        commonValidators.enum('role', ALLOWED_VALUES.ORGANIZATION_ROLE),
        commonValidators.enum('status', ALLOWED_VALUES.MEMBER_STATUS),
        body('permissions').optional().isArray(),
      ],
    },
  },

  // Admin schemas
  admin: {
    bootstrapAdmin: {
      allowedFields: ['email', 'password', 'fullName'],
      validators: [
        commonValidators.email('email', true),
        body('password')
          .isString()
          .isLength({ min: 6, max: LENGTH_LIMITS.PASSWORD })
          .withMessage('Password must be between 6 and 128 characters'),
        commonValidators.name('fullName', false),
      ],
    },
    
    seedAdmin: {
      allowedFields: ['email', 'uid', 'fullName'],
      validators: [
        commonValidators.email('email', true),
        body('uid')
          .trim()
          .notEmpty()
          .withMessage('Firebase UID is required')
          .isLength({ max: LENGTH_LIMITS.ID }),
        commonValidators.name('fullName', false),
      ],
    },
    
    rejectOrganization: {
      allowedFields: ['reason', 'reasonCode', 'reasonTags', 'reasonTagOther'],
      validators: [
        commonValidators.longText('reason', true),
        body('reason')
          .trim()
          .isLength({ min: 15 })
          .withMessage('Rejection reason must be at least 15 characters'),
        body('reasonCode')
          .optional()
          .trim()
          .toUpperCase()
          .isIn(ALLOWED_VALUES.REJECTION_REASON_CODE)
          .withMessage('Invalid rejection reason code'),
        body('reasonTags')
          .optional()
          .isArray({ max: 8 })
          .withMessage('Rejection reason tags must be an array (max 8 items)'),
        body('reasonTags.*')
          .optional()
          .isString()
          .trim()
          .toUpperCase()
          .isIn(ALLOWED_VALUES.REJECTION_REASON_CODE)
          .withMessage('One or more rejection reason tags are invalid'),
        body('reasonTagOther')
          .optional()
          .trim()
          .isLength({ min: 3, max: LENGTH_LIMITS.LONG_TEXT })
          .withMessage('Other tag details must be between 3 and 2000 characters'),
        body('reasonTagOther')
          .custom((value, { req }) => {
            const tags = Array.isArray(req.body?.reasonTags)
              ? req.body.reasonTags.map((tag) => (tag || '').toString().trim().toUpperCase())
              : [];
            if (tags.includes('OTHER') && (!value || !String(value).trim())) {
              throw new Error('Please provide details for the "Other" supporting tag');
            }
            return true;
          }),
      ],
    },
    
    suspendOrganization: {
      allowedFields: ['reason'],
      validators: [
        commonValidators.longText('reason', true),
      ],
    },

    updateUserStatus: {
      allowedFields: ['status', 'reason'],
      validators: [
        body('status')
          .trim()
          .toUpperCase()
          .isIn(ALLOWED_VALUES.USER_ACCOUNT_STATUS)
          .withMessage('Invalid user status'),
        body('reason')
          .optional()
          .trim()
          .isLength({ min: 5, max: LENGTH_LIMITS.LONG_TEXT })
          .withMessage('Reason must be between 5 and 2000 characters'),
        body('reason').custom((value, { req }) => {
          const status = (req.body?.status || '').toString().trim().toUpperCase();
          if (status === 'SUSPENDED' && (!value || !String(value).trim())) {
            throw new Error('Suspension reason is required');
          }
          return true;
        }),
      ],
    },
    
    updateSettings: {
      allowedFields: [
        'featureFlags',
        'maintenanceMode',
        'nonverbalFeedbackEnabled',
        'defaultAIConfig',
        'dataRetention',
        'structuredInterviewDefaults',
      ],
      validators: [
        body('featureFlags').optional().isObject(),
        commonValidators.boolean('maintenanceMode'),
        body('nonverbalFeedbackEnabled').optional().isBoolean(),
        body('defaultAIConfig').optional().isObject(),
        body('dataRetention').optional().isObject(),
        body('structuredInterviewDefaults').optional().isObject(),
      ],
    },

    questionCatalogImport: {
      allowedFields: ['sourceKey', 'source', 'dryRun', 'approve', 'batchLabel'],
      validators: [
        body('sourceKey').optional().isString().isLength({ min: 1, max: LENGTH_LIMITS.SHORT_TEXT }),
        body('source').optional().isString().isLength({ min: 1, max: LENGTH_LIMITS.SHORT_TEXT }),
        body('dryRun').optional().isBoolean(),
        body('approve').optional().isBoolean(),
        body('batchLabel').optional().isString().isLength({ max: LENGTH_LIMITS.SHORT_TEXT }),
      ],
    },

    questionCatalogReview: {
      allowedFields: ['reviewStatus', 'questionIds'],
      validators: [
        body('reviewStatus').isIn(['PENDING', 'APPROVED', 'REJECTED']),
        body('questionIds').optional().isArray({ min: 1, max: 500 }),
        body('questionIds.*').optional().isString().isLength({ max: LENGTH_LIMITS.ID }),
      ],
    },

    runDataRetentionCleanup: {
      allowedFields: ['dryRun', 'maxDocuments'],
      validators: [
        body('dryRun').optional().isBoolean(),
        body('maxDocuments')
          .optional()
          .toInt()
          .isInt({ min: 1, max: 1000 })
          .withMessage('maxDocuments must be between 1 and 1000'),
      ],
    },
  },

  // Billing schemas
  billing: {
    updateSubscription: {
      allowedFields: ['planId'],
      validators: [
        commonValidators.enum('planId', ALLOWED_VALUES.PLAN_ID, true),
      ],
    },
    
    cancelSubscription: {
      allowedFields: ['cancelAtPeriodEnd'],
      validators: [
        commonValidators.boolean('cancelAtPeriodEnd'),
      ],
    },
  },

  // Invitation schemas
  invitation: {
    create: {
      allowedFields: ['jobId', 'email', 'stage', 'expiresAt'],
      validators: [
        body('jobId')
          .trim()
          .notEmpty()
          .withMessage('Job ID is required')
          .isLength({ max: LENGTH_LIMITS.ID }),
        commonValidators.email('email', true),
        commonValidators.shortText('stage'),
        commonValidators.isoDate('expiresAt'),
      ],
    },
    
    accept: {
      allowedFields: ['token'],
      validators: [
        commonValidators.token('token'),
      ],
    },
  },

  // Review schemas
  review: {
    submit: {
      allowedFields: ['score', 'feedback', 'recommendation', 'notes'],
      validators: [
        commonValidators.integer('score', { min: 0, max: 100 }),
        commonValidators.longText('feedback'),
        commonValidators.shortText('recommendation'),
        commonValidators.longText('notes'),
      ],
    },
  },

  // GAP FEATURE: Saved Answer schemas
  savedAnswer: {
    create: {
      allowedFields: ['questionText', 'answer', 'interviewId', 'questionId', 'notes', 'tags', 'rating'],
      validators: [
        body('questionText')
          .trim()
          .notEmpty()
          .withMessage('Question text is required')
          .isLength({ max: LENGTH_LIMITS.LONG_TEXT }),
        body('answer')
          .trim()
          .notEmpty()
          .withMessage('Answer is required')
          .isLength({ max: LENGTH_LIMITS.VERY_LONG_TEXT }),
        body('interviewId')
          .optional()
          .trim()
          .isLength({ max: LENGTH_LIMITS.ID }),
        body('questionId')
          .optional()
          .trim()
          .isLength({ max: LENGTH_LIMITS.ID }),
        commonValidators.longText('notes'),
        body('tags')
          .optional()
          .isArray()
          .withMessage('Tags must be an array'),
        body('rating')
          .optional()
          .toInt()
          .isInt({ min: 1, max: 5 })
          .withMessage('Rating must be between 1 and 5'),
      ],
    },
    update: {
      allowedFields: ['notes', 'tags', 'rating'],
      validators: [
        commonValidators.longText('notes'),
        body('tags')
          .optional()
          .isArray()
          .withMessage('Tags must be an array'),
        body('rating')
          .optional()
          .toInt()
          .isInt({ min: 1, max: 5 })
          .withMessage('Rating must be between 1 and 5'),
      ],
    },
  },
};

// =============================================================================
// UTILITY EXPORTS
// =============================================================================

export {
  LENGTH_LIMITS,
  PATTERNS,
  ALLOWED_VALUES,
  sanitizeString,
  sanitizeObject,
  sanitizeStringArray,
  normalizeEmail,
};

export default {
  validateRequest,
  stripUnexpectedFields,
  commonValidators,
  validationSchemas,
  LENGTH_LIMITS,
  PATTERNS,
  ALLOWED_VALUES,
};
