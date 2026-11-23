// Schema-level validation (no database connection needed: validateSync runs the real Mongoose validators).
import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import {
  User, Lot, Buyer, AuctionTicket, Weighment, SaleBill, Payment, GatePass, Complaint, AuditLog, YardConfig, Counter
} from '../src/models/index.js';
import GateEntry from '../src/models/GateEntry.js';

const oid = () => new mongoose.Types.ObjectId();
const errs = doc => Object.keys(doc.validateSync()?.errors || {}).sort();

test('models/index exports every model under its expected name', () => {
  const names = [User, Lot, Buyer, AuctionTicket, Weighment, SaleBill, Payment, GatePass, Complaint, AuditLog, YardConfig, Counter].map(m => m.modelName);
  assert.deepEqual(names, ['User', 'Lot', 'Buyer', 'AuctionTicket', 'Weighment', 'SaleBill', 'Payment', 'GatePass', 'Complaint', 'AuditLog', 'YardConfig', 'Counter']);
});

test('User: required fields, role enum, defaults, lowercase/trim, passwordHash not selected', () => {
  assert.deepEqual(errs(new User({})), ['email', 'name', 'passwordHash']);
  const u = new User({ name: '  A  ', email: '  Ab@C.IO ', passwordHash: 'h' });
  assert.equal(u.validateSync(), undefined);
  assert.equal(u.name, 'A'); assert.equal(u.email, 'ab@c.io');
  assert.equal(u.role, 'inspector', 'least-privileged default role');
  assert.equal(u.active, true); assert.equal(u.lastLoginAt, null);
  assert.deepEqual(errs(new User({ name: 'a', email: 'a@b.c', passwordHash: 'h', role: 'clerk' })), ['role']);
  assert.deepEqual(errs(new User({ name: 'x'.repeat(121), email: 'a@b.c', passwordHash: 'h' })), ['name']);
  assert.equal(User.schema.path('passwordHash').options.select, false);
});

test('Lot: required fields, bags >= 1, enums, defaults, uppercase vehicle', () => {
  assert.deepEqual(errs(new Lot({})), ['bags', 'commodity', 'createdBy', 'farmerName', 'lotNumber']);
  const ok = { lotNumber: 'L1', farmerName: 'F', commodity: 'C', bags: 1, createdBy: oid() };
  const lot = new Lot({ ...ok, vehicle: 'gj01ab1234' });
  assert.equal(lot.validateSync(), undefined);
  assert.equal(lot.vehicle, 'GJ01AB1234');
  assert.equal(lot.status, 'arrived'); assert.equal(lot.sellerType, 'farmer'); assert.equal(lot.state, 'Gujarat');
  assert.equal(lot.quality, 'FAQ'); assert.equal(lot.netWeight, null); assert.equal(lot.billId, null);
  assert.deepEqual(errs(new Lot({ ...ok, bags: 0 })), ['bags']);
  assert.deepEqual(errs(new Lot({ ...ok, status: 'lost' })), ['status']);
  assert.deepEqual(errs(new Lot({ ...ok, sellerType: 'x' })), ['sellerType']);
  assert.deepEqual(errs(new Lot({ ...ok, estimated: -1 })), ['estimated']);
  assert.deepEqual(errs(new Lot({ ...ok, notes: 'n'.repeat(2001) })), ['notes']);
  for (const s of ['arrived', 'auctioned', 'weighed', 'payment_pending', 'paid', 'dispatched', 'held']) assert.equal(new Lot({ ...ok, status: s }).validateSync(), undefined, s);
});

test('Buyer: name/registration required, credit days 0..90, limit >= 0, defaults', () => {
  assert.deepEqual(errs(new Buyer({})), ['name', 'registrationNo']);
  const b = new Buyer({ name: ' P ', registrationNo: ' R ' });
  assert.equal(b.name, 'P'); assert.equal(b.creditDays, 5); assert.equal(b.purchaseLimit, 0); assert.equal(b.active, true);
  assert.deepEqual(errs(new Buyer({ name: 'a', registrationNo: 'r', creditDays: 91 })), ['creditDays']);
  assert.deepEqual(errs(new Buyer({ name: 'a', registrationNo: 'r', creditDays: -1 })), ['creditDays']);
  assert.deepEqual(errs(new Buyer({ name: 'a', registrationNo: 'r', creditDays: 90 })), []);
  assert.deepEqual(errs(new Buyer({ name: 'a', registrationNo: 'r', purchaseLimit: -1 })), ['purchaseLimit']);
  assert.deepEqual(errs(new Buyer({ name: 'a', registrationNo: 'r', notes: 'x'.repeat(1001) })), ['notes']);
});

