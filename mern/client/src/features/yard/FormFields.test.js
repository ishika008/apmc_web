import { describe, it, expect } from 'vitest';
import { FormFieldsFor, field } from './FormFields.jsx';

const keys = (page, o = {}) => FormFieldsFor(page, o).map(f => f.key);
const get = (page, key, o = {}) => FormFieldsFor(page, o).find(f => f.key === key);

describe('field()', () => {
  it('builds a field with defaults and extras', () => {
    expect(field('a', 'A')).toEqual({ key: 'a', label: 'A', type: 'text' });
    expect(field('a', 'A', 'number', { min: 1 })).toEqual({ key: 'a', label: 'A', type: 'number', min: 1 });
  });
});

describe('FormFieldsFor', () => {
  it('returns an empty list for unknown pages', () => { expect(FormFieldsFor('nope', {})).toEqual([]); expect(FormFieldsFor('sales', {})).toEqual([]); });
  it('every field of every form has a unique key, a label and a valid type', () => {
    for (const page of ['gate', 'auction', 'weighment', 'payments', 'buyerledger', 'gatepass', 'disputes', 'users']) {
      const fields = FormFieldsFor(page, {});
      expect(fields.length, page).toBeGreaterThan(0);
      expect(new Set(fields.map(f => f.key)).size, page).toBe(fields.length);
      for (const f of fields) { expect(f.label, page + f.key).toBeTruthy(); expect(['text', 'number', 'select', 'textarea', 'password', 'email']).toContain(f.type); }
    }
  });
  it('gate form matches server expectations', () => {
    expect(keys('gate')).toEqual(expect.arrayContaining(['sellerType', 'farmerName', 'mobile', 'village', 'commodity', 'bags', 'vehicle', 'estimated', 'quality']));
    expect(get('gate', 'sellerType').defaultValue).toBe('farmer');
    expect(get('gate', 'bags')).toMatchObject({ min: 1, step: 1, required: true });
    expect(get('gate', 'commodity').options).toEqual([]);
    expect(get('gate', 'commodity', { commodities: [{ value: 'x', label: 'x' }] }).options).toHaveLength(1);
    for (const k of ['farmerName', 'mobile', 'village', 'commodity']) expect(get('gate', k).required).toBe(true);
  });
  it('auction form requires lot, buyer, positive rate and quantity and wires options', () => {
    const o = { lots: [{ value: 'l' }], buyers: [{ value: 'b' }] };
    expect(get('auction', 'lotId', o).options).toEqual(o.lots);
    expect(get('auction', 'buyerId', o).options).toEqual(o.buyers);
    expect(get('auction', 'rate')).toMatchObject({ required: true, min: 0.01 });
    expect(get('auction', 'quantity')).toMatchObject({ required: true, min: 0.001 });
    expect(get('auction', 'method').options.map(x => x.value)).toEqual(['open_outcry', 'e_auction', 'approved_negotiated']);
  });
  it('weighment form: gross > 0, tare >= 0, correction reason optional', () => {
    expect(get('weighment', 'gross')).toMatchObject({ required: true, min: 0.001 });
    expect(get('weighment', 'tare')).toMatchObject({ required: true, min: 0 });
    expect(get('weighment', 'correctionReason').required).toBeUndefined();
  });
  it('payments form offers exactly the server ledger types and payment modes', () => {
    expect(get('payments', 'type').options.map(o => o.value)).toEqual(['farmer_settlement', 'buyer_purchase', 'buyer_fee']);
    expect(get('payments', 'mode').options.map(o => o.value)).toEqual(['NEFT', 'RTGS', 'IMPS', 'UPI', 'BANK_TRANSFER', 'CASH_APPROVED']);
    expect(get('payments', 'amount')).toMatchObject({ required: true, min: 0.01 });
    expect(get('payments', 'reference').required).toBe(true);
  });
  it('buyer ledger form limits credit days to 0..90', () => {
    expect(get('buyerledger', 'creditDays')).toMatchObject({ min: 0, max: 90, defaultValue: 5 });
    expect(get('buyerledger', 'name').required).toBe(true);
    expect(get('buyerledger', 'registrationNo').required).toBe(true);
  });
  it('gate pass form', () => {
    expect(keys('gatepass')).toEqual(['lotId', 'overrideReason']);
  });
  it('complaint form allows an unlinked complaint first', () => {
    expect(get('disputes', 'lotId', { lots: [{ value: 'l', label: 'L' }] }).options[0]).toEqual({ value: '', label: 'લિંક વગરની ફરિયાદ' });
    expect(get('disputes', 'details').required).toBe(true);
    expect(get('disputes', 'details').type).toBe('textarea');
  });
  it('users form uses password/email types and every role', () => {
    expect(get('users', 'password').type).toBe('password');
    expect(get('users', 'email').type).toBe('email');
    expect(get('users', 'role').options.map(o => o.value).sort()).toEqual(['accounts', 'admin', 'auction', 'gate', 'inspector', 'weighment']);
  });
});
