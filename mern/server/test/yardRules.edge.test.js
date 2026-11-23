import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ROLE_PERMISSIONS, hasPermission, roundMoney, calculateWeighment, calculateBill,
  outstandingBalance, isOverdue, isGatePassEligible
} from '../src/domain/yardRules.js';

test('ROLE_PERMISSIONS is frozen and defines exactly the six roles', () => {
  assert.deepEqual(Object.keys(ROLE_PERMISSIONS).sort(), ['accounts', 'admin', 'auction', 'gate', 'inspector', 'weighment']);
  assert.ok(Object.isFrozen(ROLE_PERMISSIONS));
});

test('hasPermission: each role holds exactly its own write permissions', () => {
  const writes = {
    gate: ['lots:create', 'gatepass:issue', 'gatepass:dispatch'],
    auction: ['tickets:create'],
    weighment: ['weighments:create'],
    accounts: ['payments:create', 'buyers:write'],
    inspector: ['complaints:write']
  };
  for (const [role, perms] of Object.entries(writes)) for (const p of perms) assert.equal(hasPermission(role, p), true, `${role} ${p}`);
  assert.equal(hasPermission('auction', 'lots:create'), false);
  assert.equal(hasPermission('weighment', 'tickets:create'), false);
  assert.equal(hasPermission('inspector', 'payments:create'), false);
  assert.equal(hasPermission('accounts', 'gatepass:issue'), false);
  assert.equal(hasPermission('gate', 'audit:read'), false);
});

test('hasPermission: unknown/undefined/null roles get nothing; "*" only via admin', () => {
  for (const role of [undefined, null, '', 'root', 'ADMIN']) assert.equal(hasPermission(role, 'dashboard:read'), false);
  assert.equal(hasPermission('gate', '*'), false);
  assert.equal(hasPermission('admin', ''), true);
});

test('roundMoney: rounds half-up to 2 decimals and handles float noise', () => {
  assert.equal(roundMoney(1.005), 1.01);
  assert.equal(roundMoney(0.1 + 0.2), 0.3);
  assert.equal(roundMoney('12.345'), 12.35);
  assert.equal(roundMoney(0), 0);
  assert.equal(roundMoney(-1.234), -1.23);
  assert.ok(Number.isNaN(roundMoney('abc')));
});

test('calculateWeighment: boundaries and numeric strings', () => {
  assert.deepEqual(calculateWeighment('18', '3'), { gross: 18, tare: 3, net: 15 });
  assert.deepEqual(calculateWeighment(0.01, 0), { gross: 0.01, tare: 0, net: 0.01 });
  assert.deepEqual(calculateWeighment(10, 0), { gross: 10, tare: 0, net: 10 });
  assert.throws(() => calculateWeighment(0, 0), /valid non-negative/);
  assert.throws(() => calculateWeighment(10, -0.1), /valid non-negative/);
  assert.throws(() => calculateWeighment(5, 10), /greater than tare/);
  assert.throws(() => calculateWeighment(Infinity, 1), /valid non-negative/);
  assert.throws(() => calculateWeighment(NaN, 1), /valid non-negative/);
  assert.throws(() => calculateWeighment(10, NaN), /valid non-negative/);
  // Number(undefined) = NaN, Number(null) = 0 -> tare null is "0", gross null is rejected (<= 0)
  assert.throws(() => calculateWeighment(undefined, 1), /valid non-negative/);
  assert.throws(() => calculateWeighment(null, 1), /valid non-negative/);
});

test('calculateWeighment: net is rounded to two decimals (current behaviour, see test report note)', () => {
  assert.equal(calculateWeighment(10.337, 0.1).net, 10.24);
  // Consequence worth a business decision: the UI allows 3-decimal readings, but a net below 0.005 Q rounds to 0 and is rejected.
  assert.throws(() => calculateWeighment(0.004, 0), /greater than tare/);
});

test('calculateBill: defaults, rounding and deduction capping', () => {
  assert.deepEqual(calculateBill({ netWeight: 10, rate: 100 }), {
    grossAmount: 1000, sellerDeduction: 0, farmerNetPayable: 1000, buyerMarketFee: 0, buyerOtherDues: 0
  });
  const capped = calculateBill({ netWeight: 1, rate: 10, sellerDeduction: 500 });
  assert.equal(capped.sellerDeduction, 10, 'deduction never exceeds gross');
  assert.equal(capped.farmerNetPayable, 0);
  assert.equal(calculateBill({ netWeight: 1.234, rate: 99.99 }).grossAmount, 123.39);
  assert.equal(calculateBill({ netWeight: 1, rate: 1, buyerMarketFee: 0.005 }).buyerMarketFee, 0.01);
});

