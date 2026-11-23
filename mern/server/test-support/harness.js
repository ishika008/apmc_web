// Shared helpers for integration tests. Lives outside `test/` so `node --test` does not run it as a test file.
// Every test file gets its own throwaway database on the replica set named by TEST_MONGODB_URI
// (transactions need a replica set), plus a real Express app on an ephemeral port. No mocks.
import jwt from 'jsonwebtoken';

export const URI = process.env.TEST_MONGODB_URI;
export const SKIP = !URI && 'TEST_MONGODB_URI not set';
export const SECRET = 'integration-test-secret-integration-test';
export const ROLES = ['admin', 'gate', 'auction', 'weighment', 'accounts', 'inspector'];

/**
 * Boots app + DB. Must be called from a `before()` hook (env.js reads process.env once, at import).
 * Returns helpers bound to this file's database and server.
 */
export async function boot(label = 'it') {
  process.env.JWT_SECRET = SECRET;
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'error';
  const mongoose = (await import('mongoose')).default;
  const dbName = `apmc_${label}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  await mongoose.connect(URI, { dbName });
  const models = await import('../src/models/index.js');
  await Promise.all(Object.values(models).map(m => m.init())); // build unique indexes before any test relies on them
  const { createApp } = await import('../src/app.js');
  const tokens = {}, users = {};
  for (const role of ROLES) {
    const u = await models.User.create({ name: `${role} user`, email: `${role}@t.io`, passwordHash: 'x'.repeat(20), role });
    users[role] = u;
    tokens[role] = sign(u.id);
  }
  const server = createApp().listen(0);
  await new Promise(r => server.once('listening', r));
  const origin = `http://127.0.0.1:${server.address().port}`;

  const raw = async (method, path, { token, body, headers = {}, rawBody } = {}) => {
    const h = { ...headers };
    if (token) h.Authorization = 'Bearer ' + token;
    let payload = rawBody;
    if (body !== undefined) { h['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
    const res = await fetch(origin + path, { method, headers: h, body: payload });
    const type = res.headers.get('content-type') || '';
    if (type.includes('json')) return { status: res.status, headers: res.headers, body: await res.json() };
    const bytes = Buffer.from(await res.arrayBuffer());
    return { status: res.status, headers: res.headers, bytes, body: bytes.toString('utf8') };
  };
  /** Authenticated call under /api/yard as `role`. */
  const call = (role, method, path, body) => raw(method, '/api/yard' + path, { token: tokens[role], body });

  const close = async () => {
    server.close();
    server.closeAllConnections?.();
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  };
  return { mongoose, models, tokens, users, origin, raw, call, close, createApp };
}

export const sign = (sub, opts = {}) =>
  jwt.sign({ sub }, opts.secret || SECRET, { issuer: 'apmc-yard', audience: 'apmc-yard-web', ...(opts.jwt || {}) });

/** Drives a lot through gate → auction → weighment. Returns ids and the weighment/bill bodies. */
export async function makeBilledLot(h, { commodity = 'ઘઉં', bags = 10, estimated = 50, rate = 2000, quantity = 20, gross = 25, tare = 5, buyerName, creditDays = 3, purchaseLimit = 0, farmerName = 'Test Farmer' } = {}) {
  let r = await h.call('gate', 'POST', '/lots', { farmerName, commodity, bags, estimated, mobile: '9879512041', village: 'V', vehicle: 'gj01ab1234' });
  if (r.status !== 201) throw new Error('lot create failed ' + JSON.stringify(r.body));
  const lot = r.body.item;
  const name = buyerName || 'Buyer ' + Math.random().toString(36).slice(2, 8);
  r = await h.call('accounts', 'POST', '/buyers', { name, registrationNo: 'REG-' + name, creditDays, purchaseLimit });
  if (r.status !== 201) throw new Error('buyer create failed ' + JSON.stringify(r.body));
  const buyer = r.body.item;
  r = await h.call('auction', 'POST', '/tickets', { lotId: lot._id, buyerId: buyer._id, rate, quantity });
  if (r.status !== 201) throw new Error('ticket create failed ' + JSON.stringify(r.body));
  const ticket = r.body.item;
  r = await h.call('weighment', 'POST', '/weighments', { lotId: lot._id, gross, tare });
  if (r.status !== 201) throw new Error('weighment failed ' + JSON.stringify(r.body));
  return { lot, buyer, ticket, weighment: r.body.item, bill: r.body.bill };
}
