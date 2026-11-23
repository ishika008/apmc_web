// env.js reads process.env once at import, so each scenario runs in a fresh Node process.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const envModule = fileURLToPath(new URL('../src/config/env.js', import.meta.url));
const dbModule = fileURLToPath(new URL('../src/config/db.js', import.meta.url));
// Start from a clean slate so the developer's real server/.env (loaded by dotenv inside env.js from cwd) cannot leak in.
const run = (code, env = {}) => spawnSync(process.execPath, ['--input-type=module', '-e', code], {
  env: { PATH: process.env.PATH, ...env }, cwd: '/', encoding: 'utf8'
});
const readEnv = env => JSON.parse(run(`import { env, JWT_ISSUER, JWT_AUDIENCE, JWT_EXPIRES_IN } from ${JSON.stringify(envModule)}; console.log(JSON.stringify({ ...env, JWT_ISSUER, JWT_AUDIENCE, JWT_EXPIRES_IN }))`, env).stdout);

test('env defaults: development, port 5000, localhost client origin, debug logging', () => {
  const e = readEnv({});
  assert.equal(e.nodeEnv, 'development'); assert.equal(e.isProduction, false); assert.equal(e.port, 5000);
  assert.deepEqual(e.clientOrigins, ['http://localhost:5173']); assert.equal(e.logLevel, 'debug');
  assert.equal(e.jwtSecret, undefined); assert.equal(e.mongodbUri, undefined);
  assert.equal(e.JWT_ISSUER, 'apmc-yard'); assert.equal(e.JWT_AUDIENCE, 'apmc-yard-web'); assert.equal(e.JWT_EXPIRES_IN, '8h');
});

test('env: production flag, info log level default, explicit overrides and CSV origins', () => {
  const e = readEnv({ NODE_ENV: 'production', PORT: '8080', JWT_SECRET: 's', MONGODB_URI: 'mongodb://h/db', CLIENT_ORIGIN: 'https://a.in, https://b.in ', LOG_LEVEL: 'warn' });
  assert.equal(e.isProduction, true); assert.equal(e.port, 8080); assert.equal(e.jwtSecret, 's');
  assert.equal(e.mongodbUri, 'mongodb://h/db'); assert.deepEqual(e.clientOrigins, ['https://a.in', 'https://b.in']); assert.equal(e.logLevel, 'warn');
  assert.equal(readEnv({ NODE_ENV: 'production' }).logLevel, 'info');
});

test('env object is frozen', () => {
  const r = run(`import { env } from ${JSON.stringify(envModule)}; 'use strict'; let threw=false; try { env.port = 1 } catch { threw = true } console.log(JSON.stringify({ frozen: Object.isFrozen(env), port: env.port, threw }))`);
  const out = JSON.parse(r.stdout);
  assert.equal(out.frozen, true); assert.equal(out.port, 5000);
});

test('connectDatabase resolves with a warning (no crash) when MONGODB_URI is missing', () => {
  const r = run(`import { connectDatabase } from ${JSON.stringify(dbModule)}; await connectDatabase(); console.log('resolved')`);
  assert.equal(r.status, 0); assert.match(r.stdout, /resolved/);
  assert.match(r.stdout + r.stderr, /MONGODB_URI missing/);
});

test('connectDatabase exits non-zero when the database is unreachable', { timeout: 30000 }, () => {
  const r = run(`import { connectDatabase } from ${JSON.stringify(dbModule)}; await connectDatabase(); console.log('should not reach')`,
    { MONGODB_URI: 'mongodb://127.0.0.1:1/x?serverSelectionTimeoutMS=500', LOG_LEVEL: 'error' });
  assert.equal(r.status, 1);
  assert.doesNotMatch(r.stdout, /should not reach/);
  assert.match(r.stdout + r.stderr, /MongoDB connection failed/);
});
