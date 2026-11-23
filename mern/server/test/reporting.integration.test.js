// Reports (summary, catalog, CSV exports), global search, dashboard, overview and nav counts,
// all computed against a small dataset with known totals.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { boot, makeBilledLot, SKIP } from '../test-support/harness.js';
import { DATASETS, EXPORT_ROW_LIMIT } from '../src/services/reports.service.js';

let h, A, B, C; // A: fully paid & dispatched, B: billed with partial farmer payment, C: auctioned only
const pay = (billId, type, amount, reference, mode = 'NEFT') => h.call('accounts', 'POST', '/payments', { billId, type, amount, mode, reference });

before(async () => {
  if (SKIP) return;
  h = await boot('reports');
  // A: net 10 @ 1000 = 10000, farmer paid in full, trader paid 4000, pass issued + dispatched
  A = await makeBilledLot(h, { farmerName: 'Alpha Farmer', buyerName: 'Alpha Buyer', rate: 1000, quantity: 10, gross: 11, tare: 1, creditDays: 10 });
  await pay(A.bill._id, 'farmer_settlement', 10000, 'RPT-A-FARMER');
  await pay(A.bill._id, 'buyer_purchase', 4000, 'RPT-A-BUYER');
  const pass = (await h.call('gate', 'POST', `/gate-passes/${A.lot._id}/issue`, {})).body.item;
  await h.call('gate', 'POST', `/gate-passes/${pass._id}/dispatch`, {});
  // B: net 20 @ 500 = 10000, farmer paid 2500 of 10000
  B = await makeBilledLot(h, { farmerName: 'Bravo Farmer', buyerName: 'Bravo Buyer', rate: 500, quantity: 20, gross: 22, tare: 2, creditDays: 5 });
  await pay(B.bill._id, 'farmer_settlement', 2500, 'RPT-B-FARMER');
  // C: auctioned, unweighed: 5 @ 300 = 1500 provisional, trader credit due in the past
  const lotC = (await h.call('gate', 'POST', '/lots', { farmerName: 'Charlie Trader', sellerType: 'trader', traderRegistrationNo: 'TR-C', commodity: 'કપાસ', bags: 3, estimated: 10, village: 'Surat', mobile: '9876543210' })).body.item;
  const buyerC = (await h.call('accounts', 'POST', '/buyers', { name: 'Charlie Buyer', registrationNo: 'RC', creditDays: 3 })).body.item;
  const ticketC = (await h.call('auction', 'POST', '/tickets', { lotId: lotC._id, buyerId: buyerC._id, rate: 300, quantity: 5 })).body.item;
  await h.models.AuctionTicket.updateOne({ _id: ticketC._id }, { buyerCreditDueAt: new Date(Date.now() - 3600000), dispatchDueAt: new Date(Date.now() - 3600000) });
  C = { lot: lotC, buyer: buyerC, ticket: ticketC };
  // one fresh arrival with nothing else
  await h.call('gate', 'POST', '/lots', { farmerName: 'Delta Farmer', commodity: 'ઘઉં', bags: 1, estimated: 4 });
});
after(async () => { if (!SKIP) await h.close(); });

/* ───────────────────────────── overview ───────────────────────────── */

test('overview: counts and money totals match the data', { skip: SKIP }, async () => {
  const r = await h.call('inspector', 'GET', '/overview');
  assert.equal(r.status, 200); assert.equal(r.body.role, 'inspector');
  const s = r.body.stats;
  assert.equal(s.totalLots, 4); assert.equal(s.arrived, 1); assert.equal(s.auctioned, 1); assert.equal(s.weighed, 1); assert.equal(s.dispatched, 1);
  assert.equal(s.totalTickets, 3); assert.equal(s.totalBills, 2); assert.equal(s.activeBuyers, 3);
  assert.equal(s.farmerPayable, 20000); assert.equal(s.farmerPaid, 12500); assert.equal(s.farmerDue, 7500);
  assert.equal(s.traderPurchase, 20000); assert.equal(s.traderCollected, 4000); assert.equal(s.traderDue, 16000);
  assert.equal(s.buyerDues, 0); assert.equal(s.buyerDuesPaid, 0);
  assert.equal(s.totalComplaints, 0); assert.equal(s.openComplaints, 0);
});

