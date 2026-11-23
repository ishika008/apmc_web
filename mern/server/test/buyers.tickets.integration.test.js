import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { boot, makeBilledLot, SKIP } from '../test-support/harness.js';

let h;
before(async () => { if (!SKIP) h = await boot('buyers'); });
after(async () => { if (!SKIP) await h.close(); });

const newLot = async (over = {}) => (await h.call('gate', 'POST', '/lots', { farmerName: 'F', commodity: 'ઘઉં', bags: 5, estimated: 50, ...over })).body.item;
const newBuyer = async (over = {}) => (await h.call('accounts', 'POST', '/buyers', { name: 'B' + Math.random().toString(36).slice(2), registrationNo: 'R1', ...over })).body.item;
const ticket = (body, role = 'auction') => h.call(role, 'POST', '/tickets', body);

/* ───────────────────────────── buyers ───────────────────────────── */

test('create buyer: success, trimming, defaults and audit', { skip: SKIP }, async () => {
  const r = await h.call('accounts', 'POST', '/buyers', { name: '  Patel Agro ', registrationNo: ' TR-1 ' });
  assert.equal(r.status, 201);
  assert.equal(r.body.item.name, 'Patel Agro'); assert.equal(r.body.item.registrationNo, 'TR-1');
  assert.equal(r.body.item.creditDays, 5); assert.equal(r.body.item.purchaseLimit, 0); assert.equal(r.body.item.active, true);
  assert.ok(await h.models.AuditLog.findOne({ action: 'BUYER_CREATED', resourceId: r.body.item._id }));
});

test('create buyer: name and registration are required', { skip: SKIP }, async () => {
  for (const body of [{}, { name: 'x' }, { registrationNo: 'x' }, { name: '  ', registrationNo: 'x' }, { name: 'x', registrationNo: '  ' }, { name: null, registrationNo: null }]) {
    const r = await h.call('admin', 'POST', '/buyers', body);
    assert.equal(r.status, 400, JSON.stringify(body));
  }
});

test('create buyer: duplicate name is a 409', { skip: SKIP }, async () => {
  await h.call('admin', 'POST', '/buyers', { name: 'Dup Co', registrationNo: '1' });
  const r = await h.call('admin', 'POST', '/buyers', { name: 'Dup Co', registrationNo: '2' });
  assert.equal(r.status, 409); assert.match(r.body.message, /already exists/);
});

test('create buyer: out-of-range credit days / negative limit are client errors (400), not 500', { skip: SKIP }, async () => {
  for (const extra of [{ creditDays: 91 }, { creditDays: -1 }, { purchaseLimit: -5 }, { creditDays: 'abc' }, { purchaseLimit: 'abc' }]) {
    const r = await h.call('admin', 'POST', '/buyers', { name: 'N' + Math.random(), registrationNo: 'x', ...extra });
    assert.equal(r.status, 400, `${JSON.stringify(extra)} -> ${r.status} ${JSON.stringify(r.body)}`);
  }
  assert.equal((await h.call('admin', 'POST', '/buyers', { name: 'Edge90', registrationNo: 'x', creditDays: 90, purchaseLimit: 0 })).status, 201);
  assert.equal((await h.call('admin', 'POST', '/buyers', { name: 'Edge0', registrationNo: 'x', creditDays: 0 })).status, 201, 'zero credit days allowed');
});

test('update buyer: only whitelisted fields change; audit written; validation applies', { skip: SKIP }, async () => {
  const b = await newBuyer({ creditDays: 4, purchaseLimit: 1000 });
  let r = await h.call('accounts', 'PATCH', '/buyers/' + b._id, { creditDays: 10, purchaseLimit: 5000, active: false, notes: 'hold', _id: '507f1f77bcf86cd799439011', createdAt: '2000-01-01' });
  assert.equal(r.status, 200);
  assert.equal(r.body.item.creditDays, 10); assert.equal(r.body.item.purchaseLimit, 5000); assert.equal(r.body.item.active, false); assert.equal(r.body.item.notes, 'hold');
  assert.equal(r.body.item._id, b._id, '_id cannot be overwritten');
  assert.ok(new Date(r.body.item.createdAt).getFullYear() >= 2025, 'createdAt untouched');
  assert.ok(await h.models.AuditLog.findOne({ action: 'BUYER_UPDATED', resourceId: b._id }));
  r = await h.call('accounts', 'PATCH', '/buyers/' + b._id, { creditDays: 500 });
  assert.equal(r.status, 400, `got ${r.status} ${JSON.stringify(r.body)}`);
  assert.equal((await h.models.Buyer.findById(b._id)).creditDays, 10, 'invalid update not persisted');
  assert.equal((await h.call('accounts', 'PATCH', '/buyers/bad-id', {})).status, 400);
  assert.equal((await h.call('accounts', 'PATCH', '/buyers/507f1f77bcf86cd799439011', {})).status, 404);
});

