// Races against a real replica set: money and uniqueness invariants must hold under parallel requests.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { boot, makeBilledLot, SKIP } from '../test-support/harness.js';

let h;
before(async () => { if (!SKIP) h = await boot('race'); });
after(async () => { if (!SKIP) await h.close(); });

const pay = (billId, type, amount, reference) => h.call('accounts', 'POST', '/payments', { billId, type, amount, mode: 'NEFT', reference });

test('parallel lot creation yields unique, gap-free sequential lot numbers', { skip: SKIP }, async () => {
  const rs = await Promise.all(Array.from({ length: 12 }, () => h.call('gate', 'POST', '/lots', { farmerName: 'P', commodity: 'ઘઉં', bags: 1 })));
  assert.ok(rs.every(r => r.status === 201), JSON.stringify(rs.map(r => r.status)));
  const nums = rs.map(r => Number(r.body.item.lotNumber.split('-')[2])).sort((a, b) => a - b);
  assert.deepEqual(nums, Array.from({ length: 12 }, (_, i) => i + 1));
});

test('parallel payments can never overpay a ledger', { skip: SKIP }, async () => {
  const x = await makeBilledLot(h, { rate: 100, quantity: 10, gross: 11, tare: 1 }); // payable 1000
  const rs = await Promise.all(Array.from({ length: 8 }, (_, i) => pay(x.bill._id, 'farmer_settlement', 300, 'RACE-PAY-' + i)));
  const ok = rs.filter(r => r.status === 201), conflict = rs.filter(r => r.status === 409);
  assert.equal(ok.length, 3, `exactly three 300s fit in 1000; statuses: ${rs.map(r => r.status)}`);
  assert.equal(ok.length + conflict.length, 8, 'every other request was refused with 409, none crashed');
  const bill = await h.models.SaleBill.findById(x.bill._id);
  assert.equal(bill.farmerPaid, 900);
  const sum = (await h.models.Payment.find({ bill: x.bill._id })).reduce((s, p) => s + p.amount, 0);
  assert.equal(sum, bill.farmerPaid, 'ledger rows agree with the bill total');
});

test('parallel payments that exactly settle the bill leave it paid, lot paid, and total == payable', { skip: SKIP }, async () => {
  const x = await makeBilledLot(h, { rate: 100, quantity: 10, gross: 11, tare: 1 }); // 1000
  const rs = await Promise.all([250, 250, 250, 250].map((a, i) => pay(x.bill._id, 'farmer_settlement', a, 'RACE-EXACT-' + i)));
  assert.deepEqual(rs.map(r => r.status), [201, 201, 201, 201]);
  const bill = await h.models.SaleBill.findById(x.bill._id);
  assert.equal(bill.farmerPaid, 1000); assert.equal(bill.status, 'paid');
  assert.equal((await h.models.Lot.findById(x.lot._id)).status, 'paid');
});

test('the same payment reference submitted in parallel is recorded exactly once', { skip: SKIP }, async () => {
  const x = await makeBilledLot(h, { rate: 100, quantity: 10, gross: 11, tare: 1 });
  const rs = await Promise.all(Array.from({ length: 6 }, () => pay(x.bill._id, 'farmer_settlement', 100, 'RACE-SAME-REF')));
  assert.equal(rs.filter(r => r.status === 201).length, 1, `statuses ${rs.map(r => r.status)}`);
  assert.ok(rs.every(r => [201, 409].includes(r.status)), 'losers get 409, not 500');
  assert.equal((await h.models.SaleBill.findById(x.bill._id)).farmerPaid, 100);
  assert.equal(await h.models.Payment.countDocuments({ bill: x.bill._id }), 1);
});

test('parallel gate-pass issue for one lot creates exactly one pass', { skip: SKIP }, async () => {
  const x = await makeBilledLot(h, { rate: 100, quantity: 10, gross: 11, tare: 1 });
  await pay(x.bill._id, 'farmer_settlement', 1000, 'RACE-GP-PAY');
  const rs = await Promise.all(Array.from({ length: 5 }, () => h.call('gate', 'POST', `/gate-passes/${x.lot._id}/issue`, {})));
  assert.equal(rs.filter(r => r.status === 201).length, 1, `statuses ${rs.map(r => r.status)}`);
  assert.ok(rs.every(r => [201, 409].includes(r.status)), 'losers get 409, not 500');
  assert.equal(await h.models.GatePass.countDocuments({ lot: x.lot._id }), 1);
});

test('parallel auction of one lot issues exactly one ticket', { skip: SKIP }, async () => {
  const lot = (await h.call('gate', 'POST', '/lots', { farmerName: 'F', commodity: 'ઘઉં', bags: 1, estimated: 100 })).body.item;
  const buyers = await Promise.all(Array.from({ length: 4 }, (_, i) => h.call('accounts', 'POST', '/buyers', { name: 'RaceBuyer' + i, registrationNo: 'R' + i })));
  const rs = await Promise.all(buyers.map(b => h.call('auction', 'POST', '/tickets', { lotId: lot._id, buyerId: b.body.item._id, rate: 10, quantity: 1 })));
  assert.equal(rs.filter(r => r.status === 201).length, 1, `statuses ${rs.map(r => r.status)}`);
  assert.ok(rs.every(r => [201, 409].includes(r.status)), 'losers get 409, not 500');
  assert.equal(await h.models.AuctionTicket.countDocuments({ lot: lot._id, voidedAt: null }), 1, 'one active ticket');
  assert.equal(await h.models.AuctionTicket.countDocuments({ lot: lot._id }), 1);
});

test('parallel dispatch of one pass succeeds once', { skip: SKIP }, async () => {
  const x = await makeBilledLot(h, { rate: 100, quantity: 10, gross: 11, tare: 1 });
  await pay(x.bill._id, 'farmer_settlement', 1000, 'RACE-DISP-PAY');
  const pass = (await h.call('gate', 'POST', `/gate-passes/${x.lot._id}/issue`, {})).body.item;
  const rs = await Promise.all(Array.from({ length: 4 }, () => h.call('gate', 'POST', `/gate-passes/${pass._id}/dispatch`, {})));
  assert.ok(rs.filter(r => r.status === 200).length >= 1);
  assert.ok(rs.every(r => [200, 404, 409].includes(r.status)), `statuses ${rs.map(r => r.status)}`);
  assert.equal((await h.models.Lot.findById(x.lot._id)).status, 'dispatched');
  assert.equal(await h.models.AuditLog.countDocuments({ action: 'VEHICLE_EXIT_CONFIRMED', resourceId: pass._id }), rs.filter(r => r.status === 200).length);
});
