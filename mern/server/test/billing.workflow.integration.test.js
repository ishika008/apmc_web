import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { boot, makeBilledLot, SKIP } from '../test-support/harness.js';

let h;
before(async () => { if (!SKIP) h = await boot('billing'); });
after(async () => { if (!SKIP) await h.close(); });

const pay = (billId, type, amount, ref, mode = 'NEFT', role = 'accounts') => h.call(role, 'POST', '/payments', { billId, type, amount, mode, reference: ref });
const weigh = (body, role = 'weighment') => h.call(role, 'POST', '/weighments', body);
const setConfig = body => h.call('admin', 'PATCH', '/settings', body);
let refSeq = 0; const ref = () => 'UTR' + String(++refSeq).padStart(6, '0');

/* ───────────────────────────── weighment & bill ───────────────────────────── */

test('weighment creates a bill: net = gross − tare, amounts from ticket rate, deadlines carried over, lot updated', { skip: SKIP }, async () => {
  const x = await makeBilledLot(h, { rate: 2000, quantity: 20, gross: 25.5, tare: 5.5 });
  assert.equal(x.weighment.net, 20); assert.equal(x.weighment.recordedBy, h.users.weighment.id);
  assert.match(x.bill.billNumber, /^SB-\d{4}-\d{6}$/);
  assert.equal(x.bill.netWeight, 20); assert.equal(x.bill.rate, 2000); assert.equal(x.bill.grossAmount, 40000);
  assert.equal(x.bill.sellerDeduction, 0); assert.equal(x.bill.farmerNetPayable, 40000); assert.equal(x.bill.status, 'payment_pending');
  assert.equal(String(x.bill.buyer), x.buyer._id); assert.equal(x.bill.farmerName, 'Test Farmer');
  assert.equal(new Date(x.bill.buyerCreditDueAt).getTime(), new Date(x.ticket.buyerCreditDueAt).getTime());
  const lot = await h.models.Lot.findById(x.lot._id);
  assert.equal(lot.status, 'weighed'); assert.equal(lot.netWeight, 20); assert.equal(lot.grossWeight, 25.5); assert.equal(lot.tareWeight, 5.5); assert.equal(String(lot.billId), x.bill._id);
  assert.ok(await h.models.AuditLog.findOne({ action: 'WEIGHMENT_RECORDED', resourceId: x.weighment._id }));
});

test('weighment: bill uses the ticket rate and the MEASURED net weight, not the auctioned quantity', { skip: SKIP }, async () => {
  const x = await makeBilledLot(h, { rate: 1000, quantity: 50, gross: 12, tare: 2 });
  assert.equal(x.bill.netWeight, 10); assert.equal(x.bill.grossAmount, 10000);
});

test('weighment: input validation', { skip: SKIP }, async () => {
  const x = await makeBilledLot(h);
  const fresh = (await h.call('gate', 'POST', '/lots', { farmerName: 'F', commodity: 'ઘઉં', bags: 1 })).body.item;
  const buyer = x.buyer;
  const t = (await h.call('auction', 'POST', '/tickets', { lotId: fresh._id, buyerId: buyer._id, rate: 10, quantity: 1 })).body.item;
  assert.ok(t);
  for (const body of [{ lotId: 'bad', gross: 10, tare: 1 }, { lotId: 5, gross: 10, tare: 1 }, { gross: 10, tare: 1 }]) assert.equal((await weigh(body)).status, 400, JSON.stringify(body));
  for (const [gross, tare] of [[0, 0], [-5, 0], [10, -1], [5, 5], [5, 6], ['x', 1], [undefined, 1], [Infinity, 1]]) {
    const r = await weigh({ lotId: fresh._id, gross, tare });
    assert.equal(r.status, 400, `gross=${gross} tare=${tare} -> ${r.status} ${JSON.stringify(r.body)}`);
  }
  assert.equal(await h.models.Weighment.countDocuments({ lot: fresh._id }), 0, 'nothing persisted by rejected requests');
  assert.equal((await h.models.Lot.findById(fresh._id)).status, 'auctioned');
});

