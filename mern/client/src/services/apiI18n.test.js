// Errors raised by api() / downloadFile() are shown to users, so they are translated at the source.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api, downloadFile, setSession } from './api.js';
import { mockFetch, jsonResponse } from '../test/mockFetch.js';
import { setLanguage } from '../i18n/index.js';

beforeEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.clear(); });
afterEach(() => setLanguage('gu'));
const msg = async p => { try { await p; return null; } catch (e) { return e.message; } };

describe('api() error translation', () => {
  it('known server messages follow the selected language (401 clears the session as before)', async () => {
    mockFetch({ 'GET /x': { status: 401, body: { message: 'Invalid or expired token' } } });
    setSession({ token: 't' });
    expect(await msg(api('/x'))).toBe('ટોકન અમાન્ય છે અથવા સમાપ્ત થઈ ગયો છે');
    expect(localStorage.getItem('apmc_yard_session_v1')).toBeNull();
    setLanguage('en'); expect(await msg(api('/x'))).toBe('Invalid or expired token');
    setLanguage('hi'); expect(await msg(api('/x'))).toBe('टोकन अमान्य है या समाप्त हो गया है');
  });
  it('unknown server messages pass through unchanged in every language', async () => {
    mockFetch({ 'POST /y': { status: 400, body: { message: 'Something brand new' } } });
    for (const l of ['gu', 'en', 'hi']) { setLanguage(l); expect(await msg(api('/y', { method: 'POST', body: {} }))).toBe('Something brand new'); }
  });
  it('dynamic messages are translated with their amount', async () => {
    mockFetch({ 'POST /p': { status: 409, body: { message: 'Payment exceeds outstanding balance of ₹4000.5' } } });
    expect(await msg(api('/p', { method: 'POST', body: {} }))).toBe('ચુકવણી બાકી રકમ ₹4000.5 કરતા વધારે છે');
    setLanguage('hi'); expect(await msg(api('/p', { method: 'POST', body: {} }))).toBe('भुगतान बकाया राशि ₹4000.5 से अधिक है');
    setLanguage('en'); expect(await msg(api('/p', { method: 'POST', body: {} }))).toBe('Payment exceeds outstanding balance of ₹4000.5');
  });
  it('a response without a message gets the translated fallback with the status code', async () => {
    mockFetch({ 'GET /z': new Response('not json', { status: 500 }) });
    expect(await msg(api('/z'))).toBe('વિનંતી નિષ્ફળ ગઈ (500)');
    setLanguage('en'); expect(await msg(api('/z'))).toBe('Request failed (500)');
    setLanguage('hi'); expect(await msg(api('/z'))).toBe('अनुरोध विफल रहा (500)');
  });
  it('success responses are untouched', async () => {
    mockFetch({ 'GET /ok': { items: [1] } });
    setLanguage('hi'); expect(await api('/ok')).toEqual({ items: [1] });
  });
});

describe('downloadFile() error translation', () => {
  it('translates server messages and the fallback', async () => {
    mockFetch({ 'GET /d': { status: 404, body: { message: 'Unknown report' } }, 'GET /e': new Response('x', { status: 502 }) });
    expect(await msg(downloadFile('/d'))).toBe('અજાણ્યો રિપોર્ટ');
    setLanguage('en'); expect(await msg(downloadFile('/d'))).toBe('Unknown report');
    expect(await msg(downloadFile('/e'))).toBe('Download failed (502)');
    setLanguage('hi'); expect(await msg(downloadFile('/e'))).toBe('डाउनलोड विफल रहा (502)');
  });
  it('a 401 on download still clears the session and fires the auth-expired event', async () => {
    mockFetch({ 'GET /d': { status: 401, body: { message: 'Authentication required' } } });
    setSession({ token: 't' }); const handler = vi.fn(); window.addEventListener('apmc:auth-expired', handler);
    expect(await msg(downloadFile('/d'))).toBe('પ્રમાણીકરણ જરૂરી છે');
    expect(handler).toHaveBeenCalledTimes(1); expect(localStorage.getItem('apmc_yard_session_v1')).toBeNull();
    window.removeEventListener('apmc:auth-expired', handler);
  });
});
