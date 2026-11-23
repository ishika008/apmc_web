import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App.jsx';
import { getSession, setSession } from './services/api.js';
import { mockFetch } from './test/mockFetch.js';
import { translateServerMessage } from './i18n/index.js';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
const shell = (o = {}) => ({
  'GET /yard/nav-counts': { openComplaints: 0, auctionQueue: 0, farmerOverdue: 0, buyerOverdue: 0, dispatchOverdue: 0 },
  'GET /yard/settings': { item: { committeeName: 'Y', commodities: [] } }, 'GET /yard/overview': { stats: {} }, 'GET /yard/lots?limit=6': { items: [] },
  'GET /yard/dashboard': { status: { auctionPending: 0, passesIssued: 0, dispatched: 0, inYard: 0, quintalsInside: 0 }, stock: [], farmerDues: [], traderDues: [], farmerTotals: { payable: 0, paid: 0, due: 0, provisional: 0 }, arrivalsByHour: [], activity: [] }, ...o });
const me = { user: { id: 'u1', name: 'Asha Patel', email: 'a@x', role: 'admin', active: true } };

describe('App', () => {
  it('shows the login screen when there is no session (no /auth/me call)', () => {
    const f = mockFetch(shell());
    render(<App/>);
    expect(screen.getByText('ફરી સ્વાગત છે')).toBeInTheDocument();
    expect(f.calls.some(c => c.path === '/auth/me')).toBe(false);
  });
  it('restores a valid session: boot screen, then workspace for the server user', async () => {
    setSession({ token: 't', user: { id: 'stale', name: 'Stale', role: 'gate' } });
    mockFetch(shell({ 'GET /auth/me': me }));
    render(<App/>);
    expect(screen.getByText('સુરક્ષિત વર્કસ્પેસ લોડ થઈ રહ્યું છે…')).toBeInTheDocument();
    expect(await screen.findByText('નમસ્કાર, Asha')).toBeInTheDocument();
    expect(screen.queryByText('ફરી સ્વાગત છે')).toBeNull();
  });
  it('falls back to the login screen when the stored session is rejected', async () => {
    setSession({ token: 'bad', user: { id: 'x', name: 'X', role: 'admin' } });
    mockFetch(shell({ 'GET /auth/me': { status: 401, body: { message: 'Invalid or expired token' } } }));
    render(<App/>);
    expect(await screen.findByText('ફરી સ્વાગત છે')).toBeInTheDocument();
    expect(getSession()).toBeNull();
  });
  it('login flow: signs in, shows a success toast and the workspace', async () => {
    mockFetch(shell({ 'POST /auth/login': { token: 'T', user: me.user } }));
    render(<App/>);
    await userEvent.type(screen.getByLabelText('ઇમેઇલ સરનામું'), 'a@x');
    await userEvent.type(screen.getByLabelText('પાસવર્ડ'), 'pw');
    await userEvent.click(screen.getByRole('button', { name: /સુરક્ષિત રીતે સાઇન ઇન કરો/ }));
    expect(await screen.findByText('નમસ્કાર, Asha')).toBeInTheDocument();
    expect(screen.getByText(/સફળતાપૂર્વક સાઇન ઇન થયું/)).toBeInTheDocument();
    expect(getSession().token).toBe('T');
  });
  it('failed login keeps the login screen and shows the error', async () => {
    mockFetch({ 'POST /auth/login': { status: 401, body: { message: 'Invalid email or password' } } });
    render(<App/>);
    await userEvent.type(screen.getByLabelText('ઇમેઇલ સરનામું'), 'a@x');
    await userEvent.type(screen.getByLabelText('પાસવર્ડ'), 'bad');
    await userEvent.click(screen.getByRole('button', { name: /સુરક્ષિત રીતે સાઇન ઇન કરો/ }));
    expect(await screen.findByText(translateServerMessage('Invalid email or password'))).toBeInTheDocument();
    expect(screen.queryByText(/સફળતાપૂર્વક/)).toBeNull();
  });
  it('logout clears the session and returns to login with a toast', async () => {
    setSession({ token: 't', user: me.user });
    mockFetch(shell({ 'GET /auth/me': me }));
    render(<App/>);
    await screen.findByText('નમસ્કાર, Asha');
    await userEvent.click(document.querySelector('.logout-btn'));
    expect(await screen.findByText('ફરી સ્વાગત છે')).toBeInTheDocument();
    expect(getSession()).toBeNull();
    expect(screen.getByText(/સાઇન આઉટ થયા/)).toBeInTheDocument();
  });
  it('an apmc:auth-expired event signs the user out with an error toast', async () => {
    setSession({ token: 't', user: me.user });
    mockFetch(shell({ 'GET /auth/me': me }));
    render(<App/>);
    await screen.findByText('નમસ્કાર, Asha');
    act(() => { window.dispatchEvent(new CustomEvent('apmc:auth-expired')); });
    expect(await screen.findByText('સત્ર પૂરું થયું. કૃપા કરીને ફરી સાઇન ઇન કરો.')).toHaveTextContent('સત્ર પૂરું થયું');
    expect(document.querySelector('.toast-error')).not.toBeNull();
    expect(screen.getByText('ફરી સ્વાગત છે')).toBeInTheDocument();
  });
  it('a 401 from any API call while using the app expires the session', async () => {
    setSession({ token: 't', user: me.user });
    mockFetch(shell({ 'GET /auth/me': me, 'GET /yard/overview': { status: 401, body: { message: 'Invalid or expired token' } } }));
    render(<App/>);
    expect(await screen.findByText('સત્ર પૂરું થયું. કૃપા કરીને ફરી સાઇન ઇન કરો.')).toBeInTheDocument();
    expect(getSession()).toBeNull();
  });
  it('toasts auto-dismiss after 3.5 seconds', async () => {
    mockFetch(shell({ 'POST /auth/login': { token: 'T', user: me.user } }));
    render(<App/>);
    await userEvent.type(screen.getByLabelText('ઇમેઇલ સરનામું'), 'a@x');
    await userEvent.type(screen.getByLabelText('પાસવર્ડ'), 'pw');
    await userEvent.click(screen.getByRole('button', { name: /સુરક્ષિત રીતે સાઇન ઇન કરો/ }));
    await screen.findByText(/સફળતાપૂર્વક સાઇન ઇન થયું/);
    await waitFor(() => expect(screen.queryByText(/સફળતાપૂર્વક સાઇન ઇન થયું/)).toBeNull(), { timeout: 5000 });
  }, 10000);
});
