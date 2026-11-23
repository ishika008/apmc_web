// Server messages: every message the API can send must have gu/en/hi text, and pattern keys must match correctly.
import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setLanguage, translateServerMessage, hasKey } from './index.js';
import { messages } from './locales/index.js';

afterEach(() => setLanguage('gu'));

const SERVER_SRC = path.resolve(path.dirname(fs.realpathSync(fileURLToPath(import.meta.url))), '../../../server/src');
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? (e.name === 'scripts' ? [] : walk(path.join(d, e.name))) : e.name.endsWith('.js') ? [path.join(d, e.name)] : []);

/** English messages literally present in server/src (fail(…, '…'), json({ message: '…' }), new Error('…')). */
function serverMessages() {
  const found = new Set();
  const patterns = [/fail\(\s*\d+\s*,\s*'((?:[^'\\]|\\.)*)'/g, /json\(\s*\{\s*message:\s*'((?:[^'\\]|\\.)*)'/g, /new Error\(\s*'((?:[^'\\]|\\.)*)'/g];
  for (const file of walk(SERVER_SRC)) {
    const src = fs.readFileSync(file, 'utf8');
    for (const re of patterns) for (const m of src.matchAll(re)) found.add(m[1].replace(/\\'/g, "'"));
  }
  return [...found];
}

describe('server message catalogue', () => {
  const found = serverMessages();
  it('finds a realistic number of server messages (guards the extractor itself)', () => { expect(found.length).toBeGreaterThan(70); });
  it('every English message in server/src has a translation key (exact, or a pattern for a "…₹" concatenation)', () => {
    const missing = found.filter(m => {
      const key = 'server.' + (m.endsWith('₹') ? m + '{amount}' : m);
      return !hasKey(key);
    });
    expect(missing).toEqual([]);
  });
  it('the key set is identical in gu, en and hi and en equals the English server text', () => {
    const keys = Object.keys(messages.en).filter(k => k.startsWith('server.'));
    expect(keys.length).toBeGreaterThanOrEqual(found.length);
    for (const k of keys) { expect(messages.gu[k], k).toBeTruthy(); expect(messages.hi[k], k).toBeTruthy(); }
    for (const m of found.filter(m => !m.endsWith('₹'))) expect(messages.en['server.' + m]).toBe(m);
  });
  it('gu and hi contain no stray Latin sentences: only short technical words remain', () => {
    for (const lang of ['gu', 'hi']) for (const [k, v] of Object.entries(messages[lang])) {
      if (!k.startsWith('server.')) continue;
      const latinWords = v.replace(/\{\w+\}/g, '').match(/[A-Za-z]{2,}/g) || [];
      expect(latinWords.length, `${lang}:${k} -> ${v}`).toBeLessThanOrEqual(4);
    }
  });
  it('gu and hi use their own script', () => {
    for (const [k, v] of Object.entries(messages.gu)) if (k.startsWith('server.')) { expect(/[઀-૿]/.test(v), k).toBe(true); expect(/[ऀ-ॿ]/.test(v), `no Devanagari in gu ${k}`).toBe(false); }
    for (const [k, v] of Object.entries(messages.hi)) if (k.startsWith('server.')) { expect(/[ऀ-ॿ]/.test(v), k).toBe(true); expect(/[઀-૿]/.test(v), `no Gujarati in hi ${k}`).toBe(false); }
  });
});

describe('translateServerMessage', () => {
  it('exact messages translate per language', () => {
    expect(translateServerMessage('Invalid email or password')).toBe('ઇમેઇલ અથવા પાસવર્ડ ખોટો છે');
    setLanguage('en'); expect(translateServerMessage('Invalid email or password')).toBe('Invalid email or password');
    setLanguage('hi'); expect(translateServerMessage('Invalid email or password')).toBe('ईमेल या पासवर्ड गलत है');
  });
  it('pattern keys capture the amount (integers, decimals, large values)', () => {
    for (const amount of ['0', '4000', '4000.5', '12345678.99']) {
      setLanguage('gu'); expect(translateServerMessage(`Payment exceeds outstanding balance of ₹${amount}`)).toBe(`ચુકવણી બાકી રકમ ₹${amount} કરતા વધારે છે`);
      setLanguage('hi'); expect(translateServerMessage(`Payment exceeds outstanding balance of ₹${amount}`)).toBe(`भुगतान बकाया राशि ₹${amount} से अधिक है`);
      setLanguage('en'); expect(translateServerMessage(`Payment exceeds outstanding balance of ₹${amount}`)).toBe(`Payment exceeds outstanding balance of ₹${amount}`);
    }
  });
  it('a pattern only matches the whole message, not a substring', () => {
    expect(translateServerMessage('Oops: Payment exceeds outstanding balance of ₹5')).toBe('Oops: Payment exceeds outstanding balance of ₹5');
    expect(translateServerMessage('Payment exceeds outstanding balance of ₹')).toBe('Payment exceeds outstanding balance of ₹');
  });
  it('exact keys take precedence over patterns', () => {
    messages.gu['server.Total is {n}'] = 'પેટર્ન {n}'; messages.en['server.Total is {n}'] = 'pattern {n}';
    messages.gu['server.Total is 5'] = 'ચોક્કસ'; messages.en['server.Total is 5'] = 'exact';
    expect(translateServerMessage('Total is 5')).toBe('ચોક્કસ'); expect(translateServerMessage('Total is 7')).toBe('પેટર્ન 7');
    for (const k of ['server.Total is {n}', 'server.Total is 5']) { delete messages.gu[k]; delete messages.en[k]; }
  });
  it('regex metacharacters in a message are not interpreted; unknown / empty input passes through', () => {
    expect(translateServerMessage('a.b(c)*[d]')).toBe('a.b(c)*[d]');
    expect(translateServerMessage('')).toBe(''); expect(translateServerMessage(undefined)).toBeUndefined(); expect(translateServerMessage(null)).toBeNull();
  });
});
