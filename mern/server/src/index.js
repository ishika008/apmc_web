import { env } from './config/env.js';
import { connectDatabase } from './config/db.js';
import { createApp } from './app.js';
import { logger } from './utils/logger.js';

process.on('unhandledRejection', reason => logger.error('Unhandled promise rejection', { error: reason instanceof Error ? reason : new Error(String(reason)) }));
process.on('uncaughtException', error => { logger.error('Uncaught exception', { error }); process.exit(1); });

connectDatabase();
createApp().listen(env.port, () => logger.info(`APMC API listening on ${env.port}`, { port: env.port }));