/* ───────────────────────────── dashboard ───────────────────────────── */

test('dashboard: yard status, stock, dues and arrivals-by-hour', { skip: SKIP }, async () => {
  const d = (await h.call('admin', 'GET', '/dashboard')).body;
  assert.deepEqual({ ...d.status }, { auctionPending: 1, passesIssued: 1, dispatched: 1, inYard: 3, quintalsInside: d.status.quintalsInside });
  assert.equal(d.status.quintalsInside, 20 + 10 + 4, 'weighed net (B=20) + estimated (C=10, Delta=4)');
  assert.equal(d.stock.length, 3); assert.ok(d.stock.every(l => l.status !== 'dispatched'));
  assert.equal(d.arrivalsByHour.length, 24);
  assert.equal(d.arrivalsByHour.reduce((s, x) => s + x.lots, 0), 4, 'all four lots arrived today (IST)');
  assert.deepEqual(d.arrivalsByHour.map(x => x.hour), [...Array(24).keys()]);
  const bill = d.farmerDues.find(x => x.kind === 'bill');
  assert.equal(bill.farmer, 'Bravo Farmer'); assert.equal(bill.payable, 10000); assert.equal(bill.paid, 2500); assert.equal(bill.balance, 7500);
  assert.equal(d.farmerDues.filter(x => x.kind === 'bill').length, 1, 'fully paid bill A is not a due');
  const prov = d.farmerDues.find(x => x.kind === 'provisional');
  assert.equal(prov, undefined, 'trader-sold lot C has no provisional farmer due');
  assert.deepEqual(d.farmerTotals, { payable: 20000, paid: 12500, due: 7500, provisional: 0 });
  const names = d.traderDues.map(t => t.name).sort();
  assert.deepEqual(names, ['Alpha Buyer', 'Bravo Buyer', 'Charlie Buyer']);
  const alpha = d.traderDues.find(t => t.name === 'Alpha Buyer'), charlie = d.traderDues.find(t => t.name === 'Charlie Buyer'), bravo = d.traderDues.find(t => t.name === 'Bravo Buyer');
  assert.equal(alpha.due, 6000); assert.equal(alpha.paid, 4000); assert.equal(alpha.overdue, false);
  assert.equal(bravo.due, 10000);
  assert.equal(charlie.due, 1500); assert.equal(charlie.overdue, true, 'provisional exposure past its credit date is overdue');
  assert.equal(d.recentLots.length, 4);
});

test('dashboard: farmer-sold unbilled tickets appear as provisional dues', { skip: SKIP }, async () => {
  const lot = (await h.call('gate', 'POST', '/lots', { farmerName: 'Echo Farmer', commodity: 'ઘઉં', bags: 1, estimated: 10 })).body.item;
  await h.call('auction', 'POST', '/tickets', { lotId: lot._id, buyerId: B.buyer._id, rate: 200, quantity: 4 });
  const d = (await h.call('admin', 'GET', '/dashboard')).body;
  const prov = d.farmerDues.find(x => x.kind === 'provisional' && x.farmer === 'Echo Farmer');
  assert.equal(prov.payable, 800); assert.equal(prov.balance, 800); assert.equal(prov.lotNumber, lot.lotNumber);
  assert.equal(d.farmerTotals.provisional, 800);
  await h.models.Lot.deleteOne({ _id: lot._id }); await h.models.AuctionTicket.deleteMany({ lot: lot._id });
});

test('dashboard: audit activity is visible only to admin and inspector', { skip: SKIP }, async () => {
  for (const role of ['admin', 'inspector']) assert.ok((await h.call(role, 'GET', '/dashboard')).body.activity.length > 0, role);
  for (const role of ['gate', 'auction', 'weighment', 'accounts']) assert.deepEqual((await h.call(role, 'GET', '/dashboard')).body.activity, [], role);
});

