import test from 'node:test';
import assert from 'node:assert/strict';
import { addDays, dateKey } from '../src/utils/dates.js';
import { fail } from '../src/utils/httpError.js';
import { isId, escapeRegex } from '../src/utils/validation.js';
import { cleanPage } from '../src/utils/pagination.js';
import { asyncHandler } from '../src/utils/asyncHandler.js';
import { redact, logger } from '../src/utils/logger.js';

test('addDays adds whole and fractional days, accepts Date/ISO, defaults to 0', () => {
  const base = new Date('2026-01-01T00:00:00Z');
  assert.equal(addDays(base, 1).toISOString(), '2026-01-02T00:00:00.000Z');
  assert.equal(addDays(base, 0.5).toISOString(), '2026-01-01T12:00:00.000Z');
  assert.equal(addDays('2026-01-31T00:00:00Z', 1).toISOString(), '2026-02-01T00:00:00.000Z');
  assert.equal(addDays(base, undefined).getTime(), base.getTime());
  assert.equal(addDays(base, '2').toISOString(), '2026-01-03T00:00:00.000Z');
  assert.equal(addDays(base, -1).toISOString(), '2025-12-31T00:00:00.000Z');
  assert.notEqual(addDays(base, 1), base, 'does not mutate or return the input');
});

test('dateKey is a YYMMDD string in Asia/Kolkata', () => {
  assert.match(dateKey(), /^\d{6}$/);
  const ist = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: '2-digit', month: '2-digit', day: '2-digit' }).format(new Date()).replaceAll('-', '');
  assert.equal(dateKey(), ist);
});

test('fail builds an Error carrying the HTTP status', () => {
  const e = fail(418, 'teapot');
  assert.ok(e instanceof Error);
  assert.equal(e.status, 418);
  assert.equal(e.message, 'teapot');
});

test('isId accepts 24-hex ObjectIds only', () => {
  assert.equal(isId('507f1f77bcf86cd799439011'), true);
  for (const bad of ['', 'abc', '507f1f77bcf86cd79943901', '507f1f77bcf86cd79943901z', undefined, null, {}, [], 5, 0, 1e12, true]) assert.equal(isId(bad), false, String(bad));
});

test('escapeRegex escapes every regex metacharacter so input is matched literally', () => {
  const nasty = '.*+?^${}()|[]\\';
  assert.equal(new RegExp('^' + escapeRegex(nasty) + '$').test(nasty), true);
  assert.equal(new RegExp(escapeRegex('(a+)+$')).test('aaaa'), false);
  assert.equal(escapeRegex('plain'), 'plain');
  assert.equal(escapeRegex(''), '');
});

test('cleanPage: defaults, clamping and non-numeric input', () => {
  assert.deepEqual(cleanPage({ query: { page: '3', limit: '10' } }), { page: 3, limit: 10 });
  assert.deepEqual(cleanPage({ query: { page: 'x', limit: 'y' } }), { page: 1, limit: 25 });
  assert.deepEqual(cleanPage({ query: { page: '0', limit: '0' } }), { page: 1, limit: 25 }, '0 is falsy so defaults apply');
  assert.deepEqual(cleanPage({ query: { limit: '-5' } }), { page: 1, limit: 1 });
  assert.deepEqual(cleanPage({ query: { limit: '100' } }), { page: 1, limit: 100 });
  assert.deepEqual(cleanPage({ query: { limit: '101' } }), { page: 1, limit: 100 });
  assert.equal(cleanPage({ query: { page: '2.7' } }).page, 2.7, 'fractional pages are not floored (documented current behaviour)');
});

test('asyncHandler passes through successful handlers; synchronous throws are left to Express (all wrapped handlers are async)', async () => {
  let nextCalled = false;
  await asyncHandler(async (_q, res) => { res.ok = true; })({}, {}, () => { nextCalled = true; });
  assert.equal(nextCalled, false);
  const res = {};
  await asyncHandler((_q, r) => { r.sync = true; })({}, res, () => {});
  assert.equal(res.sync, true);
  // A non-async handler that throws synchronously is NOT converted to next(err) here; Express' own Layer try/catch handles that.
  assert.throws(() => asyncHandler(() => { throw new Error('sync boom'); })({}, {}, () => {}), /sync boom/);
  let err;
  await asyncHandler(() => Promise.reject(new Error('async boom')))({}, {}, e => { err = e; });
  assert.equal(err.message, 'async boom');
});

test('redact: depth limit, arrays, primitives, case-insensitive keys', () => {
  assert.equal(redact('s'), 's');
  assert.equal(redact(null), null);
  assert.deepEqual(redact([{ PASSWORD: 'x' }, 1]), [{ PASSWORD: '[REDACTED]' }, 1]);
  const keys = ['password', 'passwordHash', 'token', 'authorization', 'jwt', 'secret', 'jwt_secret', 'mongodb_uri', 'cookie', 'admin_password'];
  const out = redact(Object.fromEntries(keys.map(k => [k, 'v'])));
  for (const k of keys) assert.equal(out[k], '[REDACTED]', k);
  assert.equal(redact({ username: 'bob', passwordless: 'ok' }).passwordless, 'ok', 'only exact key names are redacted');
  let deep = { password: 'leak' };
  for (let i = 0; i < 8; i++) deep = { n: deep };
  assert.ok(JSON.stringify(redact(deep)).includes('leak'), 'beyond depth 5 values are returned untouched (documented limit)');
});

test('logger writes warn/error to stderr and info/debug to stdout, redacting meta, serialising errors', () => {
  const captured = { out: [], err: [] };
  const origLog = console.log, origErr = console.error;
  console.log = (...a) => captured.out.push(a);
  console.error = (...a) => captured.err.push(a);
  try {
    logger.error('failure', { error: Object.assign(new Error('bad'), { status: 500 }), token: 'abc' });
    logger.warn('careful', { password: 'p' });
    logger.info('hello', { a: 1 });
    logger.debug('dbg');
  } finally { console.log = origLog; console.error = origErr; }
  const flat = JSON.stringify(captured);
  assert.equal(captured.err.length, 2);
  assert.ok(flat.includes('failure') && flat.includes('careful'));
  assert.ok(!flat.includes('abc') && !flat.includes('"p"'), 'secrets are not logged');
  assert.ok(flat.includes('REDACTED'));
  assert.ok(flat.includes('bad'), 'error message serialised');
});
