/**
 * Centralised translation system (no external dependency).
 *
 *  - Messages live in `locales/<namespace>.js`; each exports `{ gu: {...}, en: {...}, hi: {...} }` with flat
 *    keys such as 'nav.dashboard'. `locales/index.js` merges them. Adding a language = add it to LANGUAGES and
 *    give every namespace file an entry for it (the parity test in i18n.test.js fails until that is done).
 *  - `t(key, vars)` works anywhere (components, utils, services). Components should call `useI18n()` so they
 *    re-render when the language changes.
 *  - The chosen language is persisted in localStorage and mirrored to <html lang>.
 *  - Missing key fallback order: selected language → English → Gujarati (the application's source text) → the key.
 */
import { useSyncExternalStore } from 'react';
import { messages } from './locales/index.js';

export const LANGUAGES = [
  { code: 'gu', short: 'GU', label: 'ગુજરાતી', locale: 'gu-IN' },
  { code: 'en', short: 'EN', label: 'English', locale: 'en-IN' },
  { code: 'hi', short: 'HI', label: 'हिन्दी', locale: 'hi-IN' }
];
export const DEFAULT_LANGUAGE = 'gu';
export const LANGUAGE_STORAGE_KEY = 'apmc_yard_lang_v1';

const isSupported = code => LANGUAGES.some(l => l.code === code);
const readStored = () => { try { const v = localStorage.getItem(LANGUAGE_STORAGE_KEY); return isSupported(v) ? v : null; } catch { return null; } };

let current = readStored() || DEFAULT_LANGUAGE;
const listeners = new Set();
const applyDocumentLang = () => { try { if (typeof document !== 'undefined') { document.documentElement.lang = current; document.title = messages[current]?.['common.docTitle'] || document.title; } } catch { /* non-browser */ } };
applyDocumentLang();

export const getLanguage = () => current;
export const getLocale = () => (LANGUAGES.find(l => l.code === current) || LANGUAGES[0]).locale;

export function setLanguage(code) {
  if (!isSupported(code) || code === current) return;
  current = code;
  try { localStorage.setItem(LANGUAGE_STORAGE_KEY, code); } catch { /* storage unavailable: keep in memory */ }
  applyDocumentLang();
  listeners.forEach(fn => fn());
}

const subscribe = fn => { listeners.add(fn); return () => listeners.delete(fn); };

/** Translate `key`; `{name}` placeholders are filled from `vars`. */
export function t(key, vars) {
  const text = messages[current]?.[key] ?? messages.en?.[key] ?? messages.gu?.[key] ?? key;
  return vars ? text.replace(/\{(\w+)\}/g, (m, name) => (vars[name] === undefined ? m : String(vars[name]))) : text;
}

/** True when a translation exists for the key in the selected language (used for server messages). */
export const hasKey = key => Boolean(messages[current]?.[key] ?? messages.en?.[key] ?? messages.gu?.[key]);

/**
 * Server (API) messages are plain English strings. They are looked up under `server.<message>`;
 * unknown messages are shown as they came.
 */
export function translateServerMessage(message) {
  if (!message) return message;
  const exact = 'server.' + message;
  if (hasKey(exact)) return t(exact);
  // Pattern keys ('server.… ₹{amount}'): turn each key's {name} placeholders into capture groups.
  for (const key of Object.keys(messages.en)) {
    if (!key.startsWith('server.') || !/\{\w+\}/.test(key)) continue;
    const names = [];
    const source = key.slice(7).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\{(\w+)\\\}/g, (m, name) => { names.push(name); return '(.+?)'; });
    const match = new RegExp('^' + source + '$').exec(message);
    if (match) return t(key, Object.fromEntries(names.map((name, i) => [name, match[i + 1]])));
  }
  return message;
}

/** Subscribes the calling component to language changes; returns `{ t, lang, setLanguage, languages, locale }`. */
export function useI18n() {
  const lang = useSyncExternalStore(subscribe, getLanguage, getLanguage);
  return { t, lang, locale: getLocale(), setLanguage, languages: LANGUAGES };
}