/* ───────────────────────────── nav counts ───────────────────────────── */

test('nav counts: auction queue, overdue farmer / buyer / dispatch, open complaints', { skip: SKIP }, async () => {
  await h.call('gate', 'POST', '/complaints', { complainant: 'X', type: 'Weight', details: 'something is off here' });
  const original = await h.models.SaleBill.findById(B.bill._id);
  await h.models.SaleBill.updateOne({ _id: B.bill._id }, { farmerPaymentDueAt: new Date(Date.now() - 3600000), buyerCreditDueAt: new Date(Date.now() - 3600000) });
  const n = (await h.call('gate', 'GET', '/nav-counts')).body;
  assert.equal(n.openComplaints, 1); assert.equal(n.auctionQueue, 1);
  assert.equal(n.farmerOverdue, 1, 'only bill B has unpaid farmer balance past due');
  assert.equal(n.buyerOverdue, 1, 'only B has an unpaid purchase balance past its credit date (A is unpaid but still within credit)');
  // restore: an overdue buyer is on credit hold, which would block the later tests that auction to this buyer
  await h.models.SaleBill.updateOne({ _id: B.bill._id }, { farmerPaymentDueAt: original.farmerPaymentDueAt, buyerCreditDueAt: original.buyerCreditDueAt });
});

test('nav counts: dispatch overdue counts undispatched lots with an expired dispatch deadline', { skip: SKIP }, async () => {
  const n = (await h.call('gate', 'GET', '/nav-counts')).body;
  assert.equal(n.dispatchOverdue, 1, 'ticket C is overdue and not dispatched; dispatched lot A is excluded');
});

/* ───────────────────────────── search ───────────────────────────── */

test('search: finds lots by farmer / lot number / mobile / vehicle / commodity and returns related tickets', { skip: SKIP }, async () => {
  let r = (await h.call('gate', 'GET', '/search?q=alpha')).body;
  assert.equal(r.lots.length, 1); assert.equal(r.lots[0].farmerName, 'Alpha Farmer'); assert.equal(r.tickets.length, 1);
  assert.equal(r.tickets[0].buyer.name, 'Alpha Buyer');
  assert.deepEqual(Object.keys(r.lots[0]).sort(), ['_id', 'commodity', 'farmerName', 'lotNumber', 'status'], 'lot results expose only summary fields');
  r = (await h.call('gate', 'GET', '/search?q=' + A.lot.lotNumber)).body; assert.equal(r.lots.length, 1);
  r = (await h.call('gate', 'GET', '/search?q=9876543210')).body; assert.equal(r.lots[0].farmerName, 'Charlie Trader');
  r = (await h.call('gate', 'GET', '/search?q=gj01ab')).body; assert.equal(r.lots.length, 2, 'vehicle (case-insensitive)');
  r = (await h.call('gate', 'GET', '/search?q=' + encodeURIComponent('કપાસ'))).body; assert.equal(r.lots.length, 1, 'gujarati commodity');
  r = (await h.call('gate', 'GET', '/search?q=' + A.ticket.ticketNumber)).body; assert.equal(r.tickets.length, 1, 'ticket number search');
  assert.equal(r.tickets[0].ticketNumber, A.ticket.ticketNumber);
});

