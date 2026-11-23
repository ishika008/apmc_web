// Dashboard, YardLive, Reports and Settings in all three languages (data fixtures are Latin script on purpose:
// data values are never translated, so any Gujarati left in the rendered text would be an untranslated UI string).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Dashboard } from './dashboard/Dashboard.jsx';
import { YardLive } from './dashboard/YardLive.jsx';
import { ReportsScreen } from './reports/ReportsScreen.jsx';
import { SettingsScreen } from './settings/SettingsScreen.jsx';
import { setLanguage, t } from '../i18n/index.js';
import { mockFetch } from '../test/mockFetch.js';

const GUJARATI = /[઀-૿]/;
afterEach(() => { vi.unstubAllGlobals(); setLanguage('gu'); });
const LANGS = ['gu', 'en', 'hi'];

const live = {
  status: { auctionPending: 3, passesIssued: 2, dispatched: 1, inYard: 5, quintalsInside: 42.5 },
  stock: [{ _id: 's1', lotNumber: 'LOT-9', farmerName: 'Ramesh', sellerType: 'farmer', village: 'Kamrej', commodity: 'Wheat', netWeight: 10, vehicle: 'GJ05', status: 'weighed', buyerId: { name: 'Patel' }, dispatchDueAt: '2099-01-01T00:00:00Z' },
    { _id: 's2', lotNumber: 'LOT-10', farmerName: 'Trade Co', sellerType: 'trader', commodity: 'Cotton', estimated: 7, status: 'arrived' }],
  farmerDues: [{ kind: 'provisional', farmer: 'Ramesh', reference: 'APMC-1', payable: 37500, paid: 0, balance: 37500, dueAt: '2000-01-01T00:00:00Z' }, { kind: 'bill', farmer: 'Suresh', reference: 'SB-1', payable: 1000, paid: 400, balance: 600, dueAt: '2099-01-01T00:00:00Z' }],
  traderDues: [{ buyerId: 'b1', name: 'Patel Agro', registrationNo: 'TR-1', creditDays: 3, paid: 0, due: 37500, overdue: true }, { buyerId: 'b2', name: 'No Reg', creditDays: 5, paid: 0, due: 1, overdue: false }],
  farmerTotals: { payable: 38500, paid: 400, due: 38100, provisional: 37500 },
  arrivalsByHour: Array.from({ length: 24 }, (_, hour) => ({ hour, lots: hour === 9 ? 4 : 0 })),
  activity: [{ _id: 'a1', action: 'GATE_ENTRY_CREATED', actorName: 'Gate', resourceId: 'r1', createdAt: '2026-03-05T10:00:00Z' }]
};
const stats = { totalLots: 12, arrived: 3, totalTickets: 7, dispatched: 2, farmerDue: 5000, traderDue: 12000, openComplaints: 1, activeBuyers: 4, farmerPayable: 20000, farmerPaid: 15000, buyerDues: 300, buyerDuesPaid: 100 };
const lot = { _id: 'l1', lotNumber: 'LOT-1', farmerName: 'Ramesh', sellerType: 'farmer', commodity: 'Wheat', bags: 5, vehicle: 'GJ', village: 'V', status: 'arrived', arrivalAt: '2026-03-05T10:00:00Z' };

