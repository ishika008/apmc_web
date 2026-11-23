// Rendered-output purity: with Gujarati or Hindi selected, nothing a user can see (text, placeholders, aria-labels,
// titles, option labels) may contain an untranslated English word. Only the acronyms in ALLOWED (shared with the
// catalogue test) and the fixture DATA below (names, ids, codes: stored data is never translated) are exempt.
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Login } from '../features/auth/Login.jsx';
import { Workspace } from './Workspace.jsx';
import { Dashboard } from '../features/dashboard/Dashboard.jsx';
import { YardLive } from '../features/dashboard/YardLive.jsx';
import { ReportsScreen } from '../features/reports/ReportsScreen.jsx';
import { SettingsScreen } from '../features/settings/SettingsScreen.jsx';
import { TicketPrint } from '../components/common/TicketPrint.jsx';
import { GatePassPrint } from '../components/common/GatePassPrint.jsx';
import { DataTable } from '../components/common/DataTable.jsx';
import { SearchModal } from '../components/common/SearchModal.jsx';
import { navigation } from '../constants/navigation.js';
import { roleLabel } from '../constants/roles.js';
import { mockFetch } from '../test/mockFetch.js';
import { setLanguage } from '../i18n/index.js';
import purityRaw from '../i18n/scriptPurity.test.js?raw';

afterEach(() => { setLanguage('gu'); vi.unstubAllGlobals(); });