test('search: needs 2+ chars, trims, caps results, escapes regex, hides voided tickets', { skip: SKIP }, async () => {
  assert.deepEqual((await h.call('gate', 'GET', '/search')).body, { lots: [], tickets: [] });
  assert.deepEqual((await h.call('gate', 'GET', '/search?q=a')).body, { lots: [], tickets: [] });
  assert.deepEqual((await h.call('gate', 'GET', '/search?q=%20a%20')).body, { lots: [], tickets: [] }, 'trimmed first');
  assert.deepEqual((await h.call('gate', 'GET', '/search?q=nomatchatall')).body, { lots: [], tickets: [] });
  assert.equal((await h.call('gate', 'GET', '/search?q=' + encodeURIComponent('.*'))).body.lots.length, 0);
  assert.equal((await h.call('gate', 'GET', '/search?q=' + encodeURIComponent('(('))).status, 200);
  assert.equal((await h.call('gate', 'GET', '/search?q=ALPHA')).body.lots.length, 1, 'case-insensitive');
  assert.equal((await h.call('gate', 'GET', '/search?q[]=ab&q[]=cd')).status, 200, 'array param does not crash');
  const lot = (await h.call('gate', 'POST', '/lots', { farmerName: 'Zulu Voidable', commodity: 'ઘઉં', bags: 1, estimated: 5 })).body.item;
  const t = (await h.call('auction', 'POST', '/tickets', { lotId: lot._id, buyerId: B.buyer._id, rate: 1, quantity: 1 })).body.item;
  assert.equal((await h.call('gate', 'GET', '/search?q=zulu')).body.tickets.length, 1);
  await h.call('admin', 'POST', `/tickets/${t._id}/void`, { reason: 'search must hide this' });
  assert.equal((await h.call('gate', 'GET', '/search?q=zulu')).body.tickets.length, 0);
  await h.models.Lot.deleteOne({ _id: lot._id }); await h.models.AuctionTicket.deleteMany({ lot: lot._id });
});

test('search: result lists are capped (8 lots / 5 tickets)', { skip: SKIP }, async () => {
  const docs = Array.from({ length: 12 }, (_, i) => ({ lotNumber: 'CAP-' + i, farmerName: 'Capped Farmer', commodity: 'ઘઉં', bags: 1, createdBy: h.users.gate._id }));
  await h.models.Lot.insertMany(docs);
  assert.equal((await h.call('gate', 'GET', '/search?q=capped')).body.lots.length, 8);
  await h.models.Lot.deleteMany({ farmerName: 'Capped Farmer' });
});

/* ───────────────────────────── report summary & catalog ───────────────────────────── */

test('report summary: default range is today and totals match', { skip: SKIP }, async () => {
  const r = (await h.call('inspector', 'GET', '/reports/summary')).body;
  assert.equal(r.lots, 4); assert.equal(r.tickets, 3);
  assert.equal(r.bills.bills, 2); assert.equal(r.bills.gross, 20000); assert.equal(r.bills.farmerPayable, 20000); assert.equal(r.bills.farmerPaid, 12500);
  const byType = Object.fromEntries(r.payments.map(p => [p._id, p]));
  assert.equal(byType.farmer_settlement.amount, 12500); assert.equal(byType.farmer_settlement.count, 2); assert.equal(byType.buyer_purchase.amount, 4000);
  assert.equal(r.complaints, 1);
});

