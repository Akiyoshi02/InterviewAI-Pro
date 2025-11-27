import multer from 'multer';
import logger from '../utils/logger.js';

const { MulterError } = multer;

export function setupErrorHandling(app) {
  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      error: 'Not Found',
      message: `Cannot ${req.method} ${req.path}`,
    });
  });

  // Global error handler
  app.use((err, req, res, next) => {
    logger.error('Error:', {
      error: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
    });

    // Prisma errors
    if (err.code === 'P2002') {
      return res.status(409).json({
        error: 'Conflict',
        message: 'A record with this information already exists',
      });
    }

    if (err.code === 'P2025') {
      return res.status(404).json({
        error: 'Not Found',
        message: 'The requested record was not found',
      });
    }

    // Validation errors
    if (err.name === 'ValidationError') {
      return res.status(400).json({
        error: 'Validation Error',
        message: err.message,
      });
    }

    if (err instanceof MulterError) {
      let message = 'File upload failed.';
      if (err.code === 'LIMIT_FILE_SIZE') {
        message = 'Uploaded file exceeds the 10 MB size limit.';
      } else if (err.code === 'LIMIT_UNEXPECTED_FILE' && err.message) {
        message = err.message;
      } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        message = 'Unexpected upload field detected.';
      }

      return res.status(400).json({
        error: message,
      });
    }

    // Default error
    res.status(err.status || 500).json({
      error: err.message || 'Internal Server Error',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
  });
}
