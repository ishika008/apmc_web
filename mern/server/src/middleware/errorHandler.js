import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

export const notFound = (req, res) => res.status(404).json({ message: 'API route not found' });

export const errorHandler = (err, req, res, _next) => {
  // Mongoose ValidationError / CastError come from bad client input (out-of-range numbers, malformed values), not server faults.
  const status = Number(err.status) || (['ValidationError', 'CastError'].includes(err.name) ? 400 : 500);
  const meta = { method: req.method, path: req.originalUrl.split('?')[0], status, userId: req.user?.id, error: err };
  if (status >= 500) logger.error('Unhandled request error', meta);
  else logger.warn('Request rejected', { ...meta, error: undefined, reason: err.message });
  res.status(status).json({ message: status >= 500 && env.isProduction ? 'Internal server error' : err.message || 'Internal server error' });
};
