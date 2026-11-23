import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { boot, SKIP } from '../test-support/harness.js';

let h;
before(async () => { if (!SKIP) h = await boot('lots'); });
after(async () => { if (!SKIP) await h.close(); });

const valid = (over = {}) => ({ farmerName: 'Ramesh Patel', commodity: 'ઘઉં', bags: 12, mobile: '9879512041', village: 'Kamrej', vehicle: 'gj05ab4821', estimated: 30, ...over });
const post = (body, role = 'gate') => h.call(role, 'POST', '/lots', body);

test('create lot: success, normalisation, defaults, numbering and audit trail', { skip: SKIP }, async () => {
  const r = await post(valid({ farmerName: '  Ramesh  ', notes: ' n ', quality: ' Grade A ' }));
  assert.equal(r.status, 201);
  const l = r.body.item;
  assert.match(l.lotNumber, /^LOT-\d{6}-0001$/);
  assert.equal(l.farmerName, 'Ramesh'); assert.equal(l.vehicle, 'GJ05AB4821'); assert.equal(l.quality, 'Grade A'); assert.equal(l.notes, 'n');
  assert.equal(l.status, 'arrived'); assert.equal(l.sellerType, 'farmer'); assert.equal(l.state, 'Gujarat'); assert.equal(l.bags, 12);
  assert.equal(l.createdBy, h.users.gate.id);
  const r2 = await post(valid());
  assert.match(r2.body.item.lotNumber, /-0002$/, 'sequence increments');
  const log = await h.models.AuditLog.findOne({ action: 'GATE_ENTRY_CREATED', resourceId: l._id });
  assert.equal(log.actorName, 'gate user'); assert.equal(log.role, 'gate'); assert.equal(log.after.lotNumber, l.lotNumber);
});

test('create lot: admin may also create; other roles may not', { skip: SKIP }, async () => {
  assert.equal((await post(valid(), 'admin')).status, 201);
  for (const role of ['auction', 'weighment', 'accounts', 'inspector']) assert.equal((await post(valid(), role)).status, 403, role);
});

test('create lot: required text fields', { skip: SKIP }, async () => {
  for (const key of ['farmerName', 'commodity']) {
    for (const bad of [undefined, '', '   ', null]) {
      const r = await post(valid({ [key]: bad }));
      assert.equal(r.status, 400, `${key}=${JSON.stringify(bad)}`); assert.match(r.body.message, new RegExp(key));
    }
  }
});

test('create lot: bags must be a positive whole number', { skip: SKIP }, async () => {
  for (const bags of [undefined, 0, -1, 1.5, 'abc', '', null, NaN]) {
    const r = await post(valid({ bags }));
    assert.equal(r.status, 400, `bags=${bags}`); assert.match(r.body.message, /Bags/);
  }
  assert.equal((await post(valid({ bags: '7' }))).body.item.bags, 7, 'numeric string accepted');
});

test('create lot: mobile validation', { skip: SKIP }, async () => {
  for (const mobile of ['123', 'abcdefghij', '9879512041x', '1'.repeat(19)]) assert.equal((await post(valid({ mobile }))).status, 400, mobile);
  for (const mobile of ['+91 98795-12041'.replace('-', ''), '(079) 2345678', '98795 12041', undefined, '']) assert.equal((await post(valid({ mobile }))).status, 201, String(mobile));
});

test('create lot: commodity must come from the approved master list', { skip: SKIP }, async () => {
  const r = await post(valid({ commodity: 'Unobtainium' }));
  assert.equal(r.status, 400); assert.match(r.body.message, /approved/);
});

test('create lot: trader sellers require a registration / licence id; farmers do not', { skip: SKIP }, async () => {
  assert.equal((await post(valid({ sellerType: 'trader' }))).status, 400);
  assert.equal((await post(valid({ sellerType: 'trader', traderRegistrationNo: '   ' }))).status, 400);
  const ok = await post(valid({ sellerType: 'trader', traderRegistrationNo: 'TR-9' }));
  assert.equal(ok.status, 201); assert.equal(ok.body.item.sellerType, 'trader'); assert.equal(ok.body.item.traderRegistrationNo, 'TR-9');
  assert.equal((await post(valid({ sellerType: 'something-else' }))).body.item.sellerType, 'farmer', 'unknown seller type falls back to farmer');
});

test('create lot: negative / missing estimated weight is clamped to 0; fields are not mass-assignable', { skip: SKIP }, async () => {
  assert.equal((await post(valid({ estimated: -50 }))).body.item.estimated, 0);
  assert.equal((await post(valid({ estimated: undefined }))).body.item.estimated, 0);
  const r = await post(valid({ status: 'dispatched', netWeight: 999, billId: '507f1f77bcf86cd799439011', createdBy: '507f1f77bcf86cd799439011', lotNumber: 'HACK' }));
  assert.equal(r.status, 201);
  assert.equal(r.body.item.status, 'arrived'); assert.equal(r.body.item.netWeight, null); assert.equal(r.body.item.billId, null);
  assert.equal(r.body.item.createdBy, h.users.gate.id); assert.notEqual(r.body.item.lotNumber, 'HACK');
});

