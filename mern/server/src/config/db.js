import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

export function connectDatabase() {
  if (!env.mongodbUri) {
    logger.warn('MONGODB_URI missing. Set it in server/.env');
    return Promise.resolve();
  }
  return mongoose.connect(env.mongodbUri, { serverSelectionTimeoutMS: 10000 })
    .then(() => logger.info('MongoDB connected'))
    .catch(error => { logger.error('MongoDB connection failed', { error: new Error(error.message) }); process.exit(1); });
}
