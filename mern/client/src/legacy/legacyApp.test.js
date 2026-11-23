// Tests for the legacy static prototype (public/index.html + public/app.js).
// Each test boots a fresh jsdom with the real HTML and script, so state never leaks between tests.
import { describe, it, expect, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const pub = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../public');
const html = fs.readFileSync(path.join(pub, 'index.html'), 'utf8').replace(/<script[\s\S]*?<\/script>/g, '');
const script = fs.readFileSync(path.join(pub, 'app.js'), 'utf8');
const STORE = 'yardos_demo_v2';

let seedCache;
function SEED() { if (!seedCache) { const a = boot(); a.click(a.$('#languageToggle')); seedCache = a.saved(); } return structuredClone(seedCache); }

function boot(stored) {
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'http://localhost/', pretendToBeVisual: true });
  const { window } = dom;
  if (stored !== undefined) window.localStorage.setItem(STORE, typeof stored === 'string' ? stored : JSON.stringify(stored));
  window.confirm = vi.fn(() => true);
  window.print = vi.fn();
  window.URL.createObjectURL = vi.fn(() => 'blob:x'); window.URL.revokeObjectURL = vi.fn();
  window.HTMLAnchorElement.prototype.click = vi.fn();
  window.eval(script);
  const d = window.document;
  const $ = s => d.querySelector(s), $$ = s => [...d.querySelectorAll(s)];
  const click = el => el.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  const nav = view => click($(`[data-view="${view}"]`));
  // Clicks the real button when the current view renders one; otherwise a stand-in carrying the same data-action
  // (the app uses a single delegated document click handler, so the handler under test is the same).
  const act = (a, ref) => {
    let el = $(`[data-action="${a}"]${ref !== undefined ? `[data-ref="${ref}"]` : ''}`);
    if (!el) { el = d.createElement('button'); el.dataset.action = a; if (ref !== undefined) el.dataset.ref = ref; d.body.append(el); }
    click(el);
  };
  const fill = (form, values) => { for (const [k, v] of Object.entries(values)) { const el = form.elements[k]; if (!el) throw new Error('no field ' + k); el.value = v; } };
  const submit = (id, values) => {
    const form = d.getElementById(id); fill(form, values);
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  };
  const saved = () => JSON.parse(window.localStorage.getItem(STORE));
  // Nothing is written until the first state change, so unchanged state is the seed.
  const state = () => saved() ?? SEED();
  const toasts = () => $$('#toastStack .toast').map(t => t.textContent);
  const modalOpen = () => !$('#modalBackdrop').hidden;
  return { dom, window, d, $, $$, click, nav, act, submit, fill, saved, state, toasts, modalOpen, text: () => $('#viewRoot').textContent };
}
const entry = (o = {}) => ({ sellerType: 'farmer', farmer: 'Test Farmer', mobile: '9876543210', village: 'Kamrej', state: 'Gujarat', district: 'Surat', taluka: 'Kamrej', farmerRegistryId: '', landRecordType: '7/12', landRecordNo: '1', traderRegistrationNo: '', commodity: 'ઘઉં', bags: '10', vehicle: 'gj05ab1111', estimated: '20', quality: 'FAQ', notes: '', ...o });