test('list buyers: ledger block present, search & active filters, Gujarati search, hostile input', { skip: SKIP }, async () => {
  await h.models.Buyer.deleteMany({});
  await h.call('admin', 'POST', '/buyers', { name: 'Alpha Traders', registrationNo: '1' });
  await h.call('admin', 'POST', '/buyers', { name: 'Beta Traders', registrationNo: '2' });
  const g = (await h.call('admin', 'POST', '/buyers', { name: 'પટેલ એગ્રો', registrationNo: '3' })).body.item;
  await h.call('admin', 'PATCH', '/buyers/' + g._id, { active: false });
  let r = await h.call('accounts', 'GET', '/buyers');
  assert.equal(r.body.total, 3);
  assert.deepEqual(r.body.items[0].ledger, { gross: 0, paid: 0, dueFees: 0, outstanding: 0, exposure: 0, overdueCount: 0, limitFull: false });
  assert.deepEqual(r.body.items.map(x => x.name), ['Alpha Traders', 'Beta Traders', 'પટેલ એગ્રો'], 'sorted by name (binary collation: Latin before Gujarati)');
  assert.equal((await h.call('accounts', 'GET', '/buyers?active=true')).body.total, 2);
  assert.equal((await h.call('accounts', 'GET', '/buyers?active=false')).body.total, 1);
  assert.equal((await h.call('accounts', 'GET', '/buyers?search=alpha')).body.total, 1);
  assert.equal((await h.call('accounts', 'GET', '/buyers?search=traders')).body.total, 2);
  assert.equal((await h.call('accounts', 'GET', '/buyers?search=' + encodeURIComponent('પટેલ'))).body.total, 1);
  assert.equal((await h.call('accounts', 'GET', '/buyers?search=' + encodeURIComponent('.*'))).body.total, 3, 'metacharacters are stripped, leaving an empty (match-all) search');
  assert.equal((await h.call('accounts', 'GET', '/buyers?search=' + encodeURIComponent('(('))).status, 200);
  assert.equal((await h.call('accounts', 'GET', '/buyers?limit=2')).body.items.length, 2);
  assert.equal((await h.call('accounts', 'GET', '/buyers?limit=2&page=2')).body.items.length, 1);
});

test('buyer ledger: outstanding, exposure, overdue and limitFull reflect bills and open tickets', { skip: SKIP }, async () => {
  await h.models.Buyer.deleteMany({}); await h.models.AuctionTicket.deleteMany({}); await h.models.SaleBill.deleteMany({}); await h.models.Lot.deleteMany({});
  // billed lot: gross = net 20 * 2000 = 40000
  const billed = await makeBilledLot(h, { buyerName: 'Ledger Co', purchaseLimit: 60000, quantity: 20, gross: 25, tare: 5, rate: 2000 });
  // second, unbilled ticket for the same buyer: 5 * 1000 = 5000 provisional
  const lot2 = await newLot({ estimated: 10 });
  assert.equal((await ticket({ lotId: lot2._id, buyerId: billed.buyer._id, rate: 1000, quantity: 5 })).status, 201);
  await h.call('accounts', 'POST', '/payments', { billId: billed.bill._id, type: 'buyer_purchase', amount: 10000, mode: 'UPI', reference: 'LEDGER-01' });
  let row = (await h.call('accounts', 'GET', '/buyers')).body.items.find(b => b._id === billed.buyer._id);
  assert.equal(row.ledger.gross, 40000); assert.equal(row.ledger.paid, 10000); assert.equal(row.ledger.outstanding, 30000);
  assert.equal(row.ledger.exposure, 35000); assert.equal(row.ledger.limitFull, false); assert.equal(row.ledger.overdueCount, 0);
  await h.models.Buyer.updateOne({ _id: billed.buyer._id }, { purchaseLimit: 35000 });
  row = (await h.call('accounts', 'GET', '/buyers')).body.items.find(b => b._id === billed.buyer._id);
  assert.equal(row.ledger.limitFull, true, 'exposure == limit counts as full');
  await h.models.SaleBill.updateOne({ _id: billed.bill._id }, { buyerCreditDueAt: new Date(Date.now() - 86400000) });
  row = (await h.call('accounts', 'GET', '/buyers')).body.items.find(b => b._id === billed.buyer._id);
  assert.equal(row.ledger.overdueCount, 1);
});