describe.each(LANGS)('Dashboard + YardLive in %s', lang => {
  it('every user-facing string is translated', async () => {
    mockFetch({ 'GET /yard/overview': { stats }, 'GET /yard/lots?limit=6': { items: [lot] }, 'GET /yard/dashboard': live });
    setLanguage(lang);
    const { container } = render(<Dashboard user={{ name: 'Asha Patel', role: 'accounts' }} onNavigate={() => {}} />);
    expect(screen.getByText(t('dashboard.loading'))).toBeInTheDocument();
    expect(await screen.findByText(t('dashboard.greeting', { name: 'Asha' }))).toBeInTheDocument();
    expect(await screen.findByText(t('dashboard.live.title'))).toBeInTheDocument();
    for (const key of ['dashboard.stat.totalLots', 'dashboard.fin.title', 'dashboard.quick.title', 'dashboard.recent.title', 'dashboard.live.stock.title', 'dashboard.live.farmerDues.title', 'dashboard.live.traderDues.title'])
      expect(screen.getAllByText(t(key)).length, key).toBeGreaterThan(0);
    expect(screen.getByText(t('dashboard.live.days', { n: 3 }))).toBeInTheDocument();
    expect(screen.getByText(t('dashboard.live.regPending'))).toBeInTheDocument();
    expect(screen.getByText(t('dashboard.live.creditOverdue'))).toBeInTheDocument();
    expect(screen.getByText(t('dashboard.live.quintalsInside', { q: '42.5' }))).toBeInTheDocument();
    expect(screen.getByRole('img', { name: t('dashboard.live.arrivals.aria') })).toBeInTheDocument();
    if (lang !== 'gu') expect(container.textContent).not.toMatch(GUJARATI);
  });
  it('stock-table headers and empty states are translated', () => {
    setLanguage(lang);
    const empty = { ...live, stock: [], farmerDues: [], traderDues: [], activity: [] };
    const { container } = render(<YardLive live={empty} onNavigate={() => {}} />);
    for (const key of ['dashboard.live.stock.empty', 'dashboard.live.farmerDues.empty', 'dashboard.live.traderDues.empty', 'dashboard.live.activity.empty']) expect(screen.getByText(t(key))).toBeInTheDocument();
    if (lang !== 'gu') expect(container.textContent).not.toMatch(GUJARATI);
  });
  it('stock table column headers use the language', () => {
    setLanguage(lang);
    render(<YardLive live={live} onNavigate={() => {}} />);
    const heads = [...document.querySelectorAll('th')].map(h => h.textContent);
    for (const key of ['dashboard.live.col.lotId', 'dashboard.live.col.owner', 'dashboard.live.col.dispatchDeadline', 'dashboard.live.col.reference', 'dashboard.live.col.credit']) expect(heads).toContain(t(key));
  });
  it('quick actions and navigation buttons still work after a language change', async () => {
    mockFetch({ 'GET /yard/overview': { stats }, 'GET /yard/lots?limit=6': { items: [] }, 'GET /yard/dashboard': live });
    setLanguage(lang); const nav = vi.fn();
    render(<Dashboard user={{ name: 'Asha Patel', role: 'admin' }} onNavigate={nav} />);
    await userEvent.click(await screen.findByRole('button', { name: new RegExp(t('dashboard.fin.open')) }));
    expect(nav).toHaveBeenCalledWith('payments');
    await userEvent.click(screen.getByRole('button', { name: new RegExp(t('dashboard.recent.viewAll')) }));
    expect(nav).toHaveBeenCalledWith('gate');
  });
});

describe.each(LANGS)('ReportsScreen in %s', lang => {
  const catalog = { counts: { lots: 4, tickets: 3, weighments: 2, bills: 2, payments: 5, complaints: 1, audit: 9 }, kpis: { averageRate: 2500, grossSales: 75000, pendingPayable: 1200 } };
  const summary = { lots: 4, tickets: 3, bills: { bills: 2, gross: 75000, farmerPayable: 70000, farmerPaid: 60000 }, payments: [{ _id: 'farmer_settlement', count: 2, amount: 60000 }], complaints: 1 };
  it('translates every label, report names/details, buttons and notices', async () => {
    mockFetch({ 'GET /yard/reports/catalog': catalog, 'GET /yard/reports/summary': summary });
    setLanguage(lang);
    const { container } = render(<ReportsScreen user={{ role: 'admin' }} notify={() => {}} />);
    expect(await screen.findByRole('heading', { name: t('reports.title') })).toBeInTheDocument();
    expect(await screen.findByText(t('reports.center.title'))).toBeInTheDocument();
    for (const k of ['lots', 'tickets', 'weighments', 'bills', 'payments', 'complaints', 'audit']) expect(screen.getByText(t('reports.r.' + k))).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: t('reports.csvExport') })).toHaveLength(7);
    expect(await screen.findByText(t('reports.coll.title'))).toBeInTheDocument();
    expect(screen.getByText(t('reports.notice'))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: new RegExp(t('reports.generate')) })).toBeInTheDocument();
    if (lang !== 'gu') expect(container.textContent).not.toMatch(GUJARATI);
  });
  it('hides the audit report for non-audit roles, in every language', async () => {
    mockFetch({ 'GET /yard/reports/catalog': catalog, 'GET /yard/reports/summary': summary });
    setLanguage(lang);
    render(<ReportsScreen user={{ role: 'gate' }} notify={() => {}} />);
    await screen.findByText(t('reports.center.title'));
    expect(screen.queryByText(t('reports.r.audit'))).toBeNull();
    expect(screen.getAllByRole('button', { name: t('reports.csvExport') })).toHaveLength(6);
  });
  it('shows the translated empty collections message and the translated CSV-ready toast', async () => {
    const notify = vi.fn();
    mockFetch({ 'GET /yard/reports/catalog': catalog, 'GET /yard/reports/summary': { ...summary, payments: [] }, 'GET /yard/reports/export/lots': () => new Response('a,b', { status: 200, headers: { 'Content-Type': 'text/csv' } }) });
    global.URL.createObjectURL = vi.fn(() => 'blob:x'); global.URL.revokeObjectURL = vi.fn(); HTMLAnchorElement.prototype.click = vi.fn();
    setLanguage(lang);
    render(<ReportsScreen user={{ role: 'admin' }} notify={notify} />);
    expect(await screen.findByText(t('reports.coll.empty'))).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('button', { name: t('reports.csvExport') })[0]);
    await vi.waitFor(() => expect(notify).toHaveBeenCalledWith(t('reports.csvReady')));
  });
});