test('report summary: explicit ranges, empty ranges and invalid ranges', { skip: SKIP }, async () => {
  const q = (from, to) => h.call('inspector', 'GET', `/reports/summary?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
  let r = await q('2000-01-01', '2000-01-02');
  assert.equal(r.status, 200); assert.equal(r.body.lots, 0); assert.deepEqual(r.body.bills, { bills: 0, gross: 0, farmerPayable: 0, farmerPaid: 0 }); assert.deepEqual(r.body.payments, []);
  assert.equal((await q('2999-01-01', '2000-01-01')).status, 400, 'from after to');
  assert.equal((await q('garbage', '2026-01-01')).status, 400);
  assert.equal((await q('2026-01-01', 'garbage')).status, 400);
  const future = new Date(Date.now() + 86400000).toISOString();
  assert.equal((await h.call('inspector', 'GET', `/reports/summary?from=${encodeURIComponent(future)}`)).status, 400, 'default "to" is now, so a future "from" is invalid');
  r = await q('2000-01-01', new Date(Date.now() + 86400000).toISOString());
  assert.equal(r.body.lots, 4, 'a wide range includes everything');
  assert.equal(r.body.bills.bills, 2);
});

test('report summary: voided tickets are not counted (consistent with overview, catalog and ticket register)', { skip: SKIP }, async () => {
  const count = async () => (await h.call('inspector', 'GET', '/reports/summary')).body.tickets;
  const base = await count();
  const lot = (await h.call('gate', 'POST', '/lots', { farmerName: 'Void Summary', commodity: 'ઘઉં', bags: 1, estimated: 5 })).body.item;
  const t = (await h.call('auction', 'POST', '/tickets', { lotId: lot._id, buyerId: B.buyer._id, rate: 1, quantity: 1 })).body.item;
  assert.equal(await count(), base + 1);
  await h.call('admin', 'POST', `/tickets/${t._id}/void`, { reason: 'summary should ignore this' });
  assert.equal(await count(), base, 'summary ticket count must drop back after the void');
  await h.models.Lot.deleteOne({ _id: lot._id }); await h.models.AuctionTicket.deleteMany({ lot: lot._id });
});

test('report catalog: counts exclude voided tickets / cancelled bills; KPIs are derived from data', { skip: SKIP }, async () => {
  const c = (await h.call('inspector', 'GET', '/reports/catalog')).body;
  assert.equal(c.counts.lots, 4); assert.equal(c.counts.bills, 2); assert.equal(c.counts.payments, 3); assert.equal(c.counts.paidBills, 1); assert.equal(c.counts.complaints, 1);
  assert.ok(c.counts.audit > 10);
  assert.equal(c.kpis.averageRate, (1000 + 500 + 300) / 3); assert.equal(c.kpis.grossSales, 20000); assert.equal(c.kpis.pendingPayable, 7500);
  await h.models.SaleBill.updateOne({ _id: B.bill._id }, { status: 'cancelled' });
  const after = (await h.call('inspector', 'GET', '/reports/catalog')).body;
  assert.equal(after.counts.bills, 1); assert.equal(after.kpis.grossSales, 10000); assert.equal(after.kpis.pendingPayable, 0);
  await h.models.SaleBill.updateOne({ _id: B.bill._id }, { status: 'part_paid' });
});

/* ───────────────────────────── CSV export ───────────────────────────── */

const lines = r => r.body.replace(/^﻿/, '').split('\r\n').filter(Boolean);

test('CSV export: every dataset streams with BOM, header row, attachment filename and CRLF rows', { skip: SKIP }, async () => {
  for (const [key, d] of Object.entries(DATASETS)) {
    const r = await h.call('admin', 'GET', '/reports/export/' + key);
    assert.equal(r.status, 200, key);
    assert.match(r.headers.get('content-type'), /^text\/csv; charset=utf-8/, key);
    assert.equal(r.headers.get('content-disposition'), `attachment; filename="${d.file}"`, key);
    assert.deepEqual([...r.bytes.slice(0, 3)], [0xEF, 0xBB, 0xBF], `${key} UTF-8 BOM`);
    assert.equal(lines(r)[0], d.headers.map(x => `"${x}"`).join(','), `${key} header`);
    assert.ok(lines(r).length >= 1, key);
  }
});

test('CSV export: row counts and cell contents', { skip: SKIP }, async () => {
  assert.equal(lines(await h.call('admin', 'GET', '/reports/export/lots')).length, 1 + 4);
  assert.equal(lines(await h.call('admin', 'GET', '/reports/export/tickets')).length, 1 + 3);
  assert.equal(lines(await h.call('admin', 'GET', '/reports/export/bills')).length, 1 + 2);
  assert.equal(lines(await h.call('admin', 'GET', '/reports/export/payments')).length, 1 + 3);
  assert.equal(lines(await h.call('admin', 'GET', '/reports/export/weighments')).length, 1 + 2);
  const bills = lines(await h.call('admin', 'GET', '/reports/export/bills')).join('\n');
  assert.ok(bills.includes('"Alpha Farmer"') && bills.includes('"Alpha Buyer"') && bills.includes('"10000"') && bills.includes('"paid"'));
  const pay = lines(await h.call('admin', 'GET', '/reports/export/payments')).join('\n');
  assert.ok(pay.includes('"RPT-A-FARMER"') && pay.includes('"farmer_settlement"') && pay.includes('"accounts user"'));
  const lots = lines(await h.call('admin', 'GET', '/reports/export/lots')).join('\n');
  assert.ok(lots.includes('"કપાસ"') && lots.includes('"trader"') && lots.includes('"Charlie Trader"'), 'unicode and enums');
});

test('CSV export: voided tickets are excluded from the ticket register', { skip: SKIP }, async () => {
  const lot = (await h.call('gate', 'POST', '/lots', { farmerName: 'Void Csv', commodity: 'ઘઉં', bags: 1, estimated: 5 })).body.item;
  const t = (await h.call('auction', 'POST', '/tickets', { lotId: lot._id, buyerId: B.buyer._id, rate: 1, quantity: 1 })).body.item;
  assert.equal(lines(await h.call('admin', 'GET', '/reports/export/tickets')).length, 1 + 4);
  await h.call('admin', 'POST', `/tickets/${t._id}/void`, { reason: 'exclude from csv please' });
  assert.equal(lines(await h.call('admin', 'GET', '/reports/export/tickets')).length, 1 + 3);
  await h.models.Lot.deleteOne({ _id: lot._id }); await h.models.AuctionTicket.deleteMany({ lot: lot._id });
});

test('CSV export: neutralises formula injection, escapes quotes/commas/newlines', { skip: SKIP }, async () => {
  const evil = ['=1+1', '+SUM(A1)', '-2+3', '@cmd'];
  for (const complainant of evil) await h.call('admin', 'POST', '/complaints', { complainant, type: 'Q', details: 'He said "hi", then\nleft quietly' });
  // `type` is stored untrimmed, so it is the one field that can carry leading TAB / CR characters
  for (const type of ['\tTAB', '\rCR']) await h.call('admin', 'POST', '/complaints', { complainant: 'Tab tester', type, details: 'tab and carriage return test' });
  const body = (await h.call('admin', 'GET', '/reports/export/complaints')).body;
  for (const v of evil) assert.ok(body.includes(`"'${v}"`), `neutralised ${JSON.stringify(v)}`);
  for (const v of ['\tTAB', '\rCR']) assert.ok(body.includes(`"'${v}"`), `neutralised ${JSON.stringify(v)}`);
  assert.ok(body.includes('"He said ""hi"", then\nleft quietly"'), 'quotes doubled, commas and newlines kept inside the quoted cell');
  const cells = [...body.matchAll(/"((?:[^"]|"")*)"/g)].map(m => m[1].replace(/""/g, '"'));
  assert.ok(!cells.some(c => /^[=+\-@\t\r]/.test(c) && !c.startsWith("'") && c !== ''), 'no exported cell starts with a formula trigger');
});

test('CSV export: dates are ISO strings and nullish values become empty cells', { skip: SKIP }, async () => {
  const row = lines(await h.call('admin', 'GET', '/reports/export/lots'))[1];
  assert.match(row, /"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z"/);
  assert.ok(row.includes('""'), 'missing net weight / mobile are empty strings');
  assert.ok(!row.includes('null') && !row.includes('undefined'));
});

test('CSV export: role guards and unknown datasets', { skip: SKIP }, async () => {
  for (const role of ['gate', 'auction', 'weighment', 'accounts']) assert.equal((await h.call(role, 'GET', '/reports/export/audit')).status, 403, role);
  for (const role of ['admin', 'inspector']) assert.equal((await h.call(role, 'GET', '/reports/export/audit')).status, 200, role);
  for (const key of ['nope', 'constructor', 'toString', '__proto__', 'hasOwnProperty', 'LOTS']) assert.equal((await h.call('admin', 'GET', '/reports/export/' + key)).status, 404, key);
  assert.ok(EXPORT_ROW_LIMIT >= 1000);
});
