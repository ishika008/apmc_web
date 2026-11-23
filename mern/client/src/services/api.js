import { logger } from '../utils/logger.js';
import { t, translateServerMessage } from '../i18n/index.js';

const SESSION_KEY = 'apmc_yard_session_v1';
export function getSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; }
}
export function setSession(value) { localStorage.setItem(SESSION_KEY, JSON.stringify(value)); }
export function clearSession() { localStorage.removeItem(SESSION_KEY); }
export async function api(path, options = {}) {
  const session = getSession();
  const headers = { ...(options.headers || {}) };
  if (session?.token) headers.Authorization = `Bearer ${session.token}`;
  if (options.body && !(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const response = await fetch(`/api${path}`, { ...options, headers, body: options.body && typeof options.body !== 'string' && !(options.body instanceof FormData) ? JSON.stringify(options.body) : options.body });
  const payload = await response.json().catch(() => ({}));
  if (response.status === 401) {
    clearSession();
    window.dispatchEvent(new CustomEvent('apmc:auth-expired'));
  }
  if (!response.ok) {
    logger.warn('API request failed', { method: options.method || 'GET', path: path.split('?')[0], status: response.status });
    throw new Error(payload.message ? translateServerMessage(payload.message) : t('server.requestFailed', { status: response.status }));
  }
  return payload;
}

/** Authenticated download (CSV exports) — the token cannot travel via a plain <a href>. */
export async function downloadFile(path, fallbackName = 'download.csv') {
  const session = getSession();
  const response = await fetch(`/api${path}`, { headers: session?.token ? { Authorization: `Bearer ${session.token}` } : {} });
  if (response.status === 401) { clearSession(); window.dispatchEvent(new CustomEvent('apmc:auth-expired')); }
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.message ? translateServerMessage(payload.message) : t('server.downloadFailed', { status: response.status }));
  }
  const blob = await response.blob();
  const name = /filename="([^"]+)"/.exec(response.headers.get('content-disposition') || '')?.[1] || fallbackName;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = name; link.click();
  URL.revokeObjectURL(url);
}