describe('legacy prototype – boot & persistence', () => {
  it('renders the dashboard from seed data and shows the open-complaint count in the nav', () => {
    const app = boot();
    expect(app.$('#viewRoot').innerHTML.length).toBeGreaterThan(200);
    expect(app.$('#disputeNavCount').textContent).toBe('3'); // 2 open + 1 investigating, 1 resolved
  });
  it('recovers from corrupted or malformed localStorage by re-seeding', () => {
    for (const bad of ['{not json', '{"foo":1}', 'null']) {
      const app = boot(bad);
      app.nav('gate');
      expect(app.text()).toContain('LOT-261103-125');
    }
  });
  it('restores previously saved state', () => {
    const first = boot(); first.nav('gate');
    const seed = first.saved() ?? null;
    const state = JSON.parse(first.window.localStorage.getItem(STORE) || 'null');
    const app = boot(state ?? seed ?? undefined);
    app.nav('gate');
    expect(app.text()).toContain('LOT-261103-125');
  });
  it('backfills missing buyer-dues fields on old saved bills', () => {
    const first = boot(); first.act('new-entry'); // force a save
    first.window.localStorage.removeItem(STORE);
    first.submit('entryForm', entry());
    const old = first.saved();
    old.bills.forEach(b => { delete b.buyerMarketFee; delete b.buyerOther; delete b.buyerFeePaid; delete b.buyerTotalDue; });
    delete old.deductions;
    const app = boot(old);
    app.nav('sales');
    expect(app.text()).not.toContain('NaN');
  });
});

describe('legacy prototype – navigation & roles', () => {
  it('navigates to every view without errors, updating the active nav item and breadcrumb', () => {
    const app = boot();
    for (const view of ['dashboard', 'gate', 'auction', 'weighment', 'sales', 'payments', 'buyerledger', 'gatepass', 'disputes', 'reports', 'audit', 'settings']) {
      app.nav(view);
      expect(app.$(`.nav-item[data-view="${view}"]`).classList.contains('active'), view).toBe(true);
      expect(app.$('#viewRoot').innerHTML.length, view).toBeGreaterThan(50);
      expect(app.$('#viewRoot').textContent, view).not.toMatch(/NaN|undefined/);
    }
  });
  it('blocks views the current role may not use and shows an error toast', () => {
    const app = boot();
    app.act('switch-role');
    app.submit('roleForm', { role: 'Gate' });
    expect(app.saved().role).toBe('Gate');
    app.nav('settings');
    expect(app.toasts().some(t => t.includes('પરવાનગી નથી'))).toBe(true);
    expect(app.$('.nav-item[data-view="settings"]').classList.contains('active')).toBe(false);
    app.nav('payments');
    expect(app.$('.nav-item[data-view="payments"]').classList.contains('active')).toBe(false);
    app.nav('gate');
    expect(app.$('.nav-item[data-view="gate"]').classList.contains('active')).toBe(true);
  });
  it('inspector can open audit but not payments; accounts the reverse', () => {
    const inspector = boot(); inspector.act('switch-role'); inspector.submit('roleForm', { role: 'Inspector' });
    inspector.nav('audit'); expect(inspector.$('.nav-item[data-view="audit"]').classList.contains('active')).toBe(true);
    inspector.nav('payments'); expect(inspector.$('.nav-item[data-view="payments"]').classList.contains('active')).toBe(false);
    const accounts = boot(); accounts.act('switch-role'); accounts.submit('roleForm', { role: 'Accounts' });
    accounts.nav('payments'); expect(accounts.$('.nav-item[data-view="payments"]').classList.contains('active')).toBe(true);
    accounts.nav('audit'); expect(accounts.$('.nav-item[data-view="audit"]').classList.contains('active')).toBe(false);
  });
});

describe('legacy prototype – gate entry', () => {
  it('creates a lot, logs it, persists it and closes the modal', () => {
    const app = boot(); app.nav('gate'); app.act('new-entry');
    expect(app.modalOpen()).toBe(true);
    app.submit('entryForm', entry());
    expect(app.modalOpen()).toBe(false);
    const lot = app.saved().lots[0];
    expect(lot).toMatchObject({ id: 'LOT-261103-126', farmer: 'Test Farmer', bags: 10, vehicle: 'GJ05AB1111', status: 'arrived', commodity: 'ઘઉં' });
    expect(app.saved().audit[0].ref).toBe('LOT-261103-126');
    expect(app.text()).toContain('LOT-261103-126');
    expect(app.saved().nextLot).toBe(127);
  });
  it('rejects trader sellers without a registration ID', () => {
    const app = boot(); app.act('new-entry');
    const before = app.window.localStorage.getItem(STORE);
    app.submit('entryForm', entry({ sellerType: 'trader', traderRegistrationNo: '   ' }));
    expect(app.toasts().some(t => t.includes('Registration'))).toBe(true);
    expect(app.modalOpen()).toBe(true);
    expect(app.window.localStorage.getItem(STORE)).toBe(before);
  });
  it('escapes HTML in user-entered names (no XSS in the register)', () => {
    const app = boot(); app.act('new-entry');
    app.submit('entryForm', entry({ farmer: '<img src=x onerror=alert(1)>' }));
    app.nav('gate');
    expect(app.$('#viewRoot img')).toBeNull();
    expect(app.text()).toContain('<img src=x onerror=alert(1)>');
  });
});