test('weighment: lot must be auctioned (or weighed, for corrections)', { skip: SKIP }, async () => {
  const arrived = (await h.call('gate', 'POST', '/lots', { farmerName: 'F', commodity: 'ઘઉં', bags: 1 })).body.item;
  const r = await weigh({ lotId: arrived._id, gross: 10, tare: 1 });
  assert.equal(r.status, 409); assert.match(r.body.message, /auctioned/);
  assert.equal((await weigh({ lotId: '507f1f77bcf86cd799439011', gross: 10, tare: 1 })).status, 409);
});

test('weighment: a lot with a voided ticket cannot be weighed', { skip: SKIP }, async () => {
  const lot = (await h.call('gate', 'POST', '/lots', { farmerName: 'F', commodity: 'ઘઉં', bags: 1 })).body.item;
  const buyer = (await h.call('accounts', 'POST', '/buyers', { name: 'VoidBuyer' + Math.random(), registrationNo: '1' })).body.item;
  const t = (await h.call('auction', 'POST', '/tickets', { lotId: lot._id, buyerId: buyer._id, rate: 10, quantity: 1 })).body.item;
  await h.call('admin', 'POST', `/tickets/${t._id}/void`, { reason: 'ticket voided before weighing' });
  assert.equal((await weigh({ lotId: lot._id, gross: 10, tare: 1 })).status, 409);
});

test('weighment: yard-config deductions and buyer fees flow into the bill (seller deduction capped at gross)', { skip: SKIP }, async () => {
  assert.equal((await setConfig({ sellerApprovedDeduction: 500, buyerMarketFee: 120.5, buyerOtherDues: 30 })).status, 200);
  const x = await makeBilledLot(h, { rate: 100, quantity: 10, gross: 11, tare: 1 }); // gross amount 1000
  assert.equal(x.bill.grossAmount, 1000); assert.equal(x.bill.sellerDeduction, 500); assert.equal(x.bill.farmerNetPayable, 500);
  assert.equal(x.bill.buyerMarketFee, 120.5); assert.equal(x.bill.buyerOtherDues, 30);
  const tiny = await makeBilledLot(h, { rate: 10, quantity: 10, gross: 11, tare: 1 }); // gross 100 < deduction 500
  assert.equal(tiny.bill.sellerDeduction, 100, 'deduction is capped at the gross amount'); assert.equal(tiny.bill.farmerNetPayable, 0);
  assert.equal(tiny.bill.status, 'paid', 'a zero-payable bill is created as paid');
  assert.equal((await setConfig({ sellerApprovedDeduction: 0, buyerMarketFee: 0, buyerOtherDues: 0 })).status, 200);
});

test('weighment: a zero-payable bill should leave the lot ready for a gate pass', { skip: SKIP }, async () => {
  await setConfig({ sellerApprovedDeduction: 1000 });
  const x = await makeBilledLot(h, { rate: 10, quantity: 10, gross: 11, tare: 1 });
  await setConfig({ sellerApprovedDeduction: 0 });
  assert.equal(x.bill.farmerNetPayable, 0);
  const lot = await h.models.Lot.findById(x.lot._id);
  assert.equal(lot.status, 'paid', `lot status was '${lot.status}' although nothing is payable to the farmer`);
  assert.equal((await h.call('gate', 'POST', `/gate-passes/${x.lot._id}/issue`, {})).status, 201);
});

