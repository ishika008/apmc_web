/**
 * Lightweight client logger. Redacts sensitive keys, keeps debug output out of
 * production builds, and is the single place to hook a monitoring service
 * (e.g. Sentry / CloudWatch RUM) later.
 */
const SENSITIVE = /^(password|passwordhash|token|authorization|secret)$/i;
const isProd = import.meta.env.PROD;

const redact = (value, depth = 0) => {
  if (value === null || typeof value !== 'object' || depth > 4) return value;
  if (Array.isArray(value)) return value.map(v => redact(v, depth + 1));
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, SENSITIVE.test(k) ? '[REDACTED]' : redact(v, depth + 1)]));
};

const emit = (level, message, meta) => {
  if (level === 'debug' && isProd) return;
  console[level](`[apmc] ${message}`, meta ? redact(meta) : '');
};

export const logger = {
  debug: (message, meta) => emit('debug', message, meta),
  info: (message, meta) => emit('info', message, meta),
  warn: (message, meta) => emit('warn', message, meta),
  error: (message, meta) => emit('error', message, meta)
};
