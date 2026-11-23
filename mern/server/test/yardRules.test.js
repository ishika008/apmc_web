import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ROLE_PERMISSIONS, hasPermission, calculateWeighment, calculateBill,
  outstandingBalance, isOverdue, isGatePassEligible
} from '../src/domain/yardRules.js';

test('role permissions are least-privilege and admin has full access', () => {
  assert.equal(hasPermission('admin', 'anything:write'), true);
  assert.equal(hasPermission('gate', 'lots:create'), true);
  assert.equal(hasPermission('gate', 'payments:create'), false);
  assert.equal(hasPermission('inspector', 'audit:read'), true);
  assert.equal(hasPermission('unknown', 'dashboard:read'), false);
  assert.ok(ROLE_PERMISSIONS.accounts.includes('payments:create'));
});

test('weighment computes net weight and rejects impossible values', () => {
  assert.deepEqual(calculateWeighment(18.5, 2.25), { gross: 18.5, tare: 2.25, net: 16.25 });
  assert.throws(() => calculateWeighment(10, 10), /greater than tare/);
  assert.throws(() => calculateWeighment(-1, 0), /valid non-negative/);
  assert.throws(() => calculateWeighment('not-a-number', 1), /valid non-negative/);
});

test('sale bill calculation keeps farmer deduction separate from buyer charges', () => {
  const result = calculateBill({
    netWeight: 10.5, rate: 2000, sellerDeduction: 500,
    buyerMarketFee: 100, buyerOtherDues: 25
  });
  assert.deepEqual(result, {
    grossAmount: 21000, sellerDeduction: 500, farmerNetPayable: 20500,
    buyerMarketFee: 100, buyerOtherDues: 25
  });
  assert.equal(calculateBill({ netWeight: 1, rate: 10, sellerDeduction: 100 }).farmerNetPayable, 0);
  assert.throws(() => calculateBill({ netWeight: 0, rate: 10 }), /must be positive/);
});

test('partial payment outstanding is never negative', () => {
  assert.equal(outstandingBalance(1000, 350), 650);
  assert.equal(outstandingBalance(1000, 1000), 0);
  assert.equal(outstandingBalance(1000, 1500), 0);
});

test('overdue check needs a positive balance and past due date', () => {
  const now = new Date('2026-11-20T10:00:00Z');
  assert.equal(isOverdue(500, '2026-11-19T10:00:00Z', now), true);
  assert.equal(isOverdue(0, '2026-11-19T10:00:00Z', now), false);
  assert.equal(isOverdue(500, '2026-11-21T10:00:00Z', now), false);
});

test('gate pass requires farmer settlement and buyer fees clear; trader credit blocks only when overdue', () => {
  const common = {
    farmerPayable: 2000, farmerPaid: 2000,
    buyerDues: 100, buyerDuesPaid: 100,
    traderBalance: 800, traderDueAt: '2026-11-21T10:00:00Z',
    now: new Date('2026-11-20T10:00:00Z')
  };
  assert.deepEqual(isGatePassEligible(common), { eligible: true, reason: '' });
  assert.match(isGatePassEligible({ ...common, farmerPaid: 1900 }).reason, /Farmer settlement/);
  assert.match(isGatePassEligible({ ...common, buyerDuesPaid: 0 }).reason, /Buyer-side/);
  assert.match(isGatePassEligible({ ...common, traderDueAt: '2026-11-19T10:00:00Z' }).reason, /Trader purchase/);
});
