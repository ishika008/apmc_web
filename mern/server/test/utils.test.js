import test from 'node:test';
import assert from 'node:assert/strict';
import { redact } from '../src/utils/logger.js';
import { asyncHandler } from '../src/utils/asyncHandler.js';
import { fail } from '../src/utils/httpError.js';
import { cleanPage } from '../src/utils/pagination.js';
import { escapeRegex } from '../src/utils/validation.js';

test('logger redacts sensitive keys at any depth without mutating input', () => {
  const input = { email: 'a@b.c', password: 'x', nested: { token: 'y', list: [{ Authorization: 'z', ok: 1 }] } };
  const out = redact(input);
  assert.equal(out.password, '[REDACTED]');
  assert.equal(out.nested.token, '[REDACTED]');
  assert.equal(out.nested.list[0].Authorization, '[REDACTED]');
  assert.equal(out.nested.list[0].ok, 1);
  assert.equal(input.password, 'x');
});

test('asyncHandler forwards rejections to next()', async () => {
  const boom = fail(409, 'nope');
  let received;
  await asyncHandler(async () => { throw boom; })({}, {}, e => { received = e; });
  assert.equal(received, boom);
  assert.equal(received.status, 409);
});

test('cleanPage clamps page and limit', () => {
  assert.deepEqual(cleanPage({ query: { page: '-4', limit: '9999' } }), { page: 1, limit: 100 });
  assert.deepEqual(cleanPage({ query: {} }), { page: 1, limit: 25 });
});

test('escapeRegex neutralises regex metacharacters', () => {
  assert.equal(new RegExp(escapeRegex('a.b(c)*')).test('a.b(c)*'), true);
  assert.equal(new RegExp(escapeRegex('a.b')).test('axb'), false);
});