test('weighment correction: second reading needs admin + reason; same bill is updated; lot and audit follow', { skip: SKIP }, async () => {
  const x = await makeBilledLot(h, { rate: 1000, quantity: 20, gross: 25, tare: 5 });
  assert.equal((await weigh({ lotId: x.lot._id, gross: 26, tare: 5 })).status, 409, 'weighment operator cannot correct');
  assert.equal((await weigh({ lotId: x.lot._id, gross: 26, tare: 5 }, 'admin')).status, 409, 'admin needs a reason');
  assert.equal((await weigh({ lotId: x.lot._id, gross: 26, tare: 5, correctionReason: 'short' }, 'admin')).status, 409, 'reason >= 8 chars');
  const r = await weigh({ lotId: x.lot._id, gross: 26, tare: 5, correctionReason: 'scale recalibrated' }, 'admin');
  assert.equal(r.status, 200, 'corrections answer 200 (not 201)');
  assert.equal(r.body.bill._id, x.bill._id, 'bill is amended, not duplicated');
  assert.equal(r.body.bill.netWeight, 21); assert.equal(r.body.bill.grossAmount, 21000); assert.equal(r.body.bill.farmerNetPayable, 21000);
  assert.equal(r.body.item.correctionOf, x.weighment._id); assert.equal(r.body.item.correctionReason, 'scale recalibrated');
  assert.equal(await h.models.SaleBill.countDocuments({ lot: x.lot._id }), 1);
  assert.equal((await h.models.Lot.findById(x.lot._id)).netWeight, 21);
  const log = await h.models.AuditLog.findOne({ action: 'WEIGHMENT_CORRECTED', resourceId: r.body.item._id });
  assert.deepEqual(log.before, { gross: 25, tare: 5, net: 20 }); assert.deepEqual(log.after, { gross: 26, tare: 5, net: 21 }); assert.equal(log.reason, 'scale recalibrated');
  const detail = (await h.call('inspector', 'GET', '/lots/' + x.lot._id)).body;
  assert.equal(detail.weighments.length, 2, 'both readings are kept as history');
});

test('weighment correction is refused once any payment is recorded on the bill', { skip: SKIP }, async () => {
  for (const [type, amount] of [['farmer_settlement', 100], ['buyer_purchase', 100]]) {
    const x = await makeBilledLot(h);
    assert.equal((await pay(x.bill._id, type, amount, ref())).status, 201);
    const r = await weigh({ lotId: x.lot._id, gross: 30, tare: 5, correctionReason: 'recheck after payment' }, 'admin');
    assert.equal(r.status, 409, type); assert.match(r.body.message, /Payment has been recorded/);
  }
});

test('weighment: only admin and weighment roles; list shows populated refs', { skip: SKIP }, async () => {
  const x = await makeBilledLot(h);
  for (const role of ['gate', 'auction', 'accounts', 'inspector']) assert.equal((await weigh({ lotId: x.lot._id, gross: 9, tare: 1 }, role)).status, 403, role);
  const r = await h.call('inspector', 'GET', '/weighments?limit=1');
  assert.equal(r.status, 200); assert.ok(r.body.total >= 1); assert.ok(r.body.items[0].lot.lotNumber); assert.equal(r.body.items[0].recordedBy.name, 'weighment user');
});

/* ───────────────────────────── payments ───────────────────────────── */

test('payment: validation of bill id, type, amount, mode and reference', { skip: SKIP }, async () => {
  const x = await makeBilledLot(h);
  const ok = { billId: x.bill._id, type: 'farmer_settlement', amount: 100, mode: 'NEFT', reference: 'GOODREF1' };
  const cases = [
    [{ billId: 'x' }, /valid sale bill/], [{ billId: 5 }, /valid sale bill/], [{ billId: undefined }, /valid sale bill/],
    [{ type: 'refund' }, /ledger type/], [{ type: undefined }, /ledger type/],
    [{ amount: 0 }, /greater than zero/], [{ amount: -5 }, /greater than zero/], [{ amount: 'abc' }, /greater than zero/], [{ amount: undefined }, /greater than zero/], [{ amount: 0.004 }, /greater than zero/],
    [{ mode: 'CHEQUE' }, /payment mode/], [{ mode: undefined }, /payment mode/],
    [{ reference: '' }, /reference/], [{ reference: 'abc' }, /reference/], [{ reference: '   abc  ' }, /reference/], [{ reference: undefined }, /reference/]
  ];
  for (const [over, re] of cases) {
    const r = await h.call('accounts', 'POST', '/payments', { ...ok, ...over });
    assert.equal(r.status, 400, JSON.stringify(over)); assert.match(r.body.message, re);
  }
  assert.equal(await h.models.Payment.countDocuments({ bill: x.bill._id }), 0);
  assert.equal((await h.call('accounts', 'POST', '/payments', { ...ok, billId: '507f1f77bcf86cd799439011' })).status, 404);
});

