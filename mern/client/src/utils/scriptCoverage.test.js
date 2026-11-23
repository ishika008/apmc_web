// Gujarati / Hindi output of labels, server messages and locale formatting must not contain English words.
import { describe, it, expect, afterEach, vi } from 'vitest';
import { labelFor, textValue, dateTime, money, number } from './format.js';
import { deadlineLabel } from './time.js';
import { setLanguage, translateServerMessage } from '../i18n/index.js';
import { messages } from '../i18n/locales/index.js';

afterEach(() => { setLanguage('gu'); vi.useRealTimers(); });

const ALLOWED = new Set(['APMC', 'YardOS', 'UTR', 'CSV', 'QR', 'ID', 'NEFT', 'RTGS', 'IMPS', 'UPI', 'MIS', 'PDF', 'Excel', 'FAQ', 'Q']);
const latin = s => (String(s).replace(/\{\w+\}/g, '').match(/[A-Za-z]+/g) || []).filter(w => !ALLOWED.has(w));
const LANGS = ['gu', 'en', 'hi'];
// Every enum value the API can send that labelFor / textValue translate.
const STATUS = ['arrived', 'auctioned', 'weighed', 'payment_pending', 'part_paid', 'paid', 'dispatched', 'held'];
const COMPLAINT = ['open', 'investigating', 'resolved', 'rejected'];
const LEDGER = ['farmer_settlement', 'buyer_purchase', 'buyer_fee'];
const METHOD = ['open_outcry', 'e_auction', 'approved_negotiated'];
const ROLES = ['admin', 'gate', 'auction', 'weighment', 'accounts', 'inspector'];
const ALL = [...STATUS, ...COMPLAINT, ...LEDGER, ...METHOD, ...ROLES];
const SCRIPT = { gu: /[઀-૿]/, hi: /[ऀ-ॿ]/ };

describe('labelFor / textValue in gu and hi', () => {
  for (const lang of ['gu', 'hi']) {
    it(`${lang}: every status, complaint, ledger, method and role label is in script, with no English words`, () => {
      setLanguage(lang);
      for (const v of ALL) {
        const label = labelFor(v);
        expect(SCRIPT[lang].test(label), `${lang}:${v} -> ${label}`).toBe(true);
        expect(latin(label), `${lang}:${v} -> ${label}`).toEqual([]);
      }
    });
    it(`${lang}: seller type and active flag render in script`, () => {
      setLanguage(lang);
      for (const out of [textValue('trader', 'sellerType'), textValue('farmer', 'sellerType'), textValue(true, 'active'), textValue(false, 'active')]) {
        expect(SCRIPT[lang].test(out), out).toBe(true); expect(latin(out)).toEqual([]);
      }
    });
    it(`${lang}: labels in the same context are all different (no two enum values share a label)`, () => {
      setLanguage(lang);
      for (const group of [STATUS, COMPLAINT, LEDGER, METHOD, ROLES]) expect(new Set(group.map(labelFor)).size, `${lang}`).toBe(group.length);
    });
  }
  it('en labels stay in English', () => {
    setLanguage('en');
    for (const v of ALL) expect(/[઀-૿ऀ-ॿ]/.test(labelFor(v)), v).toBe(false);
  });
  it('an unknown value is shown unchanged in every language (data, not UI text)', () => {
    for (const lang of LANGS) { setLanguage(lang); expect(labelFor('અજાણ્યું')).toBe('અજાણ્યું'); expect(labelFor('x.y')).toBe('x.y'); expect(labelFor(null)).toBe('—'); expect(labelFor(undefined)).toBe('—'); }
  });
});

describe('server messages in gu and hi', () => {
  const keys = Object.keys(messages.en).filter(k => k.startsWith('server.'));
  it('there are server messages to check', () => { expect(keys.length).toBeGreaterThan(80); });
  for (const lang of ['gu', 'hi']) {
    it(`${lang}: every server message is translated into script with no English words`, () => {
      setLanguage(lang);
      const bad = [];
      for (const key of keys) {
        const value = messages[lang][key];
        if (!SCRIPT[lang].test(value) || latin(value).length) bad.push(`${key} -> ${value}`);
      }
      expect(bad).toEqual([]);
    });
  }
  it('the amount message keeps its number and the ₹ sign in every language', () => {
    for (const lang of LANGS) {
      setLanguage(lang);
      const out = translateServerMessage('Payment exceeds outstanding balance of ₹12,500.5');
      expect(out).toContain('₹12,500.5');
      if (lang !== 'en') { expect(SCRIPT[lang].test(out)).toBe(true); expect(latin(out)).toEqual([]); }
    }
  });
  it('an unknown server message is shown as received', () => {
    for (const lang of LANGS) { setLanguage(lang); expect(translateServerMessage('Something brand new')).toBe('Something brand new'); }
  });
});

describe('locale formatting', () => {
  const iso = '2026-11-22T10:05:00Z';
  it('gu and hi dates use their own month names and 24-hour time (no AM/PM text)', () => {
    for (const lang of ['gu', 'hi']) {
      setLanguage(lang);
      const out = dateTime(iso);
      expect(SCRIPT[lang].test(out), out).toBe(true);
      expect(/[A-Za-z]/.test(out), out).toBe(false);
      expect(out).toMatch(/\d{1,2}:\d{2}$/);
    }
  });
  it('en dates keep the English month and 12-hour clock', () => {
    setLanguage('en'); expect(dateTime(iso)).toMatch(/Nov/); expect(dateTime(iso)).toMatch(/[ap]m$/i);
  });
  it('invalid, empty and nullish dates give a dash in every language (never the English "Invalid Date")', () => {
    for (const lang of LANGS) { setLanguage(lang); for (const v of ['not-a-date', '', null, undefined, 0]) expect(dateTime(v), `${lang}:${v}`).toBe('—'); }
  });
  it('currency and numbers use Indian grouping and Latin digits in every language, including falsy values', () => {
    for (const lang of LANGS) {
      setLanguage(lang);
      expect(money(801900)).toBe('₹8,01,900.00'); expect(money(1234567.891)).toBe('₹12,34,567.89'); expect(money(0)).toBe('₹0.00');
      for (const v of [null, undefined, '', 'abc']) expect(money(v), `${lang}:${v}`).toBe('₹0.00');
      expect(number(1234567.8915)).toBe('12,34,567.892'); expect(number(0)).toBe('0'); expect(number(null)).toBe('0'); expect(number(undefined)).toBe('0');
    }
  });
  it('deadline labels (overdue / hours / day / days) are translated in every language', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-22T00:00:00Z'));
    const cases = { overdue: '2026-11-21T00:00:00Z', hours: '2026-11-22T05:00:00Z', day: '2026-11-23T00:00:00Z', days: '2026-11-25T00:00:00Z' };
    for (const lang of LANGS) {
      setLanguage(lang);
      const outs = Object.entries(cases).map(([k, v]) => [k, deadlineLabel(v)]);
      expect(new Set(outs.map(o => o[1].replace(/\d+/g, '#'))).size >= 3, `${lang}`).toBe(true);
      for (const [k, out] of outs) { if (lang !== 'en') { expect(SCRIPT[lang].test(out), `${lang}:${k}:${out}`).toBe(true); expect(latin(out), `${lang}:${k}:${out}`).toEqual([]); } }
      expect(deadlineLabel('')).toBe('—'); expect(deadlineLabel(null)).toBe('—');
    }
  });
});
