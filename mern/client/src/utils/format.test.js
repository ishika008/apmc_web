import { describe, it, expect, vi, afterEach } from 'vitest';
import { labelFor, getPath, textValue, money, number, dateTime } from './format.js';

afterEach(() => vi.useRealTimers());

describe('labelFor', () => {
  it.each([['arrived','આવક નોંધાઈ'],['paid','ચુકવણી પૂર્ણ'],['dispatched','માલ રવાના'],['open','ખુલ્લી'],['farmer_settlement','ખેડૂત ચુકવણી'],['e_auction','ઈ-હરાજી'],['admin','પ્રશાસક'],['inspector','નિરીક્ષક']])('maps %s', (k, v) => expect(labelFor(k)).toBe(v));
  it('falls back to the raw value, or a dash for null/undefined', () => {
    expect(labelFor('weird')).toBe('weird');
    expect(labelFor(null)).toBe('—');
    expect(labelFor(undefined)).toBe('—');
  });
});

describe('getPath', () => {
  it('reads nested values', () => expect(getPath({ a: { b: { c: 3 } } }, 'a.b.c')).toBe(3));
  it('returns undefined for missing/null intermediates', () => {
    expect(getPath({ a: null }, 'a.b')).toBeUndefined();
    expect(getPath({}, 'x.y.z')).toBeUndefined();
  });
  it('reads top-level keys', () => expect(getPath({ k: 0 }, 'k')).toBe(0));
});

describe('money / number / dateTime', () => {
  it('formats rupees in Indian grouping', () => {
    expect(money(1234567.5)).toBe('₹12,34,567.50');
    expect(money(0)).toBe('₹0.00');
    expect(money(undefined)).toBe('₹0.00');
  });
  it('formats numbers with up to 3 decimals', () => {
    expect(number(1234.5678)).toBe('1,234.568');
    expect(number(null)).toBe('0');
  });
  it('formats dates and handles empty', () => {
    expect(dateTime('')).toBe('—');
    expect(dateTime(null)).toBe('—');
    expect(dateTime('2026-03-05T10:30:00Z')).toMatch(/2026/);
  });
});

describe('textValue', () => {
  it('renders empty values as a dash', () => {
    for (const v of [null, undefined, '']) expect(textValue(v, 'anything')).toBe('—');
  });
  it('treats status/type/role/method as labels, not dates (key contains "at" in "status")', () => {
    expect(textValue('paid', 'status')).toBe('ચુકવણી પૂર્ણ');
    expect(textValue('open', 'status')).toBe('ખુલ્લી');
    expect(textValue('farmer_settlement', 'type')).toBe('ખેડૂત ચુકવણી');
    expect(textValue('admin', 'role')).toBe('પ્રશાસક');
    expect(textValue('e_auction', 'method')).toBe('ઈ-હરાજી');
  });
  it('does not treat unrelated keys containing "at" as dates', () => {
    expect(textValue('GJ-REG-1', 'registrationNo')).toBe('GJ-REG-1');
    expect(textValue('Within limit', 'creditStatus')).toBe('Within limit');
    expect(textValue('Patel', 'name')).toBe('Patel');
    expect(textValue('SCALE-1', 'scaleId')).toBe('SCALE-1');
    expect(textValue('GJ05AB', 'vehicle')).toBe('GJ05AB');
    expect(textValue('Rajkot', 'village')).toBe('Rajkot');
    expect(textValue('abc', 'commodity')).toBe('abc');
  });
  it('formats *At keys as date-times', () => {
    expect(textValue('2026-03-05T10:30:00Z', 'arrivalAt')).toMatch(/2026/);
    expect(textValue('2026-03-05T10:30:00Z', 'createdAt')).toMatch(/2026/);
    expect(textValue('2026-03-05T10:30:00Z', 'lastLoginAt')).toMatch(/2026/);
    expect(textValue('2026-03-05T10:30:00Z', 'receivedAt')).toMatch(/2026/);
    expect(textValue('2026-03-05T10:30:00Z', 'dispatchAt')).toMatch(/2026/);
    expect(textValue('2026-03-05T10:30:00Z', 'issuedAt')).toMatch(/2026/);
  });
  it('adds a countdown label to *DueAt keys', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-03-05T10:00:00Z'));
    expect(textValue('2026-03-05T12:00:00Z', 'dispatchDueAt')).toMatch(/· 2 કલાક બાકી$/);
    expect(textValue('2026-03-04T12:00:00Z', 'farmerPaymentDueAt')).toMatch(/· મર્યાદા વટાવી$/);
  });
  it('formats money-like keys', () => {
    for (const k of ['grossAmount', 'farmerNetPayable', 'purchaseLimit', 'gross', 'rate', 'amount', 'ledger.gross', 'ledger.paid', 'ledger.outstanding', 'ledger.exposure'])
      expect(textValue(1500, k)).toBe('₹1,500.00');
    expect(textValue(10, 'someAmount')).toBe('₹10.00');
  });
  it('formats booleans for active, seller types and numbers', () => {
    expect(textValue(true, 'active')).toBe('હા');
    expect(textValue(false, 'active')).toBe('ના');
    expect(textValue('trader', 'sellerType')).toBe('વેપારી');
    expect(textValue('farmer', 'sellerType')).toBe('ખેડૂત');
    expect(textValue(1234.5, 'bags')).toBe('1,234.5');
    expect(textValue(0, 'bags')).toBe('0');
  });
  it('stringifies everything else', () => expect(textValue('plain', 'misc')).toBe('plain'));
});