test('AuctionTicket: required, positive quantity/rate, method enum and default', () => {
  assert.deepEqual(errs(new AuctionTicket({})), ['buyer', 'issuedBy', 'lot', 'quantity', 'rate', 'ticketNumber']);
  const ok = { ticketNumber: 'T', lot: oid(), buyer: oid(), quantity: 1, rate: 1, issuedBy: oid() };
  const t = new AuctionTicket(ok);
  assert.equal(t.validateSync(), undefined); assert.equal(t.method, 'open_outcry'); assert.equal(t.quality, 'FAQ');
  assert.deepEqual(errs(new AuctionTicket({ ...ok, quantity: 0 })), ['quantity']);
  assert.deepEqual(errs(new AuctionTicket({ ...ok, rate: 0.001 })), ['rate']);
  assert.deepEqual(errs(new AuctionTicket({ ...ok, method: 'auction' })), ['method']);
});

test('Weighment: required, gross/net > 0, tare >= 0', () => {
  assert.deepEqual(errs(new Weighment({})), ['gross', 'lot', 'net', 'recordedBy', 'tare']);
  const ok = { lot: oid(), gross: 2, tare: 0, net: 2, recordedBy: oid() };
  assert.equal(new Weighment(ok).validateSync(), undefined);
  assert.deepEqual(errs(new Weighment({ ...ok, gross: 0 })), ['gross']);
  assert.deepEqual(errs(new Weighment({ ...ok, tare: -1 })), ['tare']);
  assert.deepEqual(errs(new Weighment({ ...ok, net: 0 })), ['net']);
  assert.equal(new Weighment(ok).correctionOf, null);
});

test('SaleBill: required fields, status enum, numeric defaults', () => {
  assert.deepEqual(errs(new SaleBill({})), ['billNumber', 'buyer', 'lot', 'ticket']);
  const b = new SaleBill({ billNumber: 'B', lot: oid(), ticket: oid(), buyer: oid() });
  assert.equal(b.validateSync(), undefined);
  assert.equal(b.status, 'payment_pending');
  for (const f of ['sellerDeduction', 'buyerMarketFee', 'buyerOtherDues', 'farmerPaid', 'buyerPurchasePaid', 'buyerDuesPaid']) assert.equal(b[f], 0, f);
  assert.deepEqual(errs(new SaleBill({ billNumber: 'B', lot: oid(), ticket: oid(), buyer: oid(), status: 'void' })), ['status']);
});

test('Payment: required, amount >= 0.01, type & mode enums', () => {
  assert.deepEqual(errs(new Payment({})), ['amount', 'bill', 'lot', 'mode', 'receiptNumber', 'recordedBy', 'reference', 'type']);
  const ok = { receiptNumber: 'R', bill: oid(), lot: oid(), type: 'buyer_fee', amount: 0.01, mode: 'UPI', reference: 'ref', recordedBy: oid() };
  assert.equal(new Payment(ok).validateSync(), undefined);
  assert.deepEqual(errs(new Payment({ ...ok, amount: 0 })), ['amount']);
  assert.deepEqual(errs(new Payment({ ...ok, type: 'refund' })), ['type']);
  assert.deepEqual(errs(new Payment({ ...ok, mode: 'CASH' })), ['mode']);
  for (const m of ['NEFT', 'RTGS', 'IMPS', 'UPI', 'BANK_TRANSFER', 'CASH_APPROVED']) assert.equal(new Payment({ ...ok, mode: m }).validateSync(), undefined, m);
});

test('Payment has a unique compound index on mode+reference+type (duplicate-UTR guard)', () => {
  const idx = Payment.schema.indexes().find(([f]) => f.mode === 1 && f.reference === 1 && f.type === 1);
  assert.ok(idx, 'index exists'); assert.equal(idx[1].unique, true);
});

test('GatePass: required, status enum/default; unique per lot', () => {
  assert.deepEqual(errs(new GatePass({})), ['bill', 'issuedBy', 'lot', 'passNumber']);
  const g = new GatePass({ passNumber: 'P', lot: oid(), bill: oid(), issuedBy: oid() });
  assert.equal(g.validateSync(), undefined); assert.equal(g.status, 'issued');
  assert.deepEqual(errs(new GatePass({ passNumber: 'P', lot: oid(), bill: oid(), issuedBy: oid(), status: 'x' })), ['status']);
  assert.equal(GatePass.schema.path('lot').options.unique, true);
});

