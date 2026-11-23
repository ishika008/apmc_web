/**
 * Minimal structured logger (one JSON line per event in production,
 * readable text in development). Sensitive fields are redacted at any depth.
 */
const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const SENSITIVE = /^(password|passwordhash|token|authorization|jwt|secret|jwt_secret|mongodb_uri|cookie|admin_password)$/i;
const threshold = LEVELS[process.env.LOG_LEVEL] || (process.env.NODE_ENV === 'production' ? LEVELS.info : LEVELS.debug);
const json = process.env.NODE_ENV === 'production';

export function redact(value, depth = 0) {
  if (value === null || typeof value !== 'object' || depth > 5) return value;
  if (Array.isArray(value)) return value.map(v => redact(v, depth + 1));
  const out = {};
  for (const [key, val] of Object.entries(value)) out[key] = SENSITIVE.test(key) ? '[REDACTED]' : redact(val, depth + 1);
  return out;
}

function serialiseError(error) {
  if (!(error instanceof Error)) return error;
  return { name: error.name, message: error.message, status: error.status, code: error.code, stack: error.stack };
}

function write(level, message, meta = {}) {
  if (LEVELS[level] < threshold) return;
  const safe = redact({ ...meta, ...(meta.error ? { error: serialiseError(meta.error) } : {}) });
  const entry = { time: new Date().toISOString(), level, message, ...safe };
  const stream = level === 'error' || level === 'warn' ? console.error : console.log;
  if (json) stream(JSON.stringify(entry));
  else stream(`[${entry.time}] ${level.toUpperCase()} ${message}`, Object.keys(safe).length ? safe : '');
}

export const logger = {
  debug: (m, meta) => write('debug', m, meta),
  info: (m, meta) => write('info', m, meta),
  warn: (m, meta) => write('warn', m, meta),
  error: (m, meta) => write('error', m, meta)
};