// ── helpers ────────────────────────────────────────────────────────────────
// Single source of truth for allowed Latin tokens: the list in i18n/scriptPurity.test.js, read from source
// (importing a *.test.js module would register its tests inside this file and couple the two suites).
const ALLOWED = new Set([...purityRaw.match(/export const ALLOWED = new Set\(\[([^\]]*)\]/)[1].matchAll(/'([^']+)'/g)].map(m => m[1]));
const LATIN = /[A-Za-z][A-Za-z'’]+/g;
// 'am' / 'pm' come from the browser's locale data for times (not from our catalogue); reported separately in the audit.
const LOCALE_TOKENS = new Set(['am', 'pm']);
const words = s => (String(s).replace(/\{\w+\}/g, '').replace(/\b[A-Z]{2,}-[A-Z0-9-]+\b/g, '').match(LATIN) || []);
const dataWords = (...objs) => {
  const out = new Set(); const walk = v => { if (typeof v === 'string') words(v).forEach(w => out.add(w)); else if (v && typeof v === 'object') Object.values(v).forEach(walk); };
  objs.forEach(walk); return out;
};
/** Everything visible or announced: text nodes, placeholder / aria-label / title / alt, and option labels. */
function visibleStrings(root = document.body) {
  const out = [];
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = tw.nextNode(); n; n = tw.nextNode()) { const p = n.parentElement; if (p && !['SCRIPT', 'STYLE'].includes(p.tagName) && n.nodeValue.trim()) out.push(n.nodeValue.trim()); }
  root.querySelectorAll('[placeholder],[aria-label],[title],[alt]').forEach(e => ['placeholder', 'aria-label', 'title', 'alt'].forEach(a => { const v = e.getAttribute(a); if (v) out.push(v); }));
  root.querySelectorAll('svg title').forEach(t => out.push(t.textContent));
  return out;
}
const untranslated = (data = new Set(), root) => {
  const bad = [];
  for (const s of visibleStrings(root)) for (const w of words(s)) if (!ALLOWED.has(w) && !LOCALE_TOKENS.has(w) && !data.has(w)) bad.push(`${w}  ←  "${s.slice(0, 70)}"`);
  return [...new Set(bad)];
};

// ── fixtures (Latin-script data on purpose: it proves chrome vs data are separated) ──────
const stats = { totalLots: 12, arrived: 3, totalTickets: 7, dispatched: 2, farmerDue: 5000, traderDue: 12000, openComplaints: 1, activeBuyers: 4, farmerPayable: 20000, farmerPaid: 15000, buyerDues: 300, buyerDuesPaid: 100 };
const lotRow = { _id: 'l1', lotNumber: 'LOT-1', farmerName: 'Ramesh', sellerType: 'farmer', commodity: 'Wheat', bags: 5, vehicle: 'GJ05AB1', village: 'Kamrej', status: 'arrived', arrivalAt: '2026-03-05T10:00:00Z' };
const live = {
  status: { auctionPending: 3, passesIssued: 2, dispatched: 1, inYard: 5, quintalsInside: 42.5 },
  stock: [{ _id: 's1', lotNumber: 'LOT-9', farmerName: 'Ramesh', sellerType: 'farmer', village: 'Kamrej', commodity: 'Wheat', netWeight: 10, vehicle: 'GJ05', status: 'weighed', buyerId: { name: 'Patel' }, dispatchDueAt: '2099-01-01T00:00:00Z' },
    { _id: 's2', lotNumber: 'LOT-10', farmerName: 'Trade Co', sellerType: 'trader', commodity: 'Cotton', estimated: 7, status: 'arrived' }],
  farmerDues: [{ kind: 'provisional', farmer: 'Ramesh', reference: 'APMC-1', payable: 37500, paid: 0, balance: 37500, dueAt: '2000-01-01T00:00:00Z' },
    { kind: 'bill', farmer: 'Suresh', reference: 'SB-1', payable: 1000, paid: 400, balance: 600, dueAt: '2099-01-01T00:00:00Z' }],
  traderDues: [{ buyerId: 'b1', name: 'Patel Agro', registrationNo: 'TR-1', creditDays: 3, paid: 0, due: 37500, overdue: true }, { buyerId: 'b2', name: 'No Reg', creditDays: 5, paid: 0, due: 1, overdue: false }],
  farmerTotals: { payable: 38500, paid: 400, due: 38100, provisional: 37500 },
  arrivalsByHour: Array.from({ length: 24 }, (_, hour) => ({ hour, lots: hour === 9 ? 4 : 0 })),
  activity: [{ _id: 'a1', action: 'GATE_ENTRY_CREATED', actorName: 'Gate', resourceId: 'r1', createdAt: '2026-03-05T10:00:00Z' }]
};
const counts = { openComplaints: 2, auctionQueue: 3, farmerOverdue: 1, buyerOverdue: 1, dispatchOverdue: 4 };
const dashRoutes = { 'GET /yard/overview': { stats }, 'GET /yard/lots?limit=6': { items: [lotRow] }, 'GET /yard/dashboard': live };
const catalog = { counts: { lots: 5, tickets: 4, weighments: 3, bills: 2, payments: 1, complaints: 0, audit: 9 }, kpis: { averageRate: 2500, grossSales: 37500, pendingPayable: 100 } };
const summary = { lots: 2, tickets: 1, bills: { bills: 1, gross: 37500, farmerPayable: 37000, farmerPaid: 1000 }, payments: [{ _id: 'farmer_settlement', count: 2, amount: 900 }, { _id: 'buyer_fee', count: 1, amount: 50 }], complaints: 3 };
const settingsItem = { committeeName: 'Surat Committee', yardCode: 'SRT-01', timezone: 'Asia/Kolkata', ticketPrefix: 'APMC', billPrefix: 'SB', passPrefix: 'GP', complaintPrefix: 'CMP', farmerPaymentDays: 1, dispatchDays: 2, defaultBuyerCreditDays: 5, sellerApprovedDeduction: 0, buyerMarketFee: 0, buyerOtherDues: 0, commodities: ['Wheat', 'Cotton'] };
const buyers = [{ _id: 'b1', name: 'Patel', registrationNo: 'TR-1', creditDays: 3, purchaseLimit: 5000, active: true }, { _id: 'b2', name: 'Open', creditDays: 5, purchaseLimit: 0, active: false }];
const ticket = { ticketNumber: 'APMC-2026-000001', rate: 2500, quantity: 15, quality: 'FAQ', method: 'e_auction', createdAt: '2026-03-05T10:00:00Z', farmerPaymentDueAt: '2026-03-06T10:00:00Z', dispatchDueAt: '2026-03-07T10:00:00Z', buyerCreditDueAt: '2026-03-10T10:00:00Z', buyer: { name: 'Patel Agro', registrationNo: 'TR-1' }, lot: { lotNumber: 'LOT-1', farmerName: 'Ramesh', commodity: 'Wheat', bags: 10, sellerType: 'farmer', farmerRegistryId: 'FR-1', landRecordType: '7/12', landRecordNo: '44/2' } };
const pass = { passNumber: 'GP-2026-000001', status: 'dispatched', vehicle: 'GJ05AB1', issuedAt: '2026-03-05T10:00:00Z', dispatchAt: '2026-03-05T12:00:00Z', overrideReason: 'Committee approved', buyer: { name: 'Patel Agro' }, issuedBy: { name: 'Gate' }, lot: { lotNumber: 'LOT-1', farmerName: 'Ramesh', commodity: 'Wheat', netWeight: 18, vehicle: 'GJ05AB1' } };
// GU / EN / HI are the language codes of the selector (identifiers, as in the reference design); 'ab' is the typed search query.
const DATA = dataWords(stats, lotRow, live, settingsItem, buyers, ticket, pass, 'Asha Patel', 'GU EN HI ab', 'DIGITAL SYSTEM');  // 'DIGITAL SYSTEM' = brand tagline, exempt like nav.brandTagline in the catalogue test

describe.each(['gu', 'hi'])('rendered UI is fully translated in %s', lang => {
  const use = () => setLanguage(lang);

  it('Login screen (chrome, placeholders, labels)', () => {
    use(); render(<Login onLogin={() => {}} />);
    expect(untranslated(DATA)).toEqual([]);
  });

  it('Login failure state shows a translated server error', async () => {
    use();
    mockFetch({ 'POST /auth/login': { status: 401, body: { message: 'Invalid email or password' } } });
    render(<Login onLogin={() => {}} />);
    await userEvent.type(document.querySelector('input[type=email]'), 'a@b.co');
    await userEvent.type(document.querySelector('input[type=password]'), 'wrong-password');
    await userEvent.click(document.querySelector('button.login-submit'));
    await waitFor(() => expect(document.querySelector('.inline-error')).not.toBeNull());
    expect(untranslated(DATA)).toEqual([]);
    expect(document.querySelector('.inline-error').textContent).not.toMatch(/Invalid email/);
  });

  it('Workspace shell for admin: sidebar, topbar, footer, bell reminders, dashboard body', async () => {
    use();
    mockFetch({ ...dashRoutes, 'GET /yard/nav-counts': counts, 'GET /yard/settings': { item: settingsItem } });
    render(<Workspace user={{ id: 'u1', name: 'Asha Patel', role: 'admin' }} onLogout={() => {}} notify={() => {}} />);
    await screen.findByText('Surat Committee');
    await userEvent.click(document.querySelector('.bell-wrap button'));
    expect(document.querySelector('.bell-panel')).not.toBeNull();
    expect(untranslated(DATA)).toEqual([]);
  });

  it('every navigation item (label + sub-label) and every role name', () => {
    use();
    const strings = [...navigation.flatMap(n => [n.label, n.sub]), ...['admin', 'gate', 'auction', 'weighment', 'accounts', 'inspector'].map(roleLabel)];
    const bad = strings.flatMap(s => words(s).filter(w => !ALLOWED.has(w)).map(w => `${w} ← ${s}`));
    expect(bad).toEqual([]);
  });

  it('Dashboard with every live block populated (stats, dues, stock, chart, activity)', async () => {
    use();
    mockFetch(dashRoutes);
    render(<Dashboard user={{ id: 'u1', name: 'Asha Patel', role: 'admin' }} onNavigate={() => {}} />);
    await screen.findAllByText(/Ramesh/);
    expect(untranslated(DATA)).toEqual([]);
  });

  it('Yard live block empty states', () => {
    use();
    render(<YardLive onNavigate={() => {}} live={{ ...live, stock: [], farmerDues: [], traderDues: [], activity: [] }} />);
    expect(untranslated(DATA)).toEqual([]);
  });

  it('Reports screen: catalogue, summary, collections table', async () => {
    use();
    mockFetch({ 'GET /yard/reports/catalog': catalog, 'GET /yard/reports/summary': summary });
    render(<ReportsScreen user={{ id: 'u1', name: 'Asha', role: 'admin' }} notify={() => {}} />);
    await waitFor(() => expect(document.querySelectorAll('.metric-card').length).toBeGreaterThan(4));
    expect(untranslated(DATA)).toEqual([]);
  });

  it('Reports screen empty period', async () => {
    use();
    mockFetch({ 'GET /yard/reports/catalog': catalog, 'GET /yard/reports/summary': { ...summary, payments: [] } });
    render(<ReportsScreen user={{ id: 'u1', name: 'Asha', role: 'inspector' }} notify={() => {}} />);
    await waitFor(() => expect(document.querySelectorAll('.metric-card').length).toBeGreaterThan(4));
    expect(untranslated(DATA)).toEqual([]);
  });

  it('Settings screen: identity, rules, commodity master, buyer table', async () => {
    use();
    mockFetch({ 'GET /yard/settings': { item: settingsItem }, 'GET /yard/buyers?limit=100': { items: buyers } });
    render(<SettingsScreen notify={() => {}} onNavigate={() => {}} />);
    await screen.findByText('Patel');
    expect(untranslated(DATA)).toEqual([]);
  });

  it('Settings screen with no buyers', async () => {
    use();
    mockFetch({ 'GET /yard/settings': { item: settingsItem }, 'GET /yard/buyers?limit=100': { items: [] } });
    render(<SettingsScreen notify={() => {}} onNavigate={() => {}} />);
    await screen.findByDisplayValue('Surat Committee');
    expect(untranslated(DATA)).toEqual([]);
  });

  it('Auction ticket print (3 copies, farmer and trader seller) and gate pass print', () => {
    use();
    const { unmount } = render(<TicketPrint ticket={ticket} />);
    expect(untranslated(DATA)).toEqual([]);
    unmount();
    render(<TicketPrint ticket={{ ...ticket, lot: { ...ticket.lot, sellerType: 'trader', traderRegistrationNo: 'TRD-9' } }} />);
    expect(untranslated(DATA)).toEqual([]);
    document.body.innerHTML = '';
    render(<GatePassPrint pass={pass} />);
    expect(untranslated(DATA)).toEqual([]);
  });

  it('DataTable empty state and search modal (results, empty, loading)', async () => {
    use();
    const { unmount } = render(<DataTable columns={[['a', 'a']]} rows={[]} />);
    expect(untranslated()).toEqual([]);
    unmount();
    mockFetch({ 'GET /yard/search?q=ab': { lots: [{ _id: 'l1', lotNumber: 'LOT-1', farmerName: 'Ramesh', commodity: 'Wheat', status: 'arrived' }], tickets: [{ _id: 't1', ticketNumber: 'APMC-1', rate: 10, lot: { farmerName: 'Ramesh', commodity: 'Wheat' } }] } });
    render(<SearchModal query="ab" onClose={() => {}} onOpenLot={() => {}} onOpenTicket={() => {}} />);
    expect(untranslated(DATA)).toEqual([]);
    await screen.findByText('LOT-1');
    expect(untranslated(DATA)).toEqual([]);
  });
});

describe('the purity helper itself', () => {
  it('read the shared allowlist', () => { expect(ALLOWED.has('UTR')).toBe(true); expect(ALLOWED.has('Dashboard')).toBe(false); expect(ALLOWED.size).toBeGreaterThan(20); });
  it('flags an untranslated English label and passes allowed tokens and fixture data', () => {
    document.body.innerHTML = '<button aria-label="Open settlement">UTR CSV Ramesh</button><input placeholder="Refresh"/>';
    const bad = untranslated(new Set(['Ramesh']));
    expect(bad.some(b => b.startsWith('settlement'))).toBe(true);
    expect(bad.some(b => b.startsWith('Refresh'))).toBe(true);
    expect(bad.some(b => /^(UTR|CSV|Ramesh)\b/.test(b))).toBe(false);
    document.body.innerHTML = '';
  });
});
