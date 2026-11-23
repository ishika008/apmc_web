import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { boot, SKIP } from '../test-support/harness.js';

let h;
before(async () => { if (!SKIP) h = await boot('app'); });
after(async () => { if (!SKIP) await h.close(); });

test('GET /api/health reports ok + connected database + ISO timestamp, no auth needed', { skip: SKIP }, async () => {
  const r = await h.raw('GET', '/api/health');
  assert.equal(r.status, 200);
  assert.equal(r.body.status, 'ok'); assert.equal(r.body.service, 'apmc-yard-api'); assert.equal(r.body.database, 'connected');
  assert.equal(new Date(r.body.timestamp).toISOString(), r.body.timestamp);
});

test('security headers: helmet on, x-powered-by off', { skip: SKIP }, async () => {
  const r = await h.raw('GET', '/api/health');
  assert.equal(r.headers.get('x-powered-by'), null);
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  assert.ok(r.headers.get('strict-transport-security'));
  assert.ok(r.headers.get('content-security-policy'));
});

test('CORS: configured client origin is allowed, others are not', { skip: SKIP }, async () => {
  const good = await h.raw('GET', '/api/health', { headers: { Origin: 'http://localhost:5173' } });
  assert.equal(good.headers.get('access-control-allow-origin'), 'http://localhost:5173');
  const bad = await h.raw('GET', '/api/health', { headers: { Origin: 'https://evil.example' } });
  assert.equal(bad.headers.get('access-control-allow-origin'), null);
  const pre = await h.raw('OPTIONS', '/api/yard/lots', { headers: { Origin: 'http://localhost:5173', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization,content-type' } });
  assert.equal(pre.status, 204);
  assert.match(pre.headers.get('access-control-allow-headers') || '', /authorization/i);
});

test('unknown routes return a JSON 404', { skip: SKIP }, async () => {
  for (const path of ['/nope', '/api/nope', '/api/yard/nope']) {
    const r = await h.raw('GET', path, { token: h.tokens.admin });
    assert.equal(r.status, 404, path);
  }
  const r = await h.raw('GET', '/api/nope');
  assert.deepEqual(r.body, { message: 'API route not found' });
});

test('legacy, unmounted routers are not reachable through the app', { skip: SKIP }, async () => {
  for (const path of ['/api/lots', '/api/gate', '/api/gate-entries']) assert.equal((await h.raw('GET', path, { token: h.tokens.admin })).status, 404, path);
});

test('malformed JSON bodies are a client error (400), not a server error', { skip: SKIP }, async () => {
  const r = await h.raw('POST', '/api/auth/login', { headers: { 'Content-Type': 'application/json' }, rawBody: '{bad json' });
  assert.equal(r.status, 400);
});

test('bodies over the 1 MB limit are rejected with 413', { skip: SKIP }, async () => {
  const r = await h.raw('POST', '/api/yard/complaints', { token: h.tokens.admin, body: { details: 'x'.repeat(1_100_000) } });
  assert.equal(r.status, 413);
});

test('urlencoded bodies are accepted by the parser (login form post)', { skip: SKIP }, async () => {
  const r = await h.raw('POST', '/api/auth/login', { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, rawBody: 'email=a%40b.c' });
  assert.equal(r.status, 400, 'parsed, but password missing');
  assert.match(r.body.message, /required/);
});
