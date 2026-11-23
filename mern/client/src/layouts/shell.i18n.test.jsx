// Language behaviour of the application shell: Workspace (nav, topbar, bell), Login and App toasts.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App.jsx';
import { Workspace } from './Workspace.jsx';
import { Login } from '../features/auth/Login.jsx';
import { navigation } from '../constants/navigation.js';
import { roles, roleLabel } from '../constants/roles.js';
import { setLanguage, getLanguage, LANGUAGE_STORAGE_KEY, t } from '../i18n/index.js';
import { mockFetch } from '../test/mockFetch.js';

const GUJARATI = /[઀-૿]/;
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); setLanguage('gu'); });

const user = (role = 'admin', name = 'Asha Patel') => ({ id: 'u1', name, role });
const live = { status: { auctionPending: 0, passesIssued: 0, dispatched: 0, inYard: 0, quintalsInside: 0 }, stock: [], farmerDues: [], traderDues: [], farmerTotals: { payable: 0, paid: 0, due: 0, provisional: 0 }, arrivalsByHour: [], activity: [] };
const routes = (o = {}) => ({
  'GET /yard/nav-counts': { openComplaints: 2, auctionQueue: 3, farmerOverdue: 1, buyerOverdue: 1, dispatchOverdue: 1 },
  'GET /yard/settings': { item: { committeeName: 'Surat APMC', commodities: [] } },
  'GET /yard/overview': { stats: {} }, 'GET /yard/lots?limit=6': { items: [] }, 'GET /yard/dashboard': live,
  'GET /yard/reports/catalog': { counts: { lots: 1, tickets: 1, weighments: 1, bills: 1, payments: 1, complaints: 1, audit: 1 }, kpis: { averageRate: 1, grossSales: 1, pendingPayable: 1 } },
  'GET /yard/reports/summary': { lots: 0, tickets: 0, bills: { bills: 0, gross: 0, farmerPayable: 0, farmerPaid: 0 }, payments: [], complaints: 0 },
  ...o
});
const renderWorkspace = (role = 'admin') => render(<Workspace user={user(role)} onLogout={() => {}} notify={() => {}} />);
const navLabels = () => within(document.querySelector('.side-nav')).getAllByRole('button').map(b => b.querySelector('b').textContent);

describe('navigation and roles resolve through the catalogue', () => {
  it('labels follow the selected language and never exist as stale copies', () => {
    const gate = navigation.find(n => n.id === 'gate');
    expect(gate.label).toBe('ગેટ એન્ટ્રી');
    setLanguage('en'); expect(gate.label).toBe('Gate Entry'); expect(roles.accounts).toBe('Accounts Officer');
    setLanguage('hi'); expect(gate.label).toBe('गेट एंट्री'); expect(roles.accounts).toBe('लेखा अधिकारी'); expect(roleLabel('inspector')).toBe('निरीक्षक');
  });
  it('role ids stay stable and unknown roles are shown unchanged', () => {
    setLanguage('hi');
    expect(Object.keys(roles)).toEqual(['admin', 'gate', 'auction', 'weighment', 'accounts', 'inspector']);
    expect(roleLabel('visitor')).toBe('visitor'); expect(roleLabel(undefined)).toBe('');
  });
  it('every navigation item has a label and sub in every language', () => {
    for (const lang of ['gu', 'en', 'hi']) { setLanguage(lang); for (const n of navigation) { expect(n.label, `${lang}:${n.id}`).toBeTruthy(); expect(n.sub, `${lang}:${n.id}.sub`).toBeTruthy(); expect(n.label).not.toMatch(/^nav\./); } }
  });
});

