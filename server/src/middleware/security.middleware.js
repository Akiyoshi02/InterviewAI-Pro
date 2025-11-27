import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

// Note: CSRF protection is not needed for JWT-based APIs
// JWT tokens in Authorization headers are already protected from CSRF attacks
// If you need CSRF protection for cookie-based auth, consider using a custom implementation

// Rate limiting configurations
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // Allow a few more retries before blocking
  message: 'Too many authentication attempts. Please wait 15 minutes and try again.',
  skipSuccessfulRequests: true,
  skip: (req) => {
    // Skip rate limiting for delete-unregistered-auth-user endpoint
    // This is a cleanup operation that may need to be called multiple times
    return req.path === '/delete-unregistered-auth-user';
  },
});

const interviewLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit interview creation to 10 per hour
  message: 'Too many interview sessions created, please try again later.',
});

export function setupSecurity(app) {
  // Helmet for security headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https://api.openai.com"],
      },
    },
    crossOriginEmbedderPolicy: false, // Required for WebRTC
  }));

  // CORS configuration
  app.use(cors({
    origin: process.env.FRONTEND_URL || "http://localhost:4028",
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  }));

  // Apply rate limiting
  app.use('/api/', apiLimiter);
  app.use('/api/auth/', authLimiter);
  app.use('/api/interviews/create', interviewLimiter);

  // CSRF protection note:
  // For JWT-based authentication (tokens in Authorization header), CSRF protection
  // is not typically required as the token is not stored in cookies.
  // CORS + rate limiting + Helmet provides sufficient protection for REST APIs.
  // If you need CSRF protection later, implement a custom solution compatible with ES modules.

  // Request logging
  app.use((req, res, next) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`${req.method} ${req.path}`);
    }
    next();
  });
}

export { apiLimiter, authLimiter, interviewLimiter };
