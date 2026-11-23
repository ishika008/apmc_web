import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { t, setLanguage, getLanguage, getLocale, useI18n, hasKey, translateServerMessage, LANGUAGES, DEFAULT_LANGUAGE, LANGUAGE_STORAGE_KEY } from './index.js';
import { messages, NAMESPACES, LANGUAGE_CODES } from './locales/index.js';
import { LanguageSelect } from './LanguageSelect.jsx';

beforeEach(() => { localStorage.clear(); setLanguage('gu'); });

describe('translation catalogue integrity', () => {
  it('every language has exactly the same keys (a missing translation fails here)', () => {
    const base = Object.keys(messages.gu).sort();
    for (const code of LANGUAGE_CODES) {
      const keys = Object.keys(messages[code]).sort();
      expect({ code, missing: base.filter(k => !keys.includes(k)) }).toEqual({ code, missing: [] });
      expect({ code, extra: keys.filter(k => !base.includes(k)) }).toEqual({ code, extra: [] });
    }
  });
  it('per-namespace files each define all supported languages and only keys with their own prefix', () => {
    for (const [name, ns] of Object.entries(NAMESPACES)) {
      for (const code of LANGUAGE_CODES) {
        expect(ns[code], `${name}.${code}`).toBeTypeOf('object');
        for (const k of Object.keys(ns[code])) expect(k.startsWith(name + '.'), `${k} should start with "${name}."`).toBe(true);
      }
    }
  });
  it('no translation is empty and placeholders match across languages', () => {
    const ph = s => (s.match(/\{\w+\}/g) || []).sort().join(',');
    for (const [key, gu] of Object.entries(messages.gu)) {
      for (const code of LANGUAGE_CODES) {
        const v = messages[code][key];
        expect(typeof v === 'string', `${code}:${key}`).toBe(true);
        expect(v.trim().length > 0, `${code}:${key} empty`).toBe(true);
        expect(ph(v), `${code}:${key} placeholders`).toBe(ph(gu));
      }
    }
  });
  it('Hindi and English are real translations, not copies of the Gujarati text', () => {
    const same = Object.keys(messages.gu).filter(k => !k.startsWith('server.') && messages.gu[k] === messages.hi[k] && /[઀-૿]/.test(messages.gu[k]));
    expect(same).toEqual([]);
    const gujaratiInEnglish = Object.entries(messages.en).filter(([, v]) => /[઀-૿]/.test(v)).map(([k]) => k);
    const gujaratiInHindi = Object.entries(messages.hi).filter(([, v]) => /[઀-૿]/.test(v)).map(([k]) => k);
    expect(gujaratiInEnglish).toEqual([]);
    expect(gujaratiInHindi).toEqual([]);
  });
});

describe('t()', () => {
  it('defaults to Gujarati and switches language', () => {
    expect(DEFAULT_LANGUAGE).toBe('gu'); expect(getLanguage()).toBe('gu');
    setLanguage('en'); expect(t('common.save')).toBe('Save');
    setLanguage('hi'); expect(t('common.save')).toBe('सहेजें');
    setLanguage('gu'); expect(t('common.save')).toBe('સાચવો');
  });
  it('interpolates {vars}, leaves unknown placeholders alone', () => {
    messages.en['test.hello'] = 'Hi {name}, {x}'; messages.gu['test.hello'] = 'નમસ્તે {name}';
    setLanguage('en');
    expect(t('test.hello', { name: 'Ana' })).toBe('Hi Ana, {x}');
    expect(t('test.hello', { name: 'Ana', x: 0 })).toBe('Hi Ana, 0');
    delete messages.en['test.hello']; delete messages.gu['test.hello'];
  });
  it('falls back to English, then Gujarati, then the key', () => {
    messages.gu['test.onlyGu'] = 'ફક્ત'; messages.en['test.onlyEn'] = 'only-en';
    setLanguage('hi');
    expect(t('test.onlyEn')).toBe('only-en'); expect(t('test.onlyGu')).toBe('ફક્ત'); expect(t('test.nothing')).toBe('test.nothing');
    delete messages.gu['test.onlyGu']; delete messages.en['test.onlyEn'];
  });
  it('ignores unsupported languages and persists the supported ones', () => {
    setLanguage('fr'); expect(getLanguage()).toBe('gu');
    setLanguage('en'); expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en');
    expect(document.documentElement.lang).toBe('en'); expect(getLocale()).toBe('en-IN');
  });
  it('declares gu, en and hi', () => { expect(LANGUAGES.map(l => l.code)).toEqual(['gu', 'en', 'hi']); });
});

describe('translateServerMessage', () => {
  it('translates known API messages and passes unknown ones through', () => {
    messages.gu['server.Test failure'] = 'પરીક્ષણ નિષ્ફળ'; messages.en['server.Test failure'] = 'Test failure';
    expect(translateServerMessage('Test failure')).toBe('પરીક્ષણ નિષ્ફળ');
    setLanguage('en'); expect(translateServerMessage('Test failure')).toBe('Test failure');
    expect(translateServerMessage('Something unmapped')).toBe('Something unmapped');
    expect(translateServerMessage('')).toBe(''); expect(hasKey('server.Something unmapped')).toBe(false);
    delete messages.gu['server.Test failure']; delete messages.en['server.Test failure'];
  });
});

describe('useI18n + LanguageSelect', () => {
  const Probe = () => { const { t: tt } = useI18n(); return <p data-testid="p">{tt('common.save')}</p>; };
  it('components re-render when the language changes', () => {
    render(<Probe />);
    expect(screen.getByTestId('p')).toHaveTextContent('સાચવો');
    act(() => setLanguage('en'));
    expect(screen.getByTestId('p')).toHaveTextContent('Save');
  });
  it('selector shows the current code, lists all languages, switches, closes, and persists', async () => {
    const user = userEvent.setup();
    render(<><LanguageSelect /><Probe /></>);
    const btn = screen.getByRole('button', { name: 'ભાષા' });
    expect(btn).toHaveTextContent('GU');
    await user.click(btn);
    expect(screen.getAllByRole('option')).toHaveLength(3);
    await user.click(screen.getByRole('button', { name: /EN\s*English/ }));
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(screen.getByRole('button', { name: 'Language' })).toHaveTextContent('EN');
    expect(screen.getByTestId('p')).toHaveTextContent('Save');
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en');
    await user.click(screen.getByRole('button', { name: 'Language' }));
    await user.click(screen.getByRole('button', { name: /HI\s*हिन्दी/ }));
    expect(screen.getByTestId('p')).toHaveTextContent('सहेजें');
  });
  it('closes on Escape and on outside click', async () => {
    const user = userEvent.setup();
    render(<><LanguageSelect /><p>outside</p></>);
    await user.click(screen.getByRole('button', { name: 'ભાષા' })); expect(screen.getByRole('listbox')).toBeInTheDocument();
    await user.keyboard('{Escape}'); expect(screen.queryByRole('listbox')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'ભાષા' })); await user.click(screen.getByText('outside')); expect(screen.queryByRole('listbox')).toBeNull();
  });
});