test('payment: farmer settlement partial → part_paid, full → paid and lot becomes "paid"; receipt, audit, balance', { skip: SKIP }, async () => {
  const x = await makeBilledLot(h, { rate: 1000, quantity: 10, gross: 11, tare: 1 }); // payable 10000
  let r = await pay(x.bill._id, 'farmer_settlement', 4000.5, ref(), 'UPI');
  assert.equal(r.status, 201);
  assert.match(r.body.payment.receiptNumber, /^RCPT-\d{4}-\d{7}$/); assert.equal(r.body.payment.amount, 4000.5); assert.equal(r.body.payment.recordedBy, h.users.accounts.id);
  assert.equal(r.body.bill.status, 'part_paid'); assert.equal(r.body.bill.farmerPaid, 4000.5); assert.equal(r.body.outstanding, 5999.5);
  assert.equal((await h.models.Lot.findById(x.lot._id)).status, 'weighed', 'lot not yet paid');
  r = await pay(x.bill._id, 'farmer_settlement', 5999.5, ref());
  assert.equal(r.body.bill.status, 'paid'); assert.equal(r.body.outstanding, 0);
  assert.equal((await h.models.Lot.findById(x.lot._id)).status, 'paid');
  assert.ok(await h.models.AuditLog.findOne({ action: 'PAYMENT_RECORDED', resourceId: r.body.payment._id }));
});

test('payment: receipt numbers are unique and sequential', { skip: SKIP }, async () => {
  const x = await makeBilledLot(h);
  const a = await pay(x.bill._id, 'farmer_settlement', 10, ref()), b = await pay(x.bill._id, 'farmer_settlement', 10, ref());
  const n = r => Number(r.body.payment.receiptNumber.split('-')[2]);
  assert.equal(n(b), n(a) + 1);
});

test('payment: cannot exceed the outstanding balance of its ledger (each ledger tracked separately)', { skip: SKIP }, async () => {
  await setConfig({ buyerMarketFee: 100, buyerOtherDues: 50 });
  const x = await makeBilledLot(h, { rate: 1000, quantity: 10, gross: 11, tare: 1 }); // gross 10000, buyer dues 150
  await setConfig({ buyerMarketFee: 0, buyerOtherDues: 0 });
  let r = await pay(x.bill._id, 'farmer_settlement', 10000.01, ref());
  assert.equal(r.status, 409); assert.match(r.body.message, /exceeds outstanding balance/);
  r = await pay(x.bill._id, 'buyer_purchase', 10000.01, ref()); assert.equal(r.status, 409);
  r = await pay(x.bill._id, 'buyer_fee', 150.01, ref()); assert.equal(r.status, 409);
  assert.equal((await pay(x.bill._id, 'buyer_fee', 150, ref())).status, 201);
  assert.equal((await pay(x.bill._id, 'buyer_fee', 0.01, ref())).status, 409, 'fee ledger now settled');
  assert.equal((await pay(x.bill._id, 'buyer_purchase', 10000, ref())).status, 201, 'other ledgers unaffected');
  const bill = await h.models.SaleBill.findById(x.bill._id);
  assert.equal(bill.buyerDuesPaid, 150); assert.equal(bill.buyerPurchasePaid, 10000); assert.equal(bill.farmerPaid, 0);
  assert.equal(bill.status, 'payment_pending', 'only farmer settlement moves the bill status');
  assert.equal(await h.models.Payment.countDocuments({ bill: x.bill._id }), 2, 'rejected payments leave no record');
});

test('payment: float noise is tolerated on exact settlement (0.1 + 0.2 style)', { skip: SKIP }, async () => {
  const x = await makeBilledLot(h, { rate: 33.33, quantity: 3, gross: 4, tare: 1 }); // 99.99
  assert.equal(x.bill.farmerNetPayable, 99.99);
  assert.equal((await pay(x.bill._id, 'farmer_settlement', 33.33, ref())).status, 201);
  assert.equal((await pay(x.bill._id, 'farmer_settlement', 33.33, ref())).status, 201);
  const last = await pay(x.bill._id, 'farmer_settlement', 33.33, ref());
  assert.equal(last.status, 201); assert.equal(last.body.bill.status, 'paid');
});