describe.each([['en', 'Gate Entry', 'Search ticket, farmer, vehicle…', 'Sign out'], ['hi', 'गेट एंट्री', 'टिकट, किसान, वाहन खोजें…', 'साइन आउट']])('Workspace in %s', (lang, gateLabel, searchPh, signOut) => {
  it('shows translated navigation, topbar, user role and sign-out with no Gujarati left', async () => {
    mockFetch(routes()); setLanguage(lang);
    const { container } = renderWorkspace('accounts');
    await screen.findByText('Surat APMC');
    expect(document.querySelector('.yard-select small').textContent).toBe(lang === 'en' ? 'MARKET YARD' : 'मार्केट यार्ड');
    expect(document.querySelector('.breadcrumb span').textContent).toBe(lang === 'en' ? 'Market Yard' : 'मार्केट यार्ड');
    expect(navLabels()).toEqual(navigation.filter(n => n.roles.includes('accounts')).map(n => n.label));
    expect(navLabels()).toContain(gateLabel);
    expect(screen.getByPlaceholderText(searchPh)).toBeInTheDocument();
    expect(screen.getAllByText(roleLabel('accounts')).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: new RegExp(signOut) }).length).toBeGreaterThan(0);
    await waitFor(() => expect(screen.getByText(t('nav.footer'))).toBeInTheDocument());
    expect(container.textContent).not.toMatch(GUJARATI);
  });
  it('bell panel lists translated reminders (and the empty message)', async () => {
    mockFetch(routes()); setLanguage(lang);
    renderWorkspace();
    await waitFor(() => expect(document.querySelector('.bell-dot')).not.toBeNull());
    await userEvent.click(screen.getByRole('button', { name: t('nav.reminders') }));
    const menu = screen.getByRole('menu');
    for (const key of ['complaints', 'farmer', 'buyer', 'dispatch']) expect(within(menu).getByText(t('nav.reminder.' + key))).toBeInTheDocument();
    expect(menu.textContent).not.toMatch(GUJARATI);
  });
  it('bell empty state is translated', async () => {
    mockFetch(routes({ 'GET /yard/nav-counts': { openComplaints: 0, auctionQueue: 0, farmerOverdue: 0, buyerOverdue: 0, dispatchOverdue: 0 } })); setLanguage(lang);
    renderWorkspace();
    await userEvent.click(screen.getByRole('button', { name: t('nav.reminders') }));
    expect(screen.getByText(t('nav.noReminders'))).toBeInTheDocument();
  });
});

describe('language switching inside the Workspace', () => {
  it('updates the whole shell and page in place without losing the current page or typed search text', async () => {
    mockFetch(routes());
    renderWorkspace();
    await userEvent.click(screen.getByRole('button', { name: /રિપોર્ટ્સ અને MIS/ }));
    expect(await screen.findByRole('heading', { name: 'રિપોર્ટ્સ અને વિશ્લેષણ' })).toBeInTheDocument();
    const searchBox = () => document.querySelector('.global-search input');
    await userEvent.type(searchBox(), 'wheat');
    expect(screen.getByText('બધો ડેટા એક્સપોર્ટ કરો')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'ભાષા' }));
    await userEvent.click(screen.getByRole('button', { name: /EN\s*English/ }));
    expect(screen.getByText('Export all data')).toBeInTheDocument();
    expect(screen.queryByText('બધો ડેટા એક્સપોર્ટ કરો')).toBeNull();
    expect(screen.getByRole('button', { name: /Reports & MIS/ })).toHaveClass('active');
    expect(searchBox()).toHaveValue('wheat');
    expect(navLabels()).toContain('Gate Entry');

    await userEvent.click(screen.getByRole('button', { name: 'Language' }));
    await userEvent.click(screen.getByRole('button', { name: /HI\s*हिन्दी/ }));
    expect(screen.getByText('सारा डेटा एक्सपोर्ट करें')).toBeInTheDocument();
    expect(navLabels()).toContain('गेट एंट्री');
    expect(searchBox()).toHaveValue('wheat');
    expect(document.documentElement.lang).toBe('hi');
  });
  it('the selector lives in the topbar', async () => {
    mockFetch(routes()); renderWorkspace();
    expect(within(document.querySelector('.topbar')).getByRole('button', { name: 'ભાષા' })).toHaveTextContent('GU');
  });
  it('the choice is persisted in localStorage and restored by a fresh module load (page refresh)', async () => {
    mockFetch(routes()); renderWorkspace();
    await userEvent.click(screen.getByRole('button', { name: 'ભાષા' }));
    await userEvent.click(screen.getByRole('button', { name: /HI\s*हिन्दी/ }));
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('hi');
    vi.resetModules();
    const fresh = await import('../i18n/index.js');
    expect(fresh.getLanguage()).toBe('hi');
    expect(fresh.t('common.save')).toBe('सहेजें');
    fresh.setLanguage('gu');
  });
  it('an unknown stored value falls back to Gujarati', async () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'klingon'); vi.resetModules();
    expect((await import('../i18n/index.js')).getLanguage()).toBe('gu');
  });
});