test('calculateBill: rejects invalid inputs', () => {
  for (const bad of [
    { netWeight: 0, rate: 10 }, { netWeight: -1, rate: 10 }, { netWeight: 1, rate: 0 }, { netWeight: 1, rate: -5 },
    { netWeight: 'x', rate: 10 }, { netWeight: 1, rate: NaN }, { netWeight: Infinity, rate: 1 }
  ]) assert.throws(() => calculateBill(bad), /must be positive/, JSON.stringify(bad));
  for (const bad of [{ sellerDeduction: -1 }, { buyerMarketFee: -1 }, { buyerOtherDues: -0.01 }, { sellerDeduction: 'x' }, { buyerMarketFee: NaN }])
    assert.throws(() => calculateBill({ netWeight: 1, rate: 10, ...bad }), /non-negative valid/, JSON.stringify(bad));
});

test('outstandingBalance: null/undefined/strings and float noise', () => {
  assert.equal(outstandingBalance(undefined, undefined), 0);
  assert.equal(outstandingBalance('1000', '250.5'), 749.5);
  assert.equal(outstandingBalance(0.3, 0.1), 0.2);
  assert.equal(outstandingBalance(null, 5), 0);
});

test('isOverdue: missing due date, equality and invalid input', () => {
  const now = new Date('2026-11-20T10:00:00Z');
  assert.equal(isOverdue(500, undefined, now), false);
  assert.equal(isOverdue(500, null, now), false);
  assert.equal(isOverdue(500, '2026-11-20T10:00:00Z', now), false, 'due exactly now is not yet overdue');
  assert.equal(isOverdue(500, '2026-11-20T09:59:59Z', now), true);
  assert.equal(isOverdue(-5, '2026-11-01T00:00:00Z', now), false);
  assert.equal(isOverdue(500, new Date('2026-11-19'), '2026-11-20T10:00:00Z'), true, 'accepts Date and ISO string for both args');
  assert.equal(isOverdue(500, '2026-11-01T00:00:00Z'), true, 'default now is the real clock');
});

test('isGatePassEligible: checks are evaluated in farmer → buyer dues → trader credit order', () => {
  const base = { farmerPayable: 100, farmerPaid: 100, buyerDues: 10, buyerDuesPaid: 10, traderBalance: 0, traderDueAt: null };
  assert.deepEqual(isGatePassEligible(base), { eligible: true, reason: '' });
  const all = { farmerPayable: 100, farmerPaid: 0, buyerDues: 10, buyerDuesPaid: 0, traderBalance: 50, traderDueAt: '2000-01-01' };
  assert.match(isGatePassEligible(all).reason, /Farmer/);
  assert.match(isGatePassEligible({ ...all, farmerPaid: 100 }).reason, /Buyer-side/);
  assert.match(isGatePassEligible({ ...all, farmerPaid: 100, buyerDuesPaid: 10 }).reason, /Trader purchase/);
});

test('isGatePassEligible: trader balance with a future due date does not block; zero balance never blocks', () => {
  const now = new Date('2026-11-20T00:00:00Z');
  const base = { farmerPayable: 1, farmerPaid: 1, buyerDues: 0, buyerDuesPaid: 0, now };
  assert.equal(isGatePassEligible({ ...base, traderBalance: 999, traderDueAt: '2026-12-01' }).eligible, true);
  assert.equal(isGatePassEligible({ ...base, traderBalance: 0, traderDueAt: '2020-01-01' }).eligible, true);
  assert.equal(isGatePassEligible({ ...base, traderBalance: 999, traderDueAt: undefined }).eligible, true);
});

test('isGatePassEligible: sub-paisa remainders are rounded away, a one-paisa shortfall blocks', () => {
  const base = { buyerDues: 0, buyerDuesPaid: 0, traderBalance: 0 };
  assert.equal(isGatePassEligible({ ...base, farmerPayable: 100.004, farmerPaid: 100 }).eligible, true);
  assert.equal(isGatePassEligible({ ...base, farmerPayable: 100.01, farmerPaid: 100 }).eligible, false);
});
