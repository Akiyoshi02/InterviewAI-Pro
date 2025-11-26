import logger from '../utils/logger.js';

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

    // Default error
    res.status(err.status || 500).json({
      error: err.message || 'Internal Server Error',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
  });
}
