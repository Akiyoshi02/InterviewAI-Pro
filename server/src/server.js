// Load environment variables FIRST (this file loads .env)
import './config/env.js';

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import fs from 'fs';
import path from 'path';
import { setupRoutes } from './routes/index.js';
import { setupSocketIO } from './socket/interview.socket.js';
import { setupSecurity } from './middleware/security.middleware.js';
import { setupErrorHandling } from './middleware/error.middleware.js';
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

const uploadsPath = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
}
app.use('/uploads', express.static(uploadsPath));

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
  httpServer.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

httpServer.listen(PORT, () => {
  logger.info(`🚀 Server running on port ${PORT}`);
  logger.info(`📡 Socket.IO server ready`);
});
