import { deadlineLabel } from './time.js';
import { t, hasKey, getLocale, getLanguage } from '../i18n/index.js';
// Labels are translated ('status.<value>'); a value without a translation is shown as-is.
export const labelFor = value => {
  const key = 'status.' + value;
  return typeof value === 'string' && !value.includes('.') && hasKey(key) ? t(key) : String(value ?? '—');
};
export const getPath = (obj,path) => path.split('.').reduce((v,k)=>v?.[k],obj);
/** Audit-trail codes written by the API (e.g. GATE_ENTRY_CREATED / Lot) shown in the selected language; unknown codes pass through. */
export const auditLabel = (kind, value) => { const key = 'audit.' + kind + '.' + value; const text = t(key); return text === key ? String(value ?? '—') : text; };
export const textValue = (value,key) => {
  if (value === null || value === undefined || value === '') return '—';
  if (key.endsWith('DueAt')) return dateTime(value) + ' · ' + deadlineLabel(value);
  if (key.toLowerCase().includes('amount') || ['grossAmount','farmerNetPayable','purchaseLimit','gross','rate','amount','ledger.gross','ledger.paid','ledger.outstanding','ledger.exposure'].includes(key)) return money(value);
  if (/At$/.test(key)) return dateTime(value);
  if (key === 'action') return auditLabel('action', value);
  if (key === 'resource') return auditLabel('resource', value);
  if (key === 'active') return value ? t('common.yes') : t('common.no');
  if (key === 'sellerType') return value === 'trader' ? t('status.seller.trader') : t('status.seller.farmer');
  if (key === 'status' || key === 'type' || key === 'role' || key === 'method') return labelFor(value);
  if (typeof value === 'number') return number(value);
  return String(value);
};
// Money and quantities always use en-IN grouping (1,00,000.00) whatever the UI language: it is the Indian
// convention for rupee amounts and keeps Latin digits so figures read the same on every screen and in CSV.
// Non-numeric input is shown as zero rather than the text "NaN".
const numeric = value => { const n = Number(value || 0); return Number.isFinite(n) ? n : 0; };
export const money = value => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(numeric(value));
export const number = value => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 3 }).format(numeric(value));
export const dateTime = value => {
  if (!value) return '—';
  const date = new Date(value);
  // gu/hi use 24-hour time: their 12-hour clock prints Latin "PM"/"pm", i.e. English text inside a Gujarati/Hindi screen.
  // An unparseable value would otherwise render the English text "Invalid Date" in every language.
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString(getLocale(), { dateStyle: 'medium', timeStyle: 'short', ...(getLanguage() === 'en' ? {} : { hourCycle: 'h23' }) });
};