test('payment: duplicate (mode, reference, type) is a 409 and does not change the bill', { skip: SKIP }, async () => {
  const x = await makeBilledLot(h);
  assert.equal((await pay(x.bill._id, 'farmer_settlement', 100, 'DUPLICATE-1', 'NEFT')).status, 201);
  const r = await pay(x.bill._id, 'farmer_settlement', 100, 'DUPLICATE-1', 'NEFT');
  assert.equal(r.status, 409); assert.match(r.body.message, /already been recorded/);
  assert.equal((await h.models.SaleBill.findById(x.bill._id)).farmerPaid, 100, 'transaction rolled back, not double counted');
  assert.equal((await pay(x.bill._id, 'farmer_settlement', 100, 'DUPLICATE-1', 'UPI')).status, 201, 'same reference on another mode is a different instrument');
  assert.equal((await pay(x.bill._id, 'buyer_purchase', 100, 'DUPLICATE-1', 'NEFT')).status, 201, 'same reference on another ledger is allowed');
});

test('payment: CASH_APPROVED is admin-only; other roles get 403 and nothing is recorded', { skip: SKIP }, async () => {
  const x = await makeBilledLot(h);
  const r = await pay(x.bill._id, 'farmer_settlement', 100, ref(), 'CASH_APPROVED', 'accounts');
  assert.equal(r.status, 403); assert.match(r.body.message, /administrator/);
  assert.equal((await pay(x.bill._id, 'farmer_settlement', 100, ref(), 'CASH_APPROVED', 'admin')).status, 201);
  assert.equal(await h.models.Payment.countDocuments({ bill: x.bill._id }), 1);
});

test('payment: cancelled bills are refused; only admin and accounts may post', { skip: SKIP }, async () => {
  const x = await makeBilledLot(h);
  await h.models.SaleBill.updateOne({ _id: x.bill._id }, { status: 'cancelled' });
  assert.equal((await pay(x.bill._id, 'farmer_settlement', 10, ref())).status, 404);
  const y = await makeBilledLot(h);
  for (const role of ['gate', 'auction', 'weighment', 'inspector']) assert.equal((await pay(y.bill._id, 'farmer_settlement', 10, ref(), 'NEFT', role)).status, 403, role);
});

test('payment: reference whitespace is trimmed before storage and uniqueness checks', { skip: SKIP }, async () => {
  const x = await makeBilledLot(h);
  const a = await pay(x.bill._id, 'farmer_settlement', 10, '  TRIM-0001  ');
  assert.equal(a.body.payment.reference, 'TRIM-0001');
  assert.equal((await pay(x.bill._id, 'farmer_settlement', 10, 'TRIM-0001')).status, 409);
});

test('list bills/payments: filters, search (escaped), pagination, populated refs', { skip: SKIP }, async () => {
  const x = await makeBilledLot(h, { farmerName: 'Searchable.Farmer' });
  await pay(x.bill._id, 'buyer_purchase', 50, ref());
  let r = await h.call('accounts', 'GET', '/bills?search=' + encodeURIComponent('searchable.farmer'));
  assert.equal(r.body.total, 1); assert.equal(r.body.items[0].buyer.name, x.buyer.name); assert.ok(r.body.items[0].lot.lotNumber);
  assert.equal((await h.call('accounts', 'GET', '/bills?search=' + encodeURIComponent('S.arch'))).body.total, 0, 'dot literal');
  assert.equal((await h.call('accounts', 'GET', '/bills?search=' + encodeURIComponent('(('))).status, 200);
  assert.equal((await h.call('accounts', 'GET', '/bills?search=' + x.bill.billNumber.toLowerCase())).body.total, 1);
  assert.ok((await h.call('accounts', 'GET', '/bills?status=payment_pending')).body.items.every(b => b.status === 'payment_pending'));
  assert.equal((await h.call('accounts', 'GET', '/bills?status=nonsense')).body.total, 0);
  r = await h.call('accounts', 'GET', '/payments?type=buyer_purchase&limit=100');
  assert.ok(r.body.items.length >= 1 && r.body.items.every(p => p.type === 'buyer_purchase'));
  assert.ok(r.body.items[0].bill.billNumber && r.body.items[0].recordedBy.name);
  assert.equal((await h.call('accounts', 'GET', '/bills?limit=2')).body.items.length, 2);
});

