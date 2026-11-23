import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import healthRoutes from './routes/health.routes.js';
import authRoutes from './routes/auth.routes.js';
import yardRoutes from './routes/yard.routes.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

/** Builds the Express application (no network or database side effects). */
export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: env.clientOrigins, credentials: false }));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));
  app.use(morgan(env.isProduction ? 'combined' : 'dev', env.isProduction ? { stream: { write: line => logger.info(line.trim(), { source: 'http' }) } } : undefined));
  app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: env.isProduction ? 300 : 5000, standardHeaders: true, legacyHeaders: false }));

  app.use('/api/health', healthRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/yard', yardRoutes);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
