// Language-aware behaviour of format.js and time.js. (Gujarati default is covered by format.test.js / time.test.js.)
import { describe, it, expect, afterEach, vi } from 'vitest';
import { labelFor, textValue, dateTime, money, number } from './format.js';
import { deadlineLabel } from './time.js';
import { setLanguage, getLocale } from '../i18n/index.js';
import { messages } from '../i18n/locales/index.js';

afterEach(() => { setLanguage('gu'); vi.useRealTimers(); });

const VALUES = ['arrived', 'auctioned', 'weighed', 'payment_pending', 'part_paid', 'paid', 'dispatched', 'held', 'open', 'investigating', 'resolved', 'rejected',
  'farmer_settlement', 'buyer_purchase', 'buyer_fee', 'open_outcry', 'e_auction', 'approved_negotiated', 'admin', 'gate', 'auction', 'weighment', 'accounts', 'inspector'];

describe('labelFor in every language', () => {
  it('has a label for every enum value in gu, en and hi', () => {
    for (const lang of ['gu', 'en', 'hi']) for (const v of VALUES) expect(messages[lang]['status.' + v], `${lang}:${v}`).toBeTruthy();
  });
  it('gu is written in Gujarati script', () => {
    expect(labelFor('arrived')).toBe('આવક નોંધાઈ'); expect(labelFor('paid')).toBe('ચુકવણી પૂર્ણ'); expect(labelFor('held')).toBe('હોલ્ડ');
    expect(labelFor('admin')).toBe('પ્રશાસક'); expect(labelFor('approved_negotiated')).toBe('મંજૂર વાટાઘાટ');
  });
  it('en and hi return real translations', () => {
    setLanguage('en');
    expect(labelFor('arrived')).toBe('Arrival recorded'); expect(labelFor('part_paid')).toBe('Part paid'); expect(labelFor('farmer_settlement')).toBe('Farmer settlement');
    setLanguage('hi');
    expect(labelFor('arrived')).toBe('आवक दर्ज'); expect(labelFor('paid')).toBe('भुगतान पूर्ण'); expect(labelFor('inspector')).toBe('निरीक्षक');
  });
  it('unknown / empty values are shown as given, in every language', () => {
    for (const lang of ['gu', 'en', 'hi']) {
      setLanguage(lang);
      expect(labelFor('mystery')).toBe('mystery'); expect(labelFor(null)).toBe('—'); expect(labelFor(undefined)).toBe('—'); expect(labelFor(7)).toBe('7');
      expect(labelFor('seller.trader'), 'dotted values never hit namespaced keys').toBe('seller.trader');
    }
  });
});

describe('textValue in every language', () => {
  it('translates yes/no, seller type and status cells', () => {
    setLanguage('en');
    expect(textValue(true, 'active')).toBe('Yes'); expect(textValue(false, 'active')).toBe('No');
    expect(textValue('trader', 'sellerType')).toBe('Trader'); expect(textValue('farmer', 'sellerType')).toBe('Farmer');
    expect(textValue('paid', 'status')).toBe('Paid'); expect(textValue('admin', 'role')).toBe('Administrator');
    setLanguage('hi');
    expect(textValue(true, 'active')).toBe('हाँ'); expect(textValue('trader', 'sellerType')).toBe('व्यापारी'); expect(textValue('open_outcry', 'method')).toBe('खुली नीलामी');
    setLanguage('gu');
    expect(textValue(false, 'active')).toBe('ના'); expect(textValue('farmer', 'sellerType')).toBe('ખેડૂત');
  });
  it('registrationNo and village are never treated as dates (regression for the /At$/ fix)', () => {
    for (const lang of ['gu', 'en', 'hi']) { setLanguage(lang); expect(textValue('GJ-TR-041', 'registrationNo')).toBe('GJ-TR-041'); expect(textValue('Kamrej', 'village')).toBe('Kamrej'); }
  });
});

describe('dateTime uses the active locale', () => {
  const iso = '2026-11-22T05:43:00Z';
  it('formats with gu-IN / en-IN / hi-IN and the outputs differ', () => {
    const out = {};
    for (const lang of ['gu', 'en', 'hi']) {
      setLanguage(lang);
      expect(() => dateTime(iso)).not.toThrow();
      out[lang] = dateTime(iso);
      expect(out[lang]).toBe(new Date(iso).toLocaleString(getLocale(), { dateStyle: 'medium', timeStyle: 'short', ...(lang === 'en' ? {} : { hourCycle: 'h23' }) }));
      expect(out[lang]).toMatch(/2026/);
    }
    expect(getLocale()).toBe('hi-IN');
    expect(new Set(Object.values(out)).size).toBe(3);
    expect(out.en).toMatch(/Nov/);
    expect(out.gu).toMatch(/[઀-૿]/); expect(out.hi).toMatch(/[ऀ-ॿ]/);
  });
  it('falsy input is "—" in every language', () => {
    for (const lang of ['gu', 'en', 'hi']) { setLanguage(lang); expect(dateTime('')).toBe('—'); expect(dateTime(null)).toBe('—'); expect(dateTime(undefined)).toBe('—'); }
  });
  it('a *DueAt cell combines the localised date and the localised countdown', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-22T00:00:00Z'));
    setLanguage('en');
    expect(textValue('2026-11-22T10:00:00Z', 'farmerPaymentDueAt')).toMatch(/Nov.*· 10 hr left$/);
  });
});

describe('money and number keep en-IN grouping in every language', () => {
  it('uses lakh grouping and Latin digits regardless of language', () => {
    for (const lang of ['gu', 'en', 'hi']) {
      setLanguage(lang);
      expect(money(100000)).toBe('₹1,00,000.00'); expect(number(1234567.891)).toBe('12,34,567.891'); expect(money(null)).toBe('₹0.00');
    }
  });
});

describe('deadlineLabel in every language', () => {
  const setNow = () => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-22T00:00:00Z')); };
  const at = h => new Date(Date.parse('2026-11-22T00:00:00Z') + h * 3600000).toISOString();
  it('gu is unchanged', () => {
    setNow();
    expect(deadlineLabel(at(-1))).toBe('મર્યાદા વટાવી'); expect(deadlineLabel(at(5))).toBe('5 કલાક બાકી'); expect(deadlineLabel(at(49))).toBe('3 દિવસ બાકી'); expect(deadlineLabel('')).toBe('—');
  });
  it('en and hi translate overdue, hours and days with the count interpolated', () => {
    setNow();
    setLanguage('en');
    expect(deadlineLabel(at(-1))).toBe('Deadline passed'); expect(deadlineLabel(at(5))).toBe('5 hr left'); expect(deadlineLabel(at(23))).toBe('23 hr left'); expect(deadlineLabel(at(24))).toBe('1 day left'); expect(deadlineLabel(at(24.5))).toBe('2 days left'); expect(deadlineLabel(null)).toBe('—');
    setLanguage('hi');
    expect(deadlineLabel(at(-1))).toBe('समय सीमा बीत गई'); expect(deadlineLabel(at(5))).toBe('5 घंटे बाकी'); expect(deadlineLabel(at(49))).toBe('3 दिन बाकी');
  });
});