describe('legacy prototype – auction, weighment, billing, payments, gate pass', () => {
  const ticketFor = (app, lotId, buyer, extra = {}) => { app.act('new-ticket'); app.submit('ticketForm', { lotId, buyer, rate: '2500', quantity: '10', quality: 'FAQ', method: 'open_outcry', notes: '', ...extra }); };
  const newLot = app => { app.act('new-entry'); app.submit('entryForm', entry({ estimated: '20' })); return app.saved().lots[0].id; };

  it('issues a ticket for an arrived lot, moves it to auctioned and stores the credit deadline', () => {
    const app = boot(); app.nav('auction');
    ticketFor(app, 'LOT-261103-125', 'પટેલ એગ્રો');
    const s = app.saved();
    expect(s.lots.find(l => l.id === 'LOT-261103-125')).toMatchObject({ status: 'auctioned', buyer: 'પટેલ એગ્રો', rate: 2500 });
    const t = s.tickets[0];
    expect(t.ticketNo).toBe('APMC-26-00048');
    expect(t.buyerCreditDays).toBe(3);
    expect(new Date(t.buyerCreditDueAt) > new Date()).toBe(true);
  });
  it('does not offer an already-auctioned lot for a second ticket', () => {
    const app = boot();
    ticketFor(app, 'LOT-261103-125', 'પટેલ એગ્રો');
    const count = app.saved().tickets.length;
    app.act('new-ticket');
    expect([...app.d.getElementById('ticketForm').elements.lotId.options].map(o => o.value)).not.toContain('LOT-261103-125');
    ticketFor(app, 'LOT-261103-125', 'પટેલ એગ્રો');
    expect(app.saved().tickets.length).toBe(count);
  });
  it('enforces the buyer purchase limit', () => {
    const app = boot();
    ticketFor(app, 'LOT-261103-125', 'પટેલ એગ્રો', { rate: '40000', quantity: '10' }); // 4,00,000 > limit 3,00,000 minus existing exposure
    expect(app.state().tickets.length).toBe(4);
    expect(app.toasts().some(t => t.includes('limit'))).toBe(true);
    expect(app.state().lots.find(l => l.id === 'LOT-261103-125').status).toBe('arrived');
  });
  it('weighment creates a sale bill with gross = net × rate; invalid weights are rejected', () => {
    const app = boot(); const id = newLot(app);
    ticketFor(app, id, 'શ્રી ગણેશ ટ્રેડર્સ');
    app.act('weigh-lot', id);
    app.submit('weighForm', { gross: '5', tare: '5', scaleId: 'S1', slipRef: 'R1', notes: '' });
    expect(app.saved().bills.length).toBe(3);
    expect(app.toasts().some(t => t.includes('Gross'))).toBe(true);
    app.submit('weighForm', { gross: '18', tare: '3', scaleId: 'S1', slipRef: 'R1', notes: '' });
    const bill = app.saved().bills[0];
    expect(bill).toMatchObject({ lotId: id, weight: 15, rate: 2500, gross: 37500, net: 37500 });
    expect(app.saved().lots.find(l => l.id === id)).toMatchObject({ status: 'weighed', net: 15 });
  });
  it('payments: overpayment and non-positive amounts are rejected; full payment marks bill and lot paid', () => {
    const app = boot();
    const bill = 'SB-26-00028'; // seeded, payable 36,754
    app.act('record-payment', bill);
    app.submit('paymentForm', { amount: '99999999', ref: 'UTR000111', mode: 'NEFT', notes: '' });
    expect(app.state().bills.find(b => b.billNo === bill).paid).toBe(0);
    expect(app.modalOpen()).toBe(true); // form validation (max = outstanding) blocks the submit
    app.submit('paymentForm', { amount: '0', ref: 'UTR000111', mode: 'NEFT', notes: '' });
    expect(app.state().bills.find(b => b.billNo === bill).paid).toBe(0);
    app.submit('paymentForm', { amount: '10000', ref: 'UTR000111', mode: 'NEFT', notes: '' });
    let b = app.saved().bills.find(x => x.billNo === bill);
    expect(b.paid).toBe(10000); expect(b.status).toBe('payment_pending');
    app.act('record-payment', bill);
    app.submit('paymentForm', { amount: '26754', ref: 'UTR000222', mode: 'NEFT', notes: '' });
    b = app.saved().bills.find(x => x.billNo === bill);
    expect(b.status).toBe('paid');
    expect(app.saved().lots.find(l => l.id === b.lotId).status).toBe('paid');
  });
  it('gate pass requires a paid lot; mark-dispatched needs a pass number', () => {
    const app = boot(); app.nav('gatepass');
    app.act('create-pass', 'LOT-261103-125');
    expect(app.toasts().some(t => t.includes('settlement'))).toBe(true);
    expect(app.saved()?.lots?.find(l => l.id === 'LOT-261103-125')?.passNo).toBeUndefined();
  });
  it('gate pass actions are blocked for roles without gate permission', () => {
    const app = boot(); app.act('switch-role'); app.submit('roleForm', { role: 'Auction' });
    app.act('create-pass', 'LOT-261103-122');
    expect(app.toasts().some(t => t.includes('પરવાનગી'))).toBe(true);
  });
});

