import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api, downloadFile, getSession, setSession, clearSession } from './api.js';
import { mockFetch, jsonResponse } from '../test/mockFetch.js';
import { setLanguage } from '../i18n/index.js';

// These tests assert the server's English text, so they run in English; translation is covered in apiI18n.test.js.
beforeEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); setLanguage('en'); });
afterEach(() => setLanguage('gu'));

describe('session helpers', () => {
  it('round-trips and clears', () => {
    expect(getSession()).toBeNull();
    setSession({ token: 't', user: { id: 1 } });
    expect(getSession()).toEqual({ token: 't', user: { id: 1 } });
    clearSession();
    expect(getSession()).toBeNull();
  });
  it('returns null on corrupted storage', () => {
    localStorage.setItem('apmc_yard_session_v1', '{not json');
    expect(getSession()).toBeNull();
  });
});

describe('api()', () => {
  it('prefixes /api, sends no auth header without a session', async () => {
    const f = mockFetch({ 'GET /x': { ok: 1 } });
    expect(await api('/x')).toEqual({ ok: 1 });
    expect(f.calls[0].headers.Authorization).toBeUndefined();
  });
  it('adds the bearer token when a session exists', async () => {
    setSession({ token: 'abc' });
    const f = mockFetch({ 'GET /x': {} });
    await api('/x');
    expect(f.calls[0].headers.Authorization).toBe('Bearer abc');
  });
  it('serialises object bodies to JSON with a content type', async () => {
    const f = mockFetch({ 'POST /x': {} });
    await api('/x', { method: 'POST', body: { a: 1 } });
    expect(f.mock.calls[0][1].body).toBe('{"a":1}');
    expect(f.calls[0].headers['Content-Type']).toBe('application/json');
  });
  it('passes string bodies through unchanged', async () => {
    const f = mockFetch({ 'POST /x': {} });
    await api('/x', { method: 'POST', body: '{"raw":true}' });
    expect(f.mock.calls[0][1].body).toBe('{"raw":true}');
  });
  it('does not force JSON content type for FormData and leaves it intact', async () => {
    const f = mockFetch({ 'POST /x': {} });
    const fd = new FormData(); fd.append('a', '1');
    await api('/x', { method: 'POST', body: fd });
    expect(f.mock.calls[0][1].body).toBe(fd);
    expect(f.calls[0].headers['Content-Type']).toBeUndefined();
  });
  it('throws the server message on non-2xx', async () => {
    mockFetch({ 'GET /x': { status: 409, body: { message: 'Conflict!' } } });
    await expect(api('/x')).rejects.toThrow('Conflict!');
  });
  it('falls back to a generic message when no JSON body', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('oops', { status: 500 })));
    await expect(api('/x')).rejects.toThrow('Request failed (500)');
  });
  it('on 401 clears the session and fires apmc:auth-expired', async () => {
    setSession({ token: 'abc' });
    const listener = vi.fn(); window.addEventListener('apmc:auth-expired', listener);
    mockFetch({ 'GET /x': { status: 401, body: { message: 'Invalid or expired token' } } });
    await expect(api('/x')).rejects.toThrow('Invalid or expired token');
    expect(getSession()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener('apmc:auth-expired', listener);
  });
  it('propagates network failures', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    await expect(api('/x')).rejects.toThrow('Failed to fetch');
  });
  it('merges caller headers', async () => {
    const f = mockFetch({ 'GET /x': {} });
    await api('/x', { headers: { 'X-A': '1' } });
    expect(f.calls[0].headers['X-A']).toBe('1');
  });
});

describe('downloadFile()', () => {
  let clicks;
  beforeEach(() => {
    clicks = [];
    URL.createObjectURL = vi.fn(() => 'blob:dl'); URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () { clicks.push(this.download); });
  });
  const csv = (disp) => new Response('a,b', { status: 200, headers: disp ? { 'Content-Disposition': disp } : {} });
  it('uses the server-provided filename and sends auth', async () => {
    setSession({ token: 'tok' });
    const f = vi.fn(async () => csv('attachment; filename="apmc-lot-register.csv"')); vi.stubGlobal('fetch', f);
    await downloadFile('/yard/reports/export/lots', 'fallback.csv');
    expect(f).toHaveBeenCalledWith('/api/yard/reports/export/lots', { headers: { Authorization: 'Bearer tok' } });
    expect(clicks).toEqual(['apmc-lot-register.csv']);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:dl');
  });
  it('falls back to the supplied filename, then the default', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => csv()));
    await downloadFile('/x', 'mine.csv'); await downloadFile('/x');
    expect(clicks).toEqual(['mine.csv', 'download.csv']);
  });
  it('sends no auth header without a session', async () => {
    const f = vi.fn(async () => csv()); vi.stubGlobal('fetch', f);
    await downloadFile('/x');
    expect(f.mock.calls[0][1]).toEqual({ headers: {} });
  });
  it('throws server message on failure and expires the session on 401', async () => {
    setSession({ token: 't' });
    const listener = vi.fn(); window.addEventListener('apmc:auth-expired', listener);
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(401, { message: 'nope' })));
    await expect(downloadFile('/x')).rejects.toThrow('nope');
    expect(getSession()).toBeNull(); expect(listener).toHaveBeenCalled();
    window.removeEventListener('apmc:auth-expired', listener);
  });
  it('uses a generic message when the error body is not JSON', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('x', { status: 403 })));
    await expect(downloadFile('/x')).rejects.toThrow('Download failed (403)');
    expect(clicks).toEqual([]);
  });
});
