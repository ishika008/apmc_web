// seedAdmin script and the real server entrypoint (src/index.js), each run as a child process against a throwaway database.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { URI, SKIP } from '../test-support/harness.js';

const serverDir = fileURLToPath(new URL('..', import.meta.url));
// Children run from an empty directory so dotenv cannot pick up the developer's real server/.env (which would
// supply the very variables these tests remove, or point at a non-test database).
const cwd = mkdtempSync(join(tmpdir(), 'apmc-script-'));
const SEED = join(serverDir, 'src/scripts/seedAdmin.js'), ENTRY = join(serverDir, 'src/index.js');
const dbName = 'apmc_scripts_' + Date.now();
const dbUri = () => { const u = new URL(URI); u.pathname = '/' + dbName; return u.toString(); };
const baseEnv = extra => ({ PATH: process.env.PATH, LOG_LEVEL: 'error', ...extra });
const seed = env => spawnSync(process.execPath, [SEED], { cwd, env: baseEnv(env), encoding: 'utf8' });
const GOOD = () => ({ MONGODB_URI: dbUri(), ADMIN_NAME: 'Root Admin', ADMIN_EMAIL: 'Root@Example.COM', ADMIN_PASSWORD: 'a-very-long-password' });

after(async () => {
  if (SKIP) return;
  await mongoose.connect(URI, { dbName }); await mongoose.connection.dropDatabase(); await mongoose.disconnect();
});

test('seedAdmin: refuses to run without all four variables', { skip: SKIP }, () => {
  for (const missing of ['MONGODB_URI', 'ADMIN_NAME', 'ADMIN_EMAIL', 'ADMIN_PASSWORD']) {
    const env = GOOD(); delete env[missing];
    const r = seed(env);
    assert.equal(r.status, 1, missing); assert.match(r.stderr, /Set MONGODB_URI, ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD/, missing);
  }
});

test('seedAdmin: rejects passwords shorter than 12 characters', { skip: SKIP }, () => {
  const r = seed({ ...GOOD(), ADMIN_PASSWORD: '12345678901' });
  assert.equal(r.status, 1); assert.match(r.stderr, /at least 12 characters/);
});

test('seedAdmin: creates one administrator with a bcrypt hash and a lowercased email; a second run refuses', { skip: SKIP }, async () => {
  const r = seed(GOOD());
  assert.equal(r.status, 0, r.stderr); assert.match(r.stdout, /Initial administrator created/);
  await mongoose.connect(URI, { dbName });
  try {
    const admins = await mongoose.connection.collection('users').find({ role: 'admin' }).toArray();
    assert.equal(admins.length, 1);
    assert.equal(admins[0].email, 'root@example.com'); assert.equal(admins[0].name, 'Root Admin'); assert.equal(admins[0].active, true);
    assert.ok(admins[0].passwordHash.startsWith('$2')); assert.notEqual(admins[0].passwordHash, 'a-very-long-password');
    assert.ok(await bcrypt.compare('a-very-long-password', admins[0].passwordHash));
  } finally { await mongoose.disconnect(); }
  const again = seed(GOOD());
  assert.equal(again.status, 1); assert.match(again.stderr, /administrator already exists/);
});

const freePort = () => new Promise(resolve => { const s = createServer().listen(0, () => { const { port } = s.address(); s.close(() => resolve(port)); }); });

test('server entrypoint boots, connects to MongoDB, serves /api/health and answers 401 on protected routes', { skip: SKIP, timeout: 30000 }, async () => {
  const port = await freePort();
  const child = spawn(process.execPath, [ENTRY], { cwd, env: baseEnv({ PORT: String(port), MONGODB_URI: dbUri(), JWT_SECRET: 'entrypoint-secret-entrypoint-secret', NODE_ENV: 'test', LOG_LEVEL: 'error' }) });
  let stderr = ''; child.stderr.on('data', d => { stderr += d; });
  try {
    let health;
    for (let i = 0; i < 60 && !health; i++) {
      try { const res = await fetch(`http://127.0.0.1:${port}/api/health`); const body = await res.json(); if (body.database === 'connected') health = body; } catch { /* not up yet */ }
      if (!health) await new Promise(r => setTimeout(r, 250));
    }
    assert.ok(health, 'server became healthy; stderr: ' + stderr);
    assert.equal(health.status, 'ok');
    assert.equal((await fetch(`http://127.0.0.1:${port}/api/yard/lots`)).status, 401);
    // The seeded administrator can log in through the real process end to end.
    const login = await fetch(`http://127.0.0.1:${port}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'root@example.com', password: 'a-very-long-password' }) });
    assert.equal(login.status, 200);
    const { token, user } = await login.json();
    assert.equal(user.role, 'admin');
    assert.equal((await fetch(`http://127.0.0.1:${port}/api/yard/users`, { headers: { Authorization: 'Bearer ' + token } })).status, 200);
  } finally { child.kill('SIGTERM'); await new Promise(r => child.once('exit', r)); }
});

test('server answers authentication requests with a clear 500 when JWT_SECRET is not configured', { skip: SKIP, timeout: 30000 }, async () => {
  const port = await freePort();
  const child = spawn(process.execPath, [ENTRY], { cwd, env: baseEnv({ PORT: String(port), MONGODB_URI: dbUri(), NODE_ENV: 'test', LOG_LEVEL: 'error' }) });
  try {
    let res;
    for (let i = 0; i < 60 && !res; i++) {
      try { res = await fetch(`http://127.0.0.1:${port}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'a@b.c', password: 'x' }) }); } catch { await new Promise(r => setTimeout(r, 250)); }
    }
    assert.equal(res.status, 500);
    assert.equal((await res.json()).message, 'Server authentication is not configured');
    const prot = await fetch(`http://127.0.0.1:${port}/api/auth/me`, { headers: { Authorization: 'Bearer abc' } });
    assert.equal(prot.status, 500);
  } finally { child.kill('SIGTERM'); await new Promise(r => child.once('exit', r)); }
});