/* ───────────────────────────── tickets ───────────────────────────── */

test('issue ticket: success locks the lot, copies deadlines from yard config, audits', { skip: SKIP }, async () => {
  const lot = await newLot({ estimated: 40 }); const buyer = await newBuyer({ creditDays: 7 });
  const t0 = Date.now();
  const r = await ticket({ lotId: lot._id, buyerId: buyer._id, rate: 2500, quantity: 30, method: 'e_auction', notes: 'bid#1', quality: 'Grade A' });
  assert.equal(r.status, 201);
  const t = r.body.item;
  assert.match(t.ticketNumber, /^APMC-\d{4}-\d{6}$/);
  assert.equal(t.method, 'e_auction'); assert.equal(t.quality, 'Grade A'); assert.equal(t.notes, 'bid#1'); assert.equal(t.buyerCreditDays, 7);
  assert.equal(t.issuedBy, h.users.auction.id);
  const day = 86400000;
  assert.ok(Math.abs(new Date(t.farmerPaymentDueAt) - (t0 + 1 * day)) < 60000, 'farmer pay due +1d (default)');
  assert.ok(Math.abs(new Date(t.dispatchDueAt) - (t0 + 2 * day)) < 60000, 'dispatch due +2d (default)');
  assert.ok(Math.abs(new Date(t.buyerCreditDueAt) - (t0 + 7 * day)) < 60000, 'buyer credit due = buyer.creditDays');
  const stored = await h.models.Lot.findById(lot._id);
  assert.equal(stored.status, 'auctioned'); assert.equal(String(stored.ticketId), t._id); assert.equal(String(stored.buyerId), buyer._id); assert.equal(stored.auctionRate, 2500);
  assert.ok(await h.models.AuditLog.findOne({ action: 'AUCTION_TICKET_ISSUED', resourceId: t._id }));
});

test('issue ticket: defaults (method, quality from lot) and unknown method falls back', { skip: SKIP }, async () => {
  const lot = await newLot({ quality: 'Grade B' }); const buyer = await newBuyer();
  const r = await ticket({ lotId: lot._id, buyerId: buyer._id, rate: 10, quantity: 1, method: 'barter' });
  assert.equal(r.body.item.method, 'open_outcry'); assert.equal(r.body.item.quality, 'Grade B');
});

test('issue ticket: input validation', { skip: SKIP }, async () => {
  const lot = await newLot(); const buyer = await newBuyer();
  const ok = { lotId: lot._id, buyerId: buyer._id, rate: 10, quantity: 1 };
  const bad = [{ lotId: 'x' }, { buyerId: 'x' }, { lotId: undefined }, { buyerId: undefined }, { lotId: 5 }, { buyerId: 5 }, { rate: 0 }, { rate: -1 }, { rate: 'abc' }, { rate: undefined }, { quantity: 0 }, { quantity: -2 }, { quantity: 'x' }, { quantity: undefined }];
  for (const over of bad) {
    const r = await ticket({ ...ok, ...over });
    assert.equal(r.status, 400, `${JSON.stringify(over)} -> ${r.status} ${JSON.stringify(r.body)}`);
  }
  assert.equal(await h.models.AuctionTicket.countDocuments({ lot: lot._id }), 0);
  assert.equal((await ticket({})).status, 400);
});

test('issue ticket: quantity may not exceed the lot estimate (when one exists)', { skip: SKIP }, async () => {
  const lot = await newLot({ estimated: 10 }); const buyer = await newBuyer();
  const r = await ticket({ lotId: lot._id, buyerId: buyer._id, rate: 10, quantity: 10.01 });
  assert.equal(r.status, 400); assert.match(r.body.message, /exceed/);
  assert.equal((await ticket({ lotId: lot._id, buyerId: buyer._id, rate: 10, quantity: 10 })).status, 201, 'equal to estimate is fine');
  const noEstimate = await newLot({ estimated: 0 });
  assert.equal((await ticket({ lotId: noEstimate._id, buyerId: buyer._id, rate: 10, quantity: 9999 })).status, 201, 'no estimate => no cap');
});

