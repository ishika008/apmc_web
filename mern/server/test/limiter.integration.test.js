// Own file => own process => own copy of the module-level login limiter.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { boot, SKIP } from '../test-support/harness.js';

let h;
before(async () => { if (!SKIP) h = await boot('limiter'); });
after(async () => { if (!SKIP) await h.close(); });

test('login is limited to 8 attempts per window, then answers 429 with a clear message and RateLimit headers', { skip: SKIP }, async () => {
  const statuses = [];
  for (let i = 0; i < 8; i++) statuses.push((await h.raw('POST', '/api/auth/login', { body: { email: 'x@t.io', password: 'nope' } })).status);
  assert.deepEqual(statuses, Array(8).fill(401));
  const blocked = await h.raw('POST', '/api/auth/login', { body: { email: 'x@t.io', password: 'nope' } });
  assert.equal(blocked.status, 429);
  assert.equal(blocked.body.message, 'Too many login attempts. Try again in 15 minutes.');
  assert.ok(blocked.headers.get('ratelimit-limit') || blocked.headers.get('ratelimit'), 'standard rate limit headers present');
  assert.equal(blocked.headers.get('x-ratelimit-limit'), null, 'legacy headers are off');
});

test('the login limiter does not throttle other endpoints', { skip: SKIP }, async () => {
  assert.equal((await h.raw('GET', '/api/health')).status, 200);
  assert.equal((await h.raw('GET', '/api/auth/me', { token: h.tokens.admin })).status, 200);
});

test('the global /api limiter allows 300 requests per window then answers 429', { skip: SKIP, timeout: 60000 }, async () => {
  let ok = 0, limited = 0;
  // 10 requests were already counted by earlier tests in this file (8 logins + 1 blocked + 2 above = 11).
  for (let i = 0; i < 300; i++) {
    const r = await h.raw('GET', '/api/health');
    if (r.status === 200) ok++; else if (r.status === 429) limited++;
  }
  assert.ok(limited > 0, 'some requests were limited');
  assert.ok(ok >= 280 && ok < 300, `about 300 minus those already used, got ${ok}`);
  const r = await h.raw('GET', '/api/health');
  assert.equal(r.status, 429);
});