describe('legacy prototype – buyers, terms, complaints, search, export, reset', () => {
  it('adds a buyer, blocks duplicates (case-insensitive) and renames propagate to bills/tickets', () => {
    const app = boot(); app.act('add-buyer');
    app.submit('buyerForm', { name: 'New Trader', registrationNo: 'REG-1', creditDays: '4', purchaseLimit: '1000' });
    expect(app.saved().buyers).toContain('New Trader');
    expect(app.saved().buyerProfiles['New Trader']).toEqual({ registrationNo: 'REG-1', creditDays: 4, purchaseLimit: 1000 });
    app.act('add-buyer');
    app.submit('buyerForm', { name: 'new trader', registrationNo: 'REG-2', creditDays: '4', purchaseLimit: '0' });
    expect(app.saved().buyers.filter(b => b.toLowerCase() === 'new trader')).toHaveLength(1);
    expect(app.toasts().some(t => t.includes('પહેલેથી'))).toBe(true);
    app.act('edit-buyer', 'પટેલ એગ્રો');
    app.submit('buyerForm', { name: 'Patel Renamed', registrationNo: 'GJ-SRT-TR-052', creditDays: '3', purchaseLimit: '300000' });
    const s = app.saved();
    expect(s.bills.some(b => b.buyer === 'Patel Renamed')).toBe(true);
    expect(s.bills.some(b => b.buyer === 'પટેલ એગ્રો')).toBe(false);
    expect(s.buyerProfiles['પટેલ એગ્રો']).toBeUndefined();
  });
  it('terms form updates deadlines policy as numbers', () => {
    const app = boot(); app.act('edit-terms');
    app.submit('termsForm', { farmerPaymentDays: '3', dispatchDays: '4', defaultBuyerCreditDays: '6' });
    expect(app.saved().terms).toEqual({ farmerPaymentDays: 3, dispatchDays: 4, defaultBuyerCreditDays: 6 });
  });
  it('commodities: add and reject duplicates', () => {
    const app = boot(); app.act('add-commodity');
    app.submit('commodityForm', { name: 'તલ' });
    expect(app.saved().commodities).toContain('તલ');
    app.act('add-commodity');
    app.submit('commodityForm', { name: 'તલ' });
    expect(app.saved().commodities.filter(c => c === 'તલ')).toHaveLength(1);
  });
  it('deductions form stores numbers', () => {
    const app = boot(); app.act('edit-deductions');
    app.submit('deductForm', { sellerApproved: '10', buyerMarketFee: '20', buyerOther: '' });
    expect(app.saved().deductions).toEqual({ sellerApproved: 10, buyerMarketFee: 20, buyerOther: 0 });
  });
  it('complaints: register one and resolve it', () => {
    const app = boot(); app.act('new-complaint');
    app.submit('complaintForm', { lotId: '', by: 'Ram', mobile: '9999999999', type: 'વજનમાં તફાવત', details: 'weights differ', evidence: 'slip-1' });
    const c = app.saved().complaints[0];
    expect(c).toMatchObject({ id: 'CMP-26-00012', status: 'open', lotId: 'Unlinked', by: 'Ram' });
    expect(c.details).toContain('Evidence: slip-1');
    app.act('resolve-complaint', c.id);
    expect(app.saved().complaints[0].status).toBe('resolved');
    expect(app.$('#disputeNavCount').textContent).toBe('3');
  });
  it('global search shows matching lots and ignores non-matches', () => {
    const app = boot();
    const box = app.$('#globalSearch'); box.value = 'LOT-261103-125';
    box.dispatchEvent(new app.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(app.$('#modalBody').textContent).toContain('LOT-261103-125');
    app.act('close-modal');
    box.value = 'zzzz-nothing';
    box.dispatchEvent(new app.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(app.$('#modalBody').textContent).not.toContain('LOT-261103-125');
  });
  it('table search filters the gate register as you type', () => {
    const app = boot(); app.nav('gate');
    const box = app.$('#tableSearch'); box.value = 'ચોર્યાસી'; box.dispatchEvent(new app.window.Event('input', { bubbles: true }));
    expect(app.text()).toContain('LOT-261103-120');
    expect(app.text()).not.toContain('LOT-261103-125');
  });
  it('CSV export creates a BOM-prefixed, quoted blob and downloads it', async () => {
    const app = boot(); app.nav('reports');
    let blob; app.window.URL.createObjectURL = vi.fn(b => { blob = b; return 'blob:x'; });
    app.act('quick-report');
    expect(app.window.HTMLAnchorElement.prototype.click).toHaveBeenCalled();
    expect(blob).toBeDefined();
  });
  it('reset-demo restores seed data after confirmation and does nothing if declined', () => {
    const app = boot(); app.act('new-entry'); app.submit('entryForm', entry());
    expect(app.saved().lots.length).toBe(7);
    app.window.confirm = vi.fn(() => false);
    app.click(app.$('#resetDemo'));
    expect(app.saved().lots.length).toBe(7);
    app.window.confirm = vi.fn(() => true);
    app.click(app.$('#resetDemo'));
    expect(app.saved().lots.length).toBe(6);
  });
  it('modal closes via backdrop click and the close button', () => {
    const app = boot(); app.act('new-entry'); expect(app.modalOpen()).toBe(true);
    app.click(app.$('#modalBackdrop')); expect(app.modalOpen()).toBe(false);
    app.act('new-entry'); app.click(app.$('#modalClose')); expect(app.modalOpen()).toBe(false);
  });
  it('mobile menu toggles the sidebar', () => {
    const app = boot();
    app.click(app.$('#menuToggle')); expect(app.$('#sidebar').classList.contains('open')).toBe(true);
    app.click(app.$('#closeSidebar')); expect(app.$('#sidebar').classList.contains('open')).toBe(false);
  });
});