test('issue ticket: lot must exist and be in "arrived" state; a lot cannot be auctioned twice', { skip: SKIP }, async () => {
  const buyer = await newBuyer(); const lot = await newLot();
  assert.equal((await ticket({ lotId: '507f1f77bcf86cd799439011', buyerId: buyer._id, rate: 1, quantity: 1 })).status, 409);
  assert.equal((await ticket({ lotId: lot._id, buyerId: buyer._id, rate: 1, quantity: 1 })).status, 201);
  const again = await ticket({ lotId: lot._id, buyerId: buyer._id, rate: 1, quantity: 1 });
  assert.equal(again.status, 409); assert.match(again.body.message, /not available/);
  for (const status of ['held', 'weighed', 'paid', 'dispatched']) {
    const l = await newLot(); await h.models.Lot.updateOne({ _id: l._id }, { status });
    assert.equal((await ticket({ lotId: l._id, buyerId: buyer._id, rate: 1, quantity: 1 })).status, 409, status);
  }
});

test('issue ticket: buyer must exist and be active', { skip: SKIP }, async () => {
  const lot = await newLot(); const buyer = await newBuyer();
  assert.equal((await ticket({ lotId: lot._id, buyerId: '507f1f77bcf86cd799439011', rate: 1, quantity: 1 })).status, 404);
  await h.call('accounts', 'PATCH', '/buyers/' + buyer._id, { active: false });
  const r = await ticket({ lotId: lot._id, buyerId: buyer._id, rate: 1, quantity: 1 });
  assert.equal(r.status, 404); assert.match(r.body.message, /Active registered buyer/);
  assert.equal((await h.models.Lot.findById(lot._id)).status, 'arrived', 'lot untouched');
});

test('issue ticket: purchase credit limit counts outstanding bills plus open tickets', { skip: SKIP }, async () => {
  const buyer = await newBuyer({ purchaseLimit: 10000 });
  const a = await newLot({ estimated: 0 }), b = await newLot({ estimated: 0 }), c = await newLot({ estimated: 0 });
  assert.equal((await ticket({ lotId: a._id, buyerId: buyer._id, rate: 100, quantity: 50 })).status, 201, '5000 of 10000');
  const over = await ticket({ lotId: b._id, buyerId: buyer._id, rate: 100, quantity: 50.01 });
  assert.equal(over.status, 409); assert.match(over.body.message, /credit limit/);
  assert.equal((await ticket({ lotId: b._id, buyerId: buyer._id, rate: 100, quantity: 50 })).status, 201, 'exactly reaching the limit is allowed');
  assert.equal((await ticket({ lotId: c._id, buyerId: buyer._id, rate: 1, quantity: 1 })).status, 409, 'limit now full');
  const unlimited = await newBuyer({ purchaseLimit: 0 });
  const d = await newLot({ estimated: 0 });
  assert.equal((await ticket({ lotId: d._id, buyerId: unlimited._id, rate: 1e6, quantity: 1e3 })).status, 201, 'limit 0 means unlimited');
});

test('issue ticket: buyer with an overdue purchase balance is on credit hold', { skip: SKIP }, async () => {
  const billed = await makeBilledLot(h, { buyerName: 'Overdue Co' });
  const lot = await newLot();
  assert.equal((await ticket({ lotId: lot._id, buyerId: billed.buyer._id, rate: 1, quantity: 1 })).status, 201, 'not overdue yet');
  await h.models.SaleBill.updateOne({ _id: billed.bill._id }, { buyerCreditDueAt: new Date(Date.now() - 3600000) });
  const lot2 = await newLot();
  const r = await ticket({ lotId: lot2._id, buyerId: billed.buyer._id, rate: 1, quantity: 1 });
  assert.equal(r.status, 409); assert.match(r.body.message, /credit hold/);
  // paying the balance lifts the hold
  await h.call('accounts', 'POST', '/payments', { billId: billed.bill._id, type: 'buyer_purchase', amount: 40000, mode: 'RTGS', reference: 'CLEAR-HOLD-1' });
  assert.equal((await ticket({ lotId: lot2._id, buyerId: billed.buyer._id, rate: 1, quantity: 1 })).status, 201);
});

test('issue ticket: only admin and auction roles', { skip: SKIP }, async () => {
  const lot = await newLot(); const buyer = await newBuyer();
  for (const role of ['gate', 'weighment', 'accounts', 'inspector']) assert.equal((await ticket({ lotId: lot._id, buyerId: buyer._id, rate: 1, quantity: 1 }, role)).status, 403, role);
  assert.equal((await ticket({ lotId: lot._id, buyerId: buyer._id, rate: 1, quantity: 1 }, 'admin')).status, 201);
});

