// Integration test against a real MongoDB replica set (transactions need one).
// Run with: TEST_MONGODB_URI="mongodb://127.0.0.1:27555/?replicaSet=rs0" npm test
// Skipped when TEST_MONGODB_URI is not set. Uses a throwaway database and drops it afterwards.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';

const URI = process.env.TEST_MONGODB_URI;
const skip = !URI && 'TEST_MONGODB_URI not set';
let base, server, mongoose, tokens = {}, ids = {};

before(async () => {
  if (skip) return;
  process.env.JWT_SECRET = 'integration-test-secret-integration-test';
  process.env.NODE_ENV = 'test';
  mongoose = (await import('mongoose')).default;
  await mongoose.connect(URI, { dbName: 'apmc_it_' + Date.now() });
  const { createApp } = await import('../src/app.js');
  const models = await import('../src/models/index.js');
  const { User } = models;
  // Unique indexes (e.g. one gate pass per lot) are built in the background; wait for them so the test does not race the index build.
  await Promise.all(Object.values(models).map(m => m.init()));
  const jwt = (await import('jsonwebtoken')).default;
  for (const role of ['admin', 'gate', 'auction', 'weighment', 'accounts', 'inspector']) {
    const u = await User.create({ name: role, email: role + '@t.io', passwordHash: 'x'.repeat(20), role });
    tokens[role] = jwt.sign({ sub: u.id }, process.env.JWT_SECRET, { issuer: 'apmc-yard', audience: 'apmc-yard-web' });
  }
  server = createApp().listen(0);
  base = `http://127.0.0.1:${server.address().port}/api/yard`;
});
after(async () => {
  if (skip) return;
  server?.close();
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

const call = async (role, method, path, body) => {
  const res = await fetch(base + path, { method, headers: { Authorization: 'Bearer ' + tokens[role], 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) });
  const type = res.headers.get('content-type') || '';
  if (type.includes('json')) return { status: res.status, body: await res.json() };
  const bytes = Buffer.from(await res.arrayBuffer());   // text() would silently drop the UTF-8 BOM
  return { status: res.status, bytes, body: bytes.toString('utf8') };
};

test('full yard workflow through the API', { skip }, async () => {
  let r = await call('gate', 'POST', '/lots', { farmerName: 'Ramesh', commodity: 'ઘઉં', bags: 10, estimated: 20, mobile: '9879512041', village: 'Kamrej', vehicle: 'gj05ab4821' });
  assert.equal(r.status, 201); ids.lot = r.body.item._id;
  r = await call('accounts', 'POST', '/buyers', { name: 'Patel Agro', registrationNo: 'TR-1', creditDays: 3, purchaseLimit: 500000 });
  assert.equal(r.status, 201); ids.buyer = r.body.item._id;
  assert.equal((await call('gate', 'POST', '/buyers', { name: 'x', registrationNo: 'y' })).status, 403);

  r = await call('auction', 'POST', '/tickets', { lotId: ids.lot, buyerId: ids.buyer, rate: 2500, quantity: 15 });
  assert.equal(r.status, 201); ids.ticket = r.body.item._id;

  // dashboard before weighment: provisional farmer due + trader exposure
  r = await call('admin', 'GET', '/dashboard');
  assert.equal(r.status, 200);
  assert.equal(r.body.status.inYard, 1);
  assert.equal(r.body.farmerDues[0].kind, 'provisional');
  assert.equal(r.body.farmerDues[0].balance, 37500);
  assert.equal(r.body.traderDues[0].due, 37500);
  assert.ok(r.body.activity.length >= 3, 'admin sees audit activity');
  assert.deepEqual((await call('gate', 'GET', '/dashboard')).body.activity, [], 'non-audit roles get no audit data');

  r = await call('weighment', 'POST', '/weighments', { lotId: ids.lot, gross: 18, tare: 3 });
  assert.equal(r.status, 201); ids.bill = r.body.bill._id;
  assert.equal(r.body.bill.grossAmount, 37500);

  r = await call('accounts', 'POST', '/payments', { billId: ids.bill, type: 'farmer_settlement', amount: 37500, mode: 'NEFT', reference: 'UTR123456' });
  assert.equal(r.status, 201);
  assert.equal((await call('accounts', 'POST', '/payments', { billId: ids.bill, type: 'farmer_settlement', amount: 1, mode: 'NEFT', reference: 'UTR999999' })).status, 409);
  r = await call('accounts', 'POST', '/payments', { billId: ids.bill, type: 'buyer_purchase', amount: 10000, mode: 'UPI', reference: 'UPI-0001' });
  assert.equal(r.status, 201);

  // buyer ledger additive fields
  r = await call('accounts', 'GET', '/buyers');
  const ledger = r.body.items[0].ledger;
  assert.equal(ledger.gross, 37500); assert.equal(ledger.paid, 10000);
  assert.equal(ledger.outstanding, 27500); assert.equal(ledger.exposure, 27500);
  assert.equal(ledger.limitFull, false); assert.equal(ledger.overdueCount, 0);

  // Farmer settled, no buyer dues, trader credit not yet overdue → pass may be issued, then dispatched.
  r = await call('gate', 'POST', `/gate-passes/${ids.lot}/issue`, {});
  assert.equal(r.status, 201); ids.pass = r.body.item._id;
  assert.equal((await call('gate', 'POST', `/gate-passes/${ids.lot}/issue`, {})).status, 409, 'second pass for same lot is rejected');
  r = await call('gate', 'POST', `/gate-passes/${ids.pass}/dispatch`, {});
  assert.equal(r.status, 200);
  assert.equal((await call('admin', 'GET', '/dashboard')).body.status.dispatched, 1);
});

test('search finds lots and tickets, escapes regex input', { skip }, async () => {
  let r = await call('inspector', 'GET', '/search?q=ramesh');
  assert.equal(r.status, 200);
  assert.equal(r.body.lots.length, 1);
  assert.equal(r.body.tickets.length, 1);
  r = await call('inspector', 'GET', '/search?q=' + encodeURIComponent('.*'));
  assert.equal(r.body.lots.length, 0, 'regex metacharacters are literal');
  assert.deepEqual((await call('inspector', 'GET', '/search?q=a')).body, { lots: [], tickets: [] });
});

test('nav counts and report catalog are computed from data', { skip }, async () => {
  const counts = (await call('gate', 'GET', '/nav-counts')).body;
  assert.equal(counts.openComplaints, 0);
  assert.equal(counts.auctionQueue, 0);
  const cat = (await call('admin', 'GET', '/reports/catalog')).body;
  assert.equal(cat.counts.lots, 1); assert.equal(cat.counts.bills, 1);
  assert.equal(cat.kpis.averageRate, 2500); assert.equal(cat.kpis.grossSales, 37500);
});

test('CSV export: content, escaping and role guard', { skip }, async () => {
  await call('admin', 'POST', '/complaints', { complainant: '=cmd|calc', type: 'Weight', details: 'He said "wrong", please check' });
  let r = await call('weighment', 'GET', '/reports/export/complaints');
  assert.equal(r.status, 200);
  assert.ok(r.body.startsWith('﻿"Complaint"'));
  assert.ok(r.body.includes(`"'=cmd|calc"`), 'formula injection neutralised');
  assert.ok(r.body.includes('"He said ""wrong"", please check"'));
  r = await call('weighment', 'GET', '/reports/export/audit');
  assert.equal(r.status, 403);
  assert.equal((await call('inspector', 'GET', '/reports/export/audit')).status, 200);
  assert.equal((await call('admin', 'GET', '/reports/export/nope')).status, 404);
  assert.equal((await call('admin', 'GET', '/reports/export/lots')).body.split('\r\n')[1].includes('Ramesh'), true);
});
