// Gujarati and Hindi text must be written in Gujarati / Devanagari script. Latin words are allowed only for
// acronyms, product names and technical tokens that are written the same way in every language (ALLOWED below).
// Anything else is an untranslated English word and fails this test, listing the offending keys.
import { describe, it, expect } from 'vitest';
import { messages, NAMESPACES } from './locales/index.js';

export const ALLOWED = new Set(['APMC', 'YardOS', 'UTR', 'CSV', 'QR', 'ID', 'NEFT', 'RTGS', 'IMPS', 'UPI', 'MIS', 'PDF', 'Excel', 'FAQ', 'GJ', 'XX', 'SMS', 'Q', 'KB', 'MB', 'OK', 'IST', 'UTC', 'PIN', 'GPS', 'OTP', 'PAN', 'GST', 'IFSC', 'KYC', 'AM', 'PM']);
// Brand lock-up copied from the reference design.
export const EXEMPT_KEYS = new Set(['nav.brandTagline']);
const stripped = s => s.replace(/\{\w+\}/g, '').replace(/\b[A-Z]{2,}-[A-Z0-9-]+\b/g, '');
export const offenders = (code, filter = () => true) => {
  const out = [];
  for (const [key, value] of Object.entries(messages[code])) {
    if (!filter(key) || EXEMPT_KEYS.has(key)) continue;
    const words = (stripped(value).match(/[A-Za-z][A-Za-z'’]+/g) || []).filter(w => !ALLOWED.has(w));
    if (words.length) out.push(`${key}: ${words.join(' ')}`);
  }
  return out;
};

describe('Gujarati and Hindi catalogues contain no untranslated English words', () => {
  for (const code of ['gu', 'hi']) {
    for (const ns of Object.keys(NAMESPACES)) {
      it(`${code} / ${ns}`, () => {
        expect(offenders(code, k => k.startsWith(ns + '.'))).toEqual([]);
      });
    }
  }
});