/* ───────────────────────────── gate pass & dispatch ───────────────────────────── */

const settle = async x => { await pay(x.bill._id, 'farmer_settlement', x.bill.farmerNetPayable, ref()); };
const issue = (lotId, body = {}, role = 'gate') => h.call(role, 'POST', `/gate-passes/${lotId}/issue`, body);

test('gate pass: refused until the farmer is fully settled', { skip: SKIP }, async () => {
  const x = await makeBilledLot(h, { rate: 1000, quantity: 10, gross: 11, tare: 1 });
  let r = await issue(x.lot._id);
  assert.equal(r.status, 409); assert.match(r.body.message, /Farmer settlement must be completed/);
  await pay(x.bill._id, 'farmer_settlement', 9999.99, ref());
  assert.equal((await issue(x.lot._id)).status, 409, 'one paisa short still blocks');
});

test('gate pass: validation of the lot id; unknown lot', { skip: SKIP }, async () => {
  assert.equal((await issue('bad')).status, 400);
  assert.equal((await issue('507f1f77bcf86cd799439011')).status, 409);
});

test('gate pass: buyer-side dues must be cleared too; clearing them unblocks issue', { skip: SKIP }, async () => {
  await setConfig({ buyerMarketFee: 100, buyerOtherDues: 20 });
  const x = await makeBilledLot(h, { rate: 1000, quantity: 10, gross: 11, tare: 1 });
  await setConfig({ buyerMarketFee: 0, buyerOtherDues: 0 });
  await settle(x);
  let r = await issue(x.lot._id);
  assert.equal(r.status, 409); assert.match(r.body.message, /Buyer-side approved dues/);
  await pay(x.bill._id, 'buyer_fee', 119, ref());
  assert.equal((await issue(x.lot._id)).status, 409, 'still 1 rupee short');
  await pay(x.bill._id, 'buyer_fee', 1, ref());
  assert.equal((await issue(x.lot._id)).status, 201);
});

test('gate pass: trader credit blocks only once overdue', { skip: SKIP }, async () => {
  const x = await makeBilledLot(h, { rate: 1000, quantity: 10, gross: 11, tare: 1 });
  await settle(x);
  await h.models.SaleBill.updateOne({ _id: x.bill._id }, { buyerCreditDueAt: new Date(Date.now() - 1000) });
  const r = await issue(x.lot._id);
  assert.equal(r.status, 409); assert.match(r.body.message, /Trader purchase credit is overdue/);
  await h.models.SaleBill.updateOne({ _id: x.bill._id }, { buyerCreditDueAt: new Date(Date.now() + 86400000) });
  assert.equal((await issue(x.lot._id)).status, 201, 'unpaid but within credit period is fine');
});

test('gate pass: issue stores number, vehicle, buyer; lot gets the pass number; duplicate pass is refused; audit', { skip: SKIP }, async () => {
  const x = await makeBilledLot(h);
  await settle(x);
  const r = await issue(x.lot._id);
  assert.equal(r.status, 201);
  const p = r.body.item;
  assert.match(p.passNumber, /^GP-\d{4}-\d{6}$/); assert.equal(p.status, 'issued'); assert.equal(p.vehicle, 'GJ01AB1234');
  assert.equal(String(p.buyer), x.buyer._id); assert.equal(String(p.lot), x.lot._id); assert.equal(p.issuedBy, h.users.gate.id);
  assert.equal((await h.models.Lot.findById(x.lot._id)).passNumber, p.passNumber);
  const dup = await issue(x.lot._id);
  assert.equal(dup.status, 409);
  assert.equal(await h.models.GatePass.countDocuments({ lot: x.lot._id }), 1);
  assert.ok(await h.models.AuditLog.findOne({ action: 'GATE_PASS_ISSUED', resourceId: p._id }));
  assert.equal((await h.call('inspector', 'GET', '/lots/' + x.lot._id)).body.pass.passNumber, p.passNumber);
});

