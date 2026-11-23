// NOTE: the login rate limiter (8 / 15 min) is module-level, so this file keeps to <= 7 login calls.
// The limiter itself is exercised in limiter.integration.test.js (separate process).
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { boot, sign, SKIP, SECRET } from '../test-support/harness.js';

let h, active, inactive;
const PASSWORD = 'correct horse battery';

before(async () => {
  if (SKIP) return;
  h = await boot('auth');
  const passwordHash = await bcrypt.hash(PASSWORD, 4);
  active = await h.models.User.create({ name: 'Login User', email: 'login@t.io', passwordHash, role: 'accounts' });
  inactive = await h.models.User.create({ name: 'Gone', email: 'gone@t.io', passwordHash, role: 'gate', active: false });
});
after(async () => { if (!SKIP) await h.close(); });

const login = body => h.raw('POST', '/api/auth/login', { body });
const me = token => h.raw('GET', '/api/auth/me', { token });

test('login succeeds, returns a verifiable JWT and the public user; never leaks the hash', { skip: SKIP }, async () => {
  const before = Date.now();
  const r = await login({ email: 'login@t.io', password: PASSWORD });
  assert.equal(r.status, 200);
  assert.deepEqual(Object.keys(r.body.user).sort(), ['email', 'id', 'name', 'role']);
  assert.equal(r.body.user.role, 'accounts');
  assert.ok(!JSON.stringify(r.body).includes('passwordHash'));
  const payload = jwt.verify(r.body.token, SECRET, { issuer: 'apmc-yard', audience: 'apmc-yard-web' });
  assert.equal(payload.sub, active.id);
  assert.ok(payload.exp - payload.iat === 8 * 3600, 'token lives 8 hours');
  const fresh = await h.models.User.findById(active.id);
  assert.ok(fresh.lastLoginAt.getTime() >= before - 1000, 'lastLoginAt updated');
  assert.equal((await me(r.body.token)).status, 200, 'issued token is accepted by /me');
});

test('login normalises email case and whitespace', { skip: SKIP }, async () => {
  const r = await login({ email: '  LOGIN@T.IO ', password: PASSWORD });
  assert.equal(r.status, 200);
});

test('login rejects wrong password and unknown user with the same generic message (no user enumeration)', { skip: SKIP }, async () => {
  const bad = await login({ email: 'login@t.io', password: 'wrong' });
  const unknown = await login({ email: 'nobody@t.io', password: PASSWORD });
  assert.equal(bad.status, 401); assert.equal(unknown.status, 401);
  assert.deepEqual(bad.body, unknown.body);
  assert.equal(bad.body.message, 'Invalid email or password');
});

test('login rejects inactive accounts even with the right password', { skip: SKIP }, async () => {
  const r = await login({ email: 'gone@t.io', password: PASSWORD });
  assert.equal(r.status, 401);
});

test('login validates presence of email and password', { skip: SKIP }, async () => {
  assert.equal((await login({ email: 'login@t.io' })).status, 400);
});

test('login rejects non-string passwords with 400 instead of crashing (bcrypt throws on a number)', { skip: SKIP }, async () => {
  const r = await login({ email: 'login@t.io', password: 12345678 });
  assert.equal(r.status, 400, JSON.stringify(r.body));
  assert.ok(!/Illegal arguments/.test(JSON.stringify(r.body)), 'no internal error detail leaks');
});

test('login is not vulnerable to operator injection in the email field', { skip: SKIP }, async () => {
  const r = await login({ email: { $ne: '' }, password: PASSWORD });
  assert.equal(r.status, 400);
  assert.equal(r.body.token, undefined);
});

test('/me returns the caller profile (and only that)', { skip: SKIP }, async () => {
  const r = await me(h.tokens.inspector);
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.user, { id: h.users.inspector.id, name: 'inspector user', email: 'inspector@t.io', role: 'inspector', active: true });
});

test('protected routes reject missing, malformed and non-Bearer credentials with 401', { skip: SKIP }, async () => {
  for (const headers of [{}, { Authorization: '' }, { Authorization: 'Bearer' }, { Authorization: 'Bearer ' }, { Authorization: 'Basic abc' }, { Authorization: 'bearer ' + h.tokens.admin }, { Authorization: h.tokens.admin }]) {
    const r = await h.raw('GET', '/api/auth/me', { headers });
    assert.equal(r.status, 401, JSON.stringify(headers));
  }
  assert.equal((await me('not.a.jwt')).status, 401);
  assert.equal((await h.raw('GET', '/api/yard/lots')).status, 401);
});

test('tokens with wrong secret, issuer, audience, expiry or alg=none are rejected', { skip: SKIP }, async () => {
  const sub = h.users.admin.id;
  const cases = {
    'wrong secret': sign(sub, { secret: 'another-secret-another-secret-123' }),
    'wrong issuer': sign(sub, { jwt: { issuer: 'evil' } }),
    'wrong audience': sign(sub, { jwt: { audience: 'other' } }),
    expired: jwt.sign({ sub, exp: Math.floor(Date.now() / 1000) - 60 }, SECRET, { issuer: 'apmc-yard', audience: 'apmc-yard-web' }),
    'alg none': (() => { const b = o => Buffer.from(JSON.stringify(o)).toString('base64url'); return `${b({ alg: 'none', typ: 'JWT' })}.${b({ sub, iss: 'apmc-yard', aud: 'apmc-yard-web' })}.`; })()
  };
  for (const [name, token] of Object.entries(cases)) {
    const r = await me(token);
    assert.equal(r.status, 401, name);
    assert.equal(r.body.message, 'Invalid or expired token', name);
  }
});

test('a valid token stops working once the user is deactivated or deleted', { skip: SKIP }, async () => {
  const u = await h.models.User.create({ name: 'Temp', email: 'temp@t.io', passwordHash: 'x'.repeat(20), role: 'gate' });
  const token = sign(u.id);
  assert.equal((await me(token)).status, 200);
  await h.models.User.updateOne({ _id: u._id }, { active: false });
  const r = await me(token);
  assert.equal(r.status, 401); assert.match(r.body.message, /inactive|no longer exists/);
  await h.models.User.deleteOne({ _id: u._id });
  assert.equal((await me(token)).status, 401);
  assert.equal((await me(sign(inactive.id))).status, 401, 'inactive user token is refused');
});

test('role changes take effect immediately (role is read from the database, not the token)', { skip: SKIP }, async () => {
  const u = await h.models.User.create({ name: 'Promo', email: 'promo@t.io', passwordHash: 'x'.repeat(20), role: 'inspector' });
  const token = sign(u.id);
  assert.equal((await h.raw('GET', '/api/yard/users', { token })).status, 403);
  await h.models.User.updateOne({ _id: u._id }, { role: 'admin' });
  assert.equal((await h.raw('GET', '/api/yard/users', { token })).status, 200);
});
