import { vi } from 'vitest';
/**
 * Stubs ONLY the network boundary (global fetch). `routes` maps "METHOD /path" (path without /api
 * prefix and query string optional) to a body, a status/body pair or a function(req) => same.
 * Every call is recorded in `fetch.calls` as { method, path, body, headers }.
 */
export function mockFetch(routes = {}) {
  const calls = [];
  const fn = vi.fn(async (url, init = {}) => {
    const method = (init.method || 'GET').toUpperCase();
    const path = String(url).replace(/^\/api/, '');
    const body = typeof init.body === 'string' ? JSON.parse(init.body) : init.body;
    const req = { method, path, body, headers: init.headers || {} };
    calls.push(req);
    const key = Object.keys(routes).find(k => k === method + ' ' + path) || Object.keys(routes).find(k => k === method + ' ' + path.split('?')[0]);
    if (!key) return jsonResponse(404, { message: 'No mock for ' + method + ' ' + path });
    let r = routes[key];
    if (typeof r === 'function') r = await r(req);
    if (r instanceof Response) return r;
    if (r && typeof r === 'object' && 'status' in r && 'body' in r) return jsonResponse(r.status, r.body);
    return jsonResponse(200, r);
  });
  fn.calls = calls;
  vi.stubGlobal('fetch', fn);
  return fn;
}
export const jsonResponse = (status, body, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
