import 'dotenv/config';

/**
 * Central, read-once environment configuration.
 * Values and defaults mirror the previous inline `process.env` reads exactly.
 */
const isProduction = process.env.NODE_ENV === 'production';

export const env = Object.freeze({
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction,
  port: Number(process.env.PORT || 5000),
  mongodbUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET,
  clientOrigins: (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',').map(x => x.trim()),
  logLevel: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug')
});

export const JWT_ISSUER = 'apmc-yard';
export const JWT_AUDIENCE = 'apmc-yard-web';
export const JWT_EXPIRES_IN = '8h';