test('list tickets: pagination, newest first, populated refs, voided tickets hidden', { skip: SKIP }, async () => {
  await h.models.AuctionTicket.deleteMany({}); await h.models.Lot.deleteMany({});
  const buyer = await newBuyer(); const ids = [];
  for (let i = 0; i < 3; i++) { const l = await newLot(); ids.push((await ticket({ lotId: l._id, buyerId: buyer._id, rate: 10 + i, quantity: 1 })).body.item._id); }
  await h.call('admin', 'POST', `/tickets/${ids[0]}/void`, { reason: 'wrong buyer entered' });
  const r = await h.call('inspector', 'GET', '/tickets?limit=10');
  assert.equal(r.body.total, 2); assert.equal(r.body.items[0]._id, ids[2]);
  assert.equal(r.body.items[0].buyer.name, buyer.name); assert.ok(r.body.items[0].lot.lotNumber); assert.equal(r.body.items[0].issuedBy.name, 'auction user');
  assert.equal((await h.call('inspector', 'GET', '/tickets?limit=1&page=2')).body.items.length, 1);
});

test('void ticket: validates id and reason, restores lot, hides ticket, allows re-auction, audits', { skip: SKIP }, async () => {
  const lot = await newLot(); const buyer = await newBuyer();
  const t = (await ticket({ lotId: lot._id, buyerId: buyer._id, rate: 10, quantity: 1 })).body.item;
  assert.equal((await h.call('admin', 'POST', '/tickets/bad/void', { reason: 'long enough reason' })).status, 400);
  assert.equal((await h.call('admin', 'POST', `/tickets/${t._id}/void`, {})).status, 400);
  assert.equal((await h.call('admin', 'POST', `/tickets/${t._id}/void`, { reason: 'short' })).status, 400, '< 8 chars');
  assert.equal((await h.call('admin', 'POST', `/tickets/${t._id}/void`, { reason: '    1234567     ' })).status, 400, 'whitespace is trimmed before the length check');
  assert.equal((await h.call('admin', 'POST', '/tickets/507f1f77bcf86cd799439011/void', { reason: 'long enough reason' })).status, 404);
  const r = await h.call('admin', 'POST', `/tickets/${t._id}/void`, { reason: 'wrong rate entered' });
  assert.equal(r.status, 200); assert.ok(r.body.item.voidedAt); assert.equal(r.body.item.voidReason, 'wrong rate entered');
  const l = await h.models.Lot.findById(lot._id);
  assert.equal(l.status, 'arrived'); assert.equal(l.ticketId, null); assert.equal(l.buyerId, null); assert.equal(l.auctionRate, null);
  const log = await h.models.AuditLog.findOne({ action: 'AUCTION_TICKET_VOIDED', resourceId: t._id });
  assert.equal(log.reason, 'wrong rate entered');
  assert.equal((await h.call('admin', 'POST', `/tickets/${t._id}/void`, { reason: 'void it again please' })).status, 404, 'cannot void twice');
});

test('void ticket: re-auctioning a voided lot works (unique lot index on tickets is respected)', { skip: SKIP }, async () => {
  const lot = await newLot(); const buyer = await newBuyer();
  const t = (await ticket({ lotId: lot._id, buyerId: buyer._id, rate: 10, quantity: 1 })).body.item;
  await h.call('admin', 'POST', `/tickets/${t._id}/void`, { reason: 'bidder withdrew' });
  const r = await ticket({ lotId: lot._id, buyerId: buyer._id, rate: 12, quantity: 1 });
  assert.equal(r.status, 201, `re-auction after void -> ${r.status} ${JSON.stringify(r.body)}`);
});

test('void ticket: refused once a sale bill exists', { skip: SKIP }, async () => {
  const billed = await makeBilledLot(h, { buyerName: 'Billed Co' });
  const r = await h.call('admin', 'POST', `/tickets/${billed.ticket._id}/void`, { reason: 'try to cancel billed' });
  assert.equal(r.status, 409); assert.match(r.body.message, /sale bill/);
  assert.equal((await h.models.AuctionTicket.findById(billed.ticket._id)).voidedAt, undefined);
});

test('void ticket: admin only', { skip: SKIP }, async () => {
  const lot = await newLot(); const buyer = await newBuyer();
  const t = (await ticket({ lotId: lot._id, buyerId: buyer._id, rate: 10, quantity: 1 })).body.item;
  for (const role of ['auction', 'gate', 'accounts']) assert.equal((await h.call(role, 'POST', `/tickets/${t._id}/void`, { reason: 'not allowed to' })).status, 403, role);
});