describe('Login screen', () => {
  it.each([['en', 'Welcome back', 'Email address', 'Your password', 'Sign in securely'], ['hi', 'वापसी पर स्वागत है', 'ईमेल पता', 'आपका पासवर्ड', 'सुरक्षित रूप से साइन इन करें']])('is fully translated in %s', (lang, welcome, email, pwPh, submit) => {
    setLanguage(lang);
    const { container } = render(<Login onLogin={() => {}} />);
    expect(screen.getByText(welcome)).toBeInTheDocument();
    expect(screen.getByText(email)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(pwPh)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: new RegExp(submit) })).toBeInTheDocument();
    expect(container.textContent).not.toMatch(GUJARATI);
  });
  it('has a language selector that switches the screen without clearing typed credentials', async () => {
    render(<Login onLogin={() => {}} />);
    await userEvent.type(screen.getByLabelText('ઇમેઇલ સરનામું'), 'a@b.co');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('એક જ વ્યવસ્થા.');
    await userEvent.click(screen.getByRole('button', { name: 'ભાષા' }));
    await userEvent.click(screen.getByRole('button', { name: /EN\s*English/ }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('One system.');
    expect(screen.getByLabelText('Email address')).toHaveValue('a@b.co');
  });
  it('shows the busy label in the current language while signing in', async () => {
    setLanguage('hi');
    let release; mockFetch({ 'POST /auth/login': () => new Promise(r => { release = () => r({ status: 401, body: { message: 'x' } }); }) });
    render(<Login onLogin={() => {}} />);
    await userEvent.type(screen.getByLabelText('ईमेल पता'), 'a@b.co'); await userEvent.type(screen.getByLabelText('पासवर्ड'), 'pw');
    await userEvent.click(screen.getByRole('button', { name: /सुरक्षित रूप से साइन इन करें/ }));
    expect(await screen.findByText('साइन इन हो रहा है…')).toBeInTheDocument();
    await act(async () => release());
  });
});

describe('App toasts and boot screen follow the language', () => {
  it('sign-in and sign-out toasts', async () => {
    setLanguage('en');
    mockFetch(routes({ 'POST /auth/login': { token: 'tok', user: user() } }));
    render(<App />);
    await userEvent.type(screen.getByLabelText('Email address'), 'a@b.co'); await userEvent.type(screen.getByLabelText('Password'), 'pw');
    await userEvent.click(screen.getByRole('button', { name: /Sign in securely/ }));
    expect(await screen.findByText('Signed in successfully.')).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('button', { name: /Sign out/ })[0]);
    expect(await screen.findByText('You have been signed out.')).toBeInTheDocument();
  });
  it('session-expired toast and boot screen are translated (hi)', async () => {
    setLanguage('hi');
    localStorage.setItem('apmc_yard_session_v1', JSON.stringify({ token: 't', user: user() }));
    let rejectMe; mockFetch({ 'GET /auth/me': () => new Promise(r => { rejectMe = () => r({ status: 401, body: { message: 'x' } }); }) });
    render(<App />);
    expect(screen.getByText('सुरक्षित कार्यक्षेत्र लोड हो रहा है…')).toBeInTheDocument();
    await act(async () => { window.dispatchEvent(new CustomEvent('apmc:auth-expired')); });
    expect(await screen.findByText('सत्र समाप्त हो गया। कृपया फिर से साइन इन करें।')).toBeInTheDocument();
    rejectMe?.();
  });
});