test('gate pass: overdue dispatch deadline needs an admin with a reason (>= 8 chars)', { skip: SKIP }, async () => {
  const x = await makeBilledLot(h);
  await settle(x);
  await h.models.SaleBill.updateOne({ _id: x.bill._id }, { dispatchDueAt: new Date(Date.now() - 3600000) });
  let r = await issue(x.lot._id, { overrideReason: 'gate officer says ok' }, 'gate');
  assert.equal(r.status, 409, 'non-admin cannot override'); assert.match(r.body.message, /Administrator/);
  assert.equal((await issue(x.lot._id, {}, 'admin')).status, 409, 'admin without reason');
  assert.equal((await issue(x.lot._id, { overrideReason: 'short' }, 'admin')).status, 409, 'reason too short');
  r = await issue(x.lot._id, { overrideReason: '  approved by committee  ' }, 'admin');
  assert.equal(r.status, 201); assert.equal(r.body.item.overrideReason, 'approved by committee');
  const log = await h.models.AuditLog.findOne({ action: 'GATE_PASS_ISSUED', resourceId: r.body.item._id });
  assert.equal(log.reason, 'approved by committee');
});

test('gate pass: the override reason is ignored (not required) when the deadline is not overdue', { skip: SKIP }, async () => {
  const x = await makeBilledLot(h);
  await settle(x);
  const r = await issue(x.lot._id, { overrideReason: 'unneeded' });
  assert.equal(r.status, 201);
});

test('gate pass: only admin and gate roles issue/dispatch', { skip: SKIP }, async () => {
  const x = await makeBilledLot(h);
  await settle(x);
  for (const role of ['auction', 'weighment', 'accounts', 'inspector']) assert.equal((await issue(x.lot._id, {}, role)).status, 403, role);
  const p = (await issue(x.lot._id, {}, 'admin')).body.item;
  for (const role of ['auction', 'weighment', 'accounts', 'inspector']) assert.equal((await h.call(role, 'POST', `/gate-passes/${p._id}/dispatch`, {})).status, 403, role);
});

test('dispatch: marks pass and lot dispatched, records who/when, audits; cannot be repeated', { skip: SKIP }, async () => {
  const x = await makeBilledLot(h);
  await settle(x);
  const p = (await issue(x.lot._id)).body.item;
  assert.equal((await h.call('gate', 'POST', '/gate-passes/bad/dispatch', {})).status, 400);
  assert.equal((await h.call('gate', 'POST', '/gate-passes/507f1f77bcf86cd799439011/dispatch', {})).status, 404);
  const r = await h.call('gate', 'POST', `/gate-passes/${p._id}/dispatch`, {});
  assert.equal(r.status, 200); assert.equal(r.body.item.status, 'dispatched'); assert.ok(r.body.item.dispatchAt); assert.equal(r.body.item.dispatchedBy, h.users.gate.id);
  const lot = await h.models.Lot.findById(x.lot._id);
  assert.equal(lot.status, 'dispatched'); assert.ok(lot.dispatchAt);
  assert.ok(await h.models.AuditLog.findOne({ action: 'VEHICLE_EXIT_CONFIRMED', resourceId: p._id }));
  assert.equal((await h.call('gate', 'POST', `/gate-passes/${p._id}/dispatch`, {})).status, 404, 'second dispatch refused');
});

test('list gate passes: populated refs, newest first, pagination', { skip: SKIP }, async () => {
  const r = await h.call('inspector', 'GET', '/gate-passes?limit=2');
  assert.equal(r.status, 200); assert.ok(r.body.total >= 2); assert.equal(r.body.items.length, 2);
  const [a, b] = r.body.items;
  assert.ok(new Date(a.issuedAt) >= new Date(b.issuedAt));
  assert.ok(a.lot.lotNumber && a.buyer.name && a.issuedBy.name);
});

test('end-to-end: dispatched lot disappears from yard stock and counts as dispatched on the dashboard', { skip: SKIP }, async () => {
  const d = (await h.call('admin', 'GET', '/dashboard')).body;
  assert.ok(d.status.dispatched >= 1);
  assert.ok(d.stock.every(l => l.status !== 'dispatched'));
  assert.equal(d.status.passesIssued, await h.models.GatePass.countDocuments());
});
