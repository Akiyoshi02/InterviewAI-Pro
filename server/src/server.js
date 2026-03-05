/**
 * Server Entry Point
 * 
 * Initializes the Express application with:
 * - Secure configuration validation
 * - Security middleware (Helmet, CORS, rate limiting)
 * - Route handling with input validation
 * - Error handling
 * - WebSocket support
 */

// Load environment variables FIRST (this file loads .env)
import './config/env.js';
import * as Sentry from '@sentry/node';

// Validate environment configuration
import { initializeSecureConfig } from './config/secureConfig.js';
initializeSecureConfig();

// Initialise Sentry before anything else (if DSN configured)
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.APP_VERSION || '1.0.0',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  });
}

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { setupRoutes } from './routes/index.js';
import { setupSocketIO } from './socket/interview.socket.js';
import { setupSecurity } from './middleware/security.middleware.js';
import { setupErrorHandling } from './middleware/error.middleware.js';
import { LLMService } from './services/llm.service.js';
import { startMeetingLinkScheduler, stopMeetingLinkScheduler } from './services/meetingLinkScheduler.service.js';
import logger from './utils/logger.js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:4028",
    credentials: true
  }
});

export { io };

// Security middleware
setupSecurity(app);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

const uploadsPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'uploads');
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
}
const uploadsAccessMode = String(process.env.UPLOADS_ACCESS_MODE || 'PUBLIC').trim().toUpperCase();
if (uploadsAccessMode === 'PUBLIC') {
  app.use('/uploads', express.static(uploadsPath));
} else {
  logger.info(`Uploads static route disabled (UPLOADS_ACCESS_MODE=${uploadsAccessMode}). Use signed object-storage URLs.`);
}

// Routes
setupRoutes(app);

// Socket.IO setup
setupSocketIO(io);

// Error handling (must be last)
setupErrorHandling(app);

const PORT = process.env.PORT || 3000;

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down gracefully...');
  stopMeetingLinkScheduler();
  httpServer.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

httpServer.listen(PORT, () => {
  logger.info(`🚀 Server running on port ${PORT}`);
  logger.info(`📡 Socket.IO server ready`);
  startMeetingLinkScheduler();

  const enableWarmup = String(process.env.OLLAMA_WARMUP_ON_BOOT ?? (process.env.NODE_ENV === 'production' ? 'false' : 'true'))
    .toLowerCase() === 'true';
  if (enableWarmup) {
    void LLMService.warmUp()
      .then((result) => {
        if (result?.ok) {
          logger.info(`🤖 Ollama warm-up complete for model ${result.model}`);
        } else {
          logger.warn(`⚠️ Ollama warm-up skipped/unavailable: ${result?.error || 'unknown error'}`);
        }
      })
      .catch((error) => {
        logger.warn(`⚠️ Ollama warm-up failed: ${error?.message || String(error)}`);
      });
  }
});