test('create lot: gujarati and unicode names are preserved', { skip: SKIP }, async () => {
  const r = await post(valid({ farmerName: 'રમેશ પટેલ', village: 'કામરેજ' }));
  assert.equal(r.body.item.farmerName, 'રમેશ પટેલ'); assert.equal(r.body.item.village, 'કામરેજ');
});

test('list lots: pagination, ordering, filters and clamping', { skip: SKIP }, async () => {
  await h.models.Lot.deleteMany({});
  const base = Date.now();
  for (let i = 0; i < 30; i++) {
    await h.models.Lot.create({ lotNumber: 'L-' + String(i).padStart(2, '0'), farmerName: i % 2 ? 'Odd Farmer' : 'Even Farmer', commodity: i % 3 ? 'ઘઉં' : 'કપાસ', bags: 1, village: i === 5 ? 'Special.Village' : 'V', vehicle: 'GJ1', mobile: '99999' + i,
      status: i < 10 ? 'arrived' : 'paid', arrivalAt: new Date(base + i * 60000), createdBy: h.users.gate._id });
  }
  let r = await h.call('inspector', 'GET', '/lots');
  assert.equal(r.body.total, 30); assert.equal(r.body.items.length, 25); assert.equal(r.body.page, 1); assert.equal(r.body.limit, 25);
  assert.equal(r.body.items[0].lotNumber, 'L-29', 'newest arrival first');
  r = await h.call('inspector', 'GET', '/lots?page=2');
  assert.equal(r.body.items.length, 5);
  assert.equal((await h.call('inspector', 'GET', '/lots?limit=1000')).body.limit, 100);
  assert.equal((await h.call('inspector', 'GET', '/lots?status=arrived')).body.total, 10);
  assert.equal((await h.call('inspector', 'GET', '/lots?status=all')).body.total, 30);
  assert.equal((await h.call('inspector', 'GET', '/lots?status=nonexistent')).body.total, 0);
  assert.equal((await h.call('inspector', 'GET', '/lots?search=odd')).body.total, 15, 'case-insensitive substring');
  assert.equal((await h.call('inspector', 'GET', '/lots?search=L-07')).body.total, 1);
  assert.equal((await h.call('inspector', 'GET', '/lots?search=' + encodeURIComponent('Special.Village'))).body.total, 1);
  assert.equal((await h.call('inspector', 'GET', '/lots?search=' + encodeURIComponent('S.ecial'))).body.total, 0, 'dot is literal, not a wildcard');
  assert.equal((await h.call('inspector', 'GET', '/lots?search=' + encodeURIComponent('.*'))).body.total, 0, 'regex injection is neutralised');
  assert.equal((await h.call('inspector', 'GET', '/lots?search=' + encodeURIComponent('(' ))).status, 200, 'unbalanced paren does not crash');
  assert.equal((await h.call('inspector', 'GET', '/lots?search=' + encodeURIComponent('કપાસ'))).body.total, 10);
  const from = new Date(base + 25 * 60000).toISOString();
  assert.equal((await h.call('inspector', 'GET', '/lots?from=' + encodeURIComponent(from))).body.total, 5);
  const to = new Date(base + 4 * 60000).toISOString();
  assert.equal((await h.call('inspector', 'GET', '/lots?to=' + encodeURIComponent(to))).body.total, 5);
  assert.equal((await h.call('inspector', 'GET', `/lots?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)).body.total, 0);
});

test('list lots: populates buyer and creator, returns plain objects', { skip: SKIP }, async () => {
  const r = await h.call('admin', 'GET', '/lots?limit=1');
  assert.equal(r.body.items[0].createdBy.name, 'gate user');
  assert.equal(r.body.items[0].createdBy.role, 'gate');
});

test('list lots: an unparseable date filter is a 400, not a 500', { skip: SKIP }, async () => {
  for (const q of ['from=not-a-date', 'to=garbage', 'from=2026-13-45']) {
    const r = await h.call('admin', 'GET', '/lots?' + q);
    assert.equal(r.status, 400, `${q} -> ${r.status} ${JSON.stringify(r.body)}`);
  }
});

test('list lots: array / object query params do not break the filter', { skip: SKIP }, async () => {
  for (const q of ['search[]=a&search[]=b', 'search[$ne]=x', 'status[$ne]=arrived', 'page[]=2']) {
    const r = await h.call('admin', 'GET', '/lots?' + q);
    assert.ok(r.status < 500, `${q} -> ${r.status}`);
  }
});

test('get lot: 400 for malformed id, 404 for unknown id, full traceability payload otherwise', { skip: SKIP }, async () => {
  assert.equal((await h.call('admin', 'GET', '/lots/not-an-id')).status, 400);
  assert.equal((await h.call('admin', 'GET', '/lots/507f1f77bcf86cd799439011')).status, 404);
  const lot = await h.models.Lot.findOne();
  const r = await h.call('inspector', 'GET', '/lots/' + lot.id);
  assert.equal(r.status, 200);
  assert.equal(r.body.item.lotNumber, lot.lotNumber);
  assert.equal(r.body.ticket, null); assert.deepEqual(r.body.weighments, []); assert.equal(r.body.bill, null); assert.equal(r.body.pass, null); assert.deepEqual(r.body.complaints, []);
});
