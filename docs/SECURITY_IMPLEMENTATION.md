# Security Implementation Guide

This document describes the security measures implemented in the InterviewAI Pro application following OWASP best practices.

## Table of Contents

1. [Rate Limiting](#rate-limiting)
2. [Input Validation and Sanitization](#input-validation-and-sanitization)
3. [API Key Management](#api-key-management)
4. [HTTP Security Headers](#http-security-headers)
5. [Security Monitoring](#security-monitoring)

---

## Rate Limiting

### Overview

Rate limiting is implemented using `express-rate-limit` with endpoint-specific configurations to prevent abuse and protect against denial-of-service attacks.

### Configuration

Rate limits are defined in `server/src/middleware/rateLimiter.middleware.js`:

| Endpoint Type | Window | Max Requests | Notes |
|--------------|--------|--------------|-------|
| General API | 15 min | 100 | Baseline for all API endpoints |
| Authentication (Login) | 15 min | 10 | Stricter limit, skips successful requests |
| Registration | 1 hour | 5 | Prevents mass account creation |
| Email Check | 1 min | 10 | Prevents email enumeration |
| Email Verification | 1 hour | 5 | Prevents verification abuse |
| Interview Creation | 1 hour | 10 | Prevents resource abuse |
| Public Endpoints | 15 min | 200 | Higher limit for read-only |
| Newsletter | 1 hour | 3 | Prevents subscription spam |
| Contact Form | 1 hour | 5 | Prevents spam messages |
| File Upload | 15 min | 20 | Prevents upload abuse |
| Admin Bootstrap | 24 hours | 3 | Very strict for one-time setup |
| Team Invitations | 1 hour | 20 | Prevents invitation spam |
| Job Applications | 1 hour | 10 | Prevents application spam |

### 429 Response Format

All rate limit responses follow this format:

```json
{
  "success": false,
  "error": "Too many requests. Please try again later.",
  "code": "RATE_LIMIT_EXCEEDED",
  "retryAfter": 900,
  "retryAfterMs": 900000
}
```

The `Retry-After` header is also set for HTTP compliance.

---

## Input Validation and Sanitization

### Overview

Input validation is implemented in `server/src/middleware/inputValidation.middleware.js` using `express-validator` with schema-based validation.

### Validation Features

1. **Type Checking**: All inputs are validated for correct types
2. **Length Limits**: String inputs have maximum length limits
3. **Pattern Validation**: Regex patterns for emails, phones, URLs, etc.
4. **Enum Validation**: Whitelist of allowed values for enums
5. **Sanitization**: HTML escaping to prevent XSS attacks
6. **Field Whitelisting**: Unexpected fields are stripped from requests

### Length Limits

| Field Type | Max Length |
|------------|------------|
| Name | 100 |
| Email | 254 |
| Phone | 20 |
| Short Text | 100 |
| Medium Text | 500 |
| Long Text | 2,000 |
| Very Long Text | 5,000 |
| URL | 2,083 |
| ID | 128 |
| Token | 512 |

### Usage Example

```javascript
import { 
  validateRequest, 
  stripUnexpectedFields,
  validationSchemas,
} from '../middleware/inputValidation.middleware.js';

router.post(
  '/contact',
  stripUnexpectedFields(validationSchemas.contact.submit.allowedFields),
  validationSchemas.contact.submit.validators,
  validateRequest,
  ContactController.submit,
);
```

### Validation Error Response

```json
{
  "success": false,
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "errors": [
    {
      "field": "email",
      "message": "Valid email address is required"
    }
  ]
}
```

---

## API Key Management

### Overview

Secure configuration is managed in `server/src/config/secureConfig.js` with environment variable validation.

### Required Environment Variables

| Variable | Service | Sensitive |
|----------|---------|-----------|
| FIREBASE_DATABASE_URL | Firebase | No |
| FIREBASE_SERVICE_ACCOUNT | Firebase | Yes |
| EMAIL_VERIFICATION_CODE_SECRET | Auth | Yes |

### Optional Environment Variables

| Variable | Service | When Required |
|----------|---------|---------------|
| SENDGRID_API_KEY | Email | When EMAIL_PROVIDER=sendgrid |
| SMTP_PASS | Email | When EMAIL_PROVIDER=smtp |
| SIGHTENGINE_USER/SECRET | Moderation | For image moderation |

### Key Rotation Guidelines

1. **Firebase Service Account**
   - Rotate in Firebase Console > Project Settings > Service Accounts
   - Generate new private key, update environment, revoke old key

2. **SendGrid API Key**
   - Generate new key in SendGrid Dashboard > Settings > API Keys
   - Update environment variable
   - Revoke old key after confirming new key works

3. **SMTP Password (Gmail)**
   - Generate new App Password at myaccount.google.com/apppasswords
   - Update environment variable

### Best Practices

- Never commit secrets to version control
- Use different secrets for development, staging, and production
- Rotate keys every 90 days
- Use strong, randomly generated secrets: `openssl rand -base64 32`

---

## HTTP Security Headers

### Overview

Security headers are configured using Helmet in `server/src/middleware/security.middleware.js`.

### Headers Applied

| Header | Value | Purpose |
|--------|-------|---------|
| Content-Security-Policy | Restrictive policy | Prevents XSS |
| X-Frame-Options | DENY | Prevents clickjacking |
| X-Content-Type-Options | nosniff | Prevents MIME sniffing |
| X-XSS-Protection | 1; mode=block | XSS filter |
| Strict-Transport-Security | max-age=31536000 | Forces HTTPS |
| Referrer-Policy | strict-origin-when-cross-origin | Limits referrer info |
| X-Download-Options | noopen | IE security |
| X-Permitted-Cross-Domain-Policies | none | Flash/PDF policy |

### CORS Configuration

- Only configured frontend URL is allowed
- Credentials are allowed
- Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS
- Rate limit headers are exposed

---

## Security Monitoring

### Logging

Security events are logged with Winston:

1. **Rate Limit Violations**: IP, path, method, user ID
2. **Validation Failures**: Path, method, IP, failed fields
3. **Suspicious Requests**: Pattern matches for attacks

### Suspicious Pattern Detection

The following patterns are monitored:

- Path traversal: `../`
- XSS attempts: `<script`, `javascript:`, event handlers
- SQL injection: `union.*select`, `'.*or.*'`

### Audit Trail

For admin operations, the following are logged:
- Organization approval/rejection
- System settings changes
- User management actions

---

## Security Checklist

Before deploying to production:

- [ ] All environment variables are set
- [ ] No default secrets are used
- [ ] HTTPS is enabled
- [ ] Email provider is configured (not console)
- [ ] Rate limits are appropriate for expected traffic
- [ ] API keys have been rotated
- [ ] Error messages don't expose sensitive information
- [ ] Logging is configured for security monitoring
- [ ] CORS is restricted to production frontend URL

---

## References

- [OWASP REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
- [OWASP Denial of Service Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Denial_of_Service_Cheat_Sheet.html)
- [OWASP Cryptographic Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html)