describe.each(LANGS)('SettingsScreen in %s', lang => {
  const item = { committeeName: 'Surat APMC', yardCode: 'APMC-01', timezone: 'Asia/Kolkata', ticketPrefix: 'APMC', billPrefix: 'SB', passPrefix: 'GP', complaintPrefix: 'CMP', farmerPaymentDays: 1, dispatchDays: 2, defaultBuyerCreditDays: 5, sellerApprovedDeduction: 0, buyerMarketFee: 0, buyerOtherDues: 0, commodities: ['Wheat', 'Cotton'] };
  const buyers = { items: [{ _id: 'b1', name: 'Patel', registrationNo: 'TR-1', creditDays: 3, purchaseLimit: 5000, active: true }, { _id: 'b2', name: 'Open', creditDays: 5, purchaseLimit: 0, active: false }] };
  it('translates every heading, field label, hint, table and button', async () => {
    mockFetch({ 'GET /yard/settings': { item }, 'GET /yard/buyers?limit=100': buyers });
    setLanguage(lang);
    const { container } = render(<SettingsScreen notify={() => {}} onNavigate={() => {}} />);
    expect(screen.getByText(t('settings.loading'))).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: t('settings.title') })).toBeInTheDocument();
    for (const k of ['identity', 'rules', 'commodities', 'buyers']) expect(screen.getByRole('heading', { name: t('settings.' + k) })).toBeInTheDocument();
    for (const k of ['committeeName', 'yardCode', 'timezone', 'ticketPrefix', 'farmerPaymentDays', 'sellerApprovedDeduction', 'buyerOtherDues']) expect(screen.getByLabelText(t('settings.' + k))).toBeInTheDocument();
    expect(screen.getByLabelText(t('settings.commoditiesHint'))).toHaveValue('Wheat\nCotton');
    expect(screen.getByText(t('settings.days', { n: 3 }))).toBeInTheDocument();
    expect(screen.getByText(t('settings.limitOpen'))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: new RegExp(t('settings.saveConfig')) })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: new RegExp(t('settings.manageBuyers')) })).toBeInTheDocument();
    if (lang !== 'gu') expect(container.textContent).not.toMatch(GUJARATI);
  });
  it('save still PATCHes the same payload and notifies in the current language', async () => {
    const notify = vi.fn();
    const f = mockFetch({ 'GET /yard/settings': { item }, 'GET /yard/buyers?limit=100': { items: [] }, 'PATCH /yard/settings': { item } });
    setLanguage(lang);
    render(<SettingsScreen notify={notify} />);
    await userEvent.click(await screen.findByRole('button', { name: new RegExp(t('settings.saveConfig')) }));
    await vi.waitFor(() => expect(notify).toHaveBeenCalledWith(t('settings.saved')));
    const patch = f.calls.find(c => c.method === 'PATCH');
    expect(patch.body.commodities).toEqual(['Wheat', 'Cotton']); expect(patch.body.farmerPaymentDays).toBe(1);
    expect(screen.getByText(t('settings.noBuyers'))).toBeInTheDocument();
  });
});

describe('screens re-render in place when the language changes', () => {
  it('Settings keeps the user’s unsaved edits across a language switch', async () => {
    mockFetch({ 'GET /yard/settings': { item: { committeeName: 'Surat APMC', commodities: ['Wheat'] } }, 'GET /yard/buyers?limit=100': { items: [] } });
    render(<SettingsScreen notify={() => {}} />);
    const input = await screen.findByDisplayValue('Surat APMC');
    await userEvent.clear(input); await userEvent.type(input, 'Rajkot APMC');
    const { act } = await import('@testing-library/react');
    act(() => setLanguage('en'));
    expect(screen.getByRole('heading', { name: 'Yard Configuration' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('Rajkot APMC')).toBeInTheDocument();
    act(() => setLanguage('hi'));
    expect(screen.getByRole('heading', { name: 'यार्ड कॉन्फ़िगरेशन' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('Rajkot APMC')).toBeInTheDocument();
  });
});
