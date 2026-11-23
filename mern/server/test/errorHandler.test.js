// Runs in development mode (NODE_ENV unset in the runner): error messages are passed through.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { notFound, errorHandler } from '../src/middleware/errorHandler.js';
import { allowRoles } from '../src/middleware/auth.js';

const fakeRes = () => ({ code: null, payload: null, status(c) { this.code = c; return this; }, json(p) { this.payload = p; return this; } });
const req = { method: 'GET', originalUrl: '/api/x?y=1', user: { id: 'u1' } };
const quiet = fn => { const e = console.error; console.error = () => {}; try { return fn(); } finally { console.error = e; } };

test('notFound answers 404 JSON', () => {
  const res = fakeRes(); notFound(req, res);
  assert.equal(res.code, 404); assert.deepEqual(res.payload, { message: 'API route not found' });
});

test('errorHandler uses err.status and message for 4xx', () => {
  const res = fakeRes(); quiet(() => errorHandler(Object.assign(new Error('nope'), { status: 409 }), req, res, () => {}));
  assert.equal(res.code, 409); assert.deepEqual(res.payload, { message: 'nope' });
});

test('errorHandler defaults to 500 when status missing or not numeric', () => {
  for (const status of [undefined, 'abc', 0, null]) {
    const res = fakeRes(); quiet(() => errorHandler(Object.assign(new Error('boom'), { status }), req, res, () => {}));
    assert.equal(res.code, 500, String(status));
  }
});

test('errorHandler treats Mongoose ValidationError / CastError as client errors (400); an explicit status still wins', () => {
  for (const name of ['ValidationError', 'CastError']) {
    const res = fakeRes(); quiet(() => errorHandler(Object.assign(new Error(name + ' detail'), { name }), req, res, () => {}));
    assert.equal(res.code, 400, name); assert.equal(res.payload.message, name + ' detail');
  }
  const res = fakeRes(); quiet(() => errorHandler(Object.assign(new Error('x'), { name: 'ValidationError', status: 422 }), req, res, () => {}));
  assert.equal(res.code, 422);
  const other = fakeRes(); quiet(() => errorHandler(Object.assign(new Error('x'), { name: 'MongoServerError' }), req, other, () => {}));
  assert.equal(other.code, 500);
});

test('errorHandler falls back to a generic message when the error has none', () => {
  const res = fakeRes(); quiet(() => errorHandler({ status: 500 }, req, res, () => {}));
  assert.equal(res.payload.message, 'Internal server error');
});

test('errorHandler hides 5xx detail in production but keeps 4xx detail', () => {
  const mod = fileURLToPath(new URL('../src/middleware/errorHandler.js', import.meta.url));
  const code = `import { errorHandler } from ${JSON.stringify(mod)};
    const r = () => ({ status(c){this.c=c;return this}, json(p){this.p=p;return this} });
    const a = r(), b = r();
    errorHandler(Object.assign(new Error('secret db detail'), { status: 500 }), { method:'GET', originalUrl:'/x' }, a);
    errorHandler(Object.assign(new Error('bad input'), { status: 400 }), { method:'GET', originalUrl:'/x' }, b);
    console.log(JSON.stringify([a.c, a.p, b.c, b.p]));`;
  const out = spawnSync(process.execPath, ['--input-type=module', '-e', code], { env: { PATH: process.env.PATH, NODE_ENV: 'production', LOG_LEVEL: 'error' }, encoding: 'utf8', cwd: '/' });
  const line = out.stdout.trim().split('\n').pop();
  assert.deepEqual(JSON.parse(line), [500, { message: 'Internal server error' }, 400, { message: 'bad input' }]);
});

test('allowRoles lets listed roles through and returns 403 for others, including no user', () => {
  const guard = allowRoles('admin', 'gate');
  let nexted = 0; const next = () => nexted++;
  guard({ user: { role: 'gate' } }, fakeRes(), next);
  assert.equal(nexted, 1);
  for (const user of [{ role: 'auction' }, { role: undefined }, undefined]) {
    const res = fakeRes();
    quiet(() => guard({ user, method: 'POST', originalUrl: '/api/yard/lots?x=1' }, res, next));
    assert.equal(res.code, 403); assert.equal(res.payload.message, 'You do not have permission for this action');
  }
  assert.equal(nexted, 1);
});