test('Complaint: required, details <= 5000, status enum/default', () => {
  assert.deepEqual(errs(new Complaint({})), ['complainant', 'complaintNumber', 'createdBy', 'details', 'type']);
  const ok = { complaintNumber: 'C', complainant: 'a', type: 't', details: 'd', createdBy: oid() };
  const c = new Complaint(ok);
  assert.equal(c.validateSync(), undefined); assert.equal(c.status, 'open'); assert.equal(c.lot, null);
  assert.deepEqual(errs(new Complaint({ ...ok, details: 'x'.repeat(5001) })), ['details']);
  assert.deepEqual(errs(new Complaint({ ...ok, status: 'closed' })), ['status']);
});

test('YardConfig: defaults and numeric bounds', () => {
  const c = new YardConfig({});
  assert.equal(c.validateSync(), undefined);
  assert.equal(c.key, 'yard'); assert.equal(c.timezone, 'Asia/Kolkata'); assert.equal(c.ticketPrefix, 'APMC');
  assert.equal(c.billPrefix, 'SB'); assert.equal(c.passPrefix, 'GP'); assert.equal(c.complaintPrefix, 'CMP');
  assert.equal(c.farmerPaymentDays, 1); assert.equal(c.dispatchDays, 2); assert.equal(c.defaultBuyerCreditDays, 5);
  assert.ok(c.commodities.length >= 8 && c.commodities.includes('ઘઉં'));
  assert.deepEqual(errs(new YardConfig({ farmerPaymentDays: 61 })), ['farmerPaymentDays']);
  assert.deepEqual(errs(new YardConfig({ dispatchDays: 91 })), ['dispatchDays']);
  assert.deepEqual(errs(new YardConfig({ defaultBuyerCreditDays: -1 })), ['defaultBuyerCreditDays']);
  assert.deepEqual(errs(new YardConfig({ sellerApprovedDeduction: -1 })), ['sellerApprovedDeduction']);
  assert.deepEqual(errs(new YardConfig({ buyerMarketFee: -1 })), ['buyerMarketFee']);
});

test('GateEntry: required fields, uppercase vehicle, quantity >= 0', () => {
  assert.deepEqual(errs(new GateEntry({})), ['commodity', 'entryNumber', 'farmerName', 'vehicleNumber']);
  const g = new GateEntry({ entryNumber: 'E', vehicleNumber: 'gj1', farmerName: 'f', commodity: 'c' });
  assert.equal(g.vehicleNumber, 'GJ1'); assert.equal(g.estimatedQuantity, 0);
  assert.deepEqual(errs(new GateEntry({ entryNumber: 'E', vehicleNumber: 'v', farmerName: 'f', commodity: 'c', estimatedQuantity: -1 })), ['estimatedQuantity']);
});

test('Counter uses a string _id and starts at 0', () => {
  const c = new Counter({ _id: 'lot-260101' });
  assert.equal(c._id, 'lot-260101'); assert.equal(c.value, 0);
});

test('AuditLog defaults: actor null; schema blocks mutating query hooks', async () => {
  assert.equal(new AuditLog({}).actor, null);
  // These hooks fire before any network I/O, so they can be exercised without a connection.
  await assert.rejects(() => AuditLog.updateOne({}, { $set: { action: 'x' } }).exec(), /append-only/);
  await assert.rejects(() => AuditLog.findOneAndUpdate({}, { $set: { action: 'x' } }).exec(), /append-only/);
  await assert.rejects(() => AuditLog.deleteOne({}).exec(), /append-only/);
  await assert.rejects(() => AuditLog.deleteMany({}).exec(), /append-only/);
});

test('AuditLog append-only also holds for updateMany, replaceOne, findOneAndDelete/Replace and document save/delete', async () => {
  await assert.rejects(() => AuditLog.updateMany({}, { $set: { reason: 'x' } }).exec(), /append-only/);
  await assert.rejects(() => AuditLog.replaceOne({}, { action: 'x' }).exec(), /append-only/);
  await assert.rejects(() => AuditLog.findOneAndReplace({}, { action: 'x' }).exec(), /append-only/);
  await assert.rejects(() => AuditLog.findOneAndDelete({}).exec(), /append-only/);
  const existing = AuditLog.hydrate({ _id: new mongoose.Types.ObjectId(), action: 'A', reason: 'orig' });
  existing.reason = 'tampered';
  await assert.rejects(() => existing.save(), /append-only/, 'saving a modification to an existing entry');
  await assert.rejects(() => AuditLog.hydrate({ _id: new mongoose.Types.ObjectId(), action: 'A' }).deleteOne(), /append-only/, 'deleting a loaded entry');
});
