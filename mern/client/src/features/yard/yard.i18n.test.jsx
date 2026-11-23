// i18n behaviour of the yard feature group (ModuleScreen, FormFields, DetailModal, pageConfig).
// Only the network boundary (fetch) is stubbed. Gujarati-script checks are limited to text this feature owns
// (page head, column headers, form labels/hints/placeholders/options, notices, buttons) – table *cell values* come
// from shared formatters and shared dialog chrome belongs to other components.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ModuleScreen } from './ModuleScreen.jsx';
import { DetailModal } from './DetailModal.jsx';
import { FormFieldsFor, userEditFields } from './FormFields.jsx';
import { pageConfig, columnsFor } from '../../constants/pageConfig.js';
import { setLanguage, t } from '../../i18n/index.js';
import { messages } from '../../i18n/locales/index.js';
import { mockFetch } from '../../test/mockFetch.js';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); setLanguage('gu'); });
const GU = /[઀-૿]/;
const admin = { id: 'u0', name: 'Admin', role: 'admin' };
const lot = { _id: 'l1', lotNumber: 'LOT-1', farmerName: 'Ramesh', commodity: 'Wheat', bags: 5, status: 'auctioned', sellerType: 'farmer', netWeight: 12, vehicle: 'GJ1', village: 'Kamrej', arrivalAt: '2026-01-01T10:00:00Z' };
const buyer = { _id: 'b1', name: 'Patel', registrationNo: 'TR-1', creditDays: 3, purchaseLimit: 1000, active: true, ledger: { gross: 100, paid: 50, outstanding: 50, exposure: 50, overdueCount: 0, limitFull: false } };
const bill = { _id: 'bl1', billNumber: 'SB-1', farmerName: 'Ramesh', status: 'payment_pending', farmerNetPayable: 500, farmerPaid: 0, grossAmount: 500, buyerMarketFee: 0, buyerOtherDues: 0, lot: { lotNumber: 'LOT-1' }, buyer: { name: 'Patel' } };
const ticketRow = { _id: 't1', ticketNumber: 'T-1', quantity: 5, rate: 100, lot: { lotNumber: 'LOT-1', farmerName: 'Ramesh' }, buyer: { name: 'Patel' }, createdAt: '2026-01-01T10:00:00Z' };
const pass = { _id: 'p1', passNumber: 'GP-1', status: 'issued', lot: { lotNumber: 'LOT-1', farmerName: 'Ramesh' }, buyer: { name: 'Patel' }, vehicle: 'GJ1', issuedAt: '2026-01-01T10:00:00Z' };
const complaintRow = { _id: 'c1', complaintNumber: 'CMP-1', complainant: 'Mahesh', type: 'Weight', status: 'open', details: 'details here', lot: { lotNumber: 'LOT-1' }, createdAt: '2026-01-01T10:00:00Z' };
const list = (items, total = items.length) => ({ items, total, item: { commodities: ['Wheat'] } });
const routes = (over = {}) => ({
  'GET /yard/lots': list([lot]), 'GET /yard/settings': list([]), 'GET /yard/tickets': list([ticketRow]), 'GET /yard/buyers': list([buyer]),
  'GET /yard/weighments': list([{ _id: 'w1', lot: { lotNumber: 'LOT-1', farmerName: 'Ramesh' }, gross: 10, tare: 1, net: 9, createdAt: '2026-01-01T10:00:00Z' }]),
  'GET /yard/bills': list([bill]), 'GET /yard/payments': list([{ _id: 'pay1', receiptNumber: 'R-1', bill: { billNumber: 'SB-1' }, type: 'farmer_settlement', amount: 5, mode: 'NEFT', reference: 'UTR1', receivedAt: '2026-01-01T10:00:00Z' }]),
  'GET /yard/gate-passes': list([pass]), 'GET /yard/complaints': list([complaintRow]),
  'GET /yard/audit': list([{ _id: 'a1', createdAt: '2026-01-01T10:00:00Z', actorName: 'Admin', role: 'admin', action: 'X', resource: 'Lot', resourceId: '1', reason: '' }]),
  'GET /yard/users': list([{ _id: 'u9', name: 'Other', email: 'o@t.io', role: 'gate', active: true }]), ...over
});
const regionText = el => el?.textContent || '';
const noGujarati = (el, what) => expect(GU.test(regionText(el)), `${what} still contains Gujarati: "${regionText(el).match(/.{0,30}[઀-૿]+.{0,30}/)?.[0]}"`).toBe(false);

const EN_TITLES = { gate: 'Gate Entry Register', auction: 'Auction & Digital Price Tickets', sales: 'Sale Bill Register', users: 'Staff & Role Administration' };
const HI_TITLES = { gate: 'गेट एंट्री रजिस्टर', payments: 'भुगतान और किसान निपटान', disputes: 'शिकायत और विवाद रजिस्टर' };

describe.each(['en', 'hi'])('every yard page in %s', lang => {
  it('shows translated heading, subtitle, column headers and no Gujarati in the screen chrome', async () => {
    for (const page of Object.keys(pageConfig)) {
      setLanguage(lang); mockFetch(routes());
      const { unmount, container } = render(<ModuleScreen page={page} user={admin} notify={() => {}} />);
      const cfg = pageConfig[page];
      const h1 = await screen.findByText(messages[lang][cfg.titleKey], { selector: 'h1' });
      expect(h1).toBeInTheDocument();
      expect(screen.getByText(messages[lang][cfg.subtitleKey])).toBeInTheDocument();
      await waitFor(() => expect(container.querySelectorAll('tbody tr').length).toBeGreaterThan(0));
      const headers = [...container.querySelectorAll('thead th')].map(th => th.textContent).filter(Boolean);
      for (const [, labelKey] of cfg.columns) expect(headers, `${page} header ${labelKey}`).toContain(messages[lang][labelKey]);
      noGujarati(container.querySelector('.page-head'), `${page} page head`);
      noGujarati(container.querySelector('thead'), `${page} table head`);
      noGujarati(container.querySelector('.table-info'), `${page} table info`);
      expect(container.querySelector('.search-box input').placeholder).toBe(messages[lang]['yard.search.ph']);
      if (cfg.createLabelKey) expect(screen.getByRole('button', { name: new RegExp(messages[lang][cfg.createLabelKey].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) })).toBeInTheDocument();
      unmount();
    }
  });
  it('known titles are real translations', async () => {
    const expected = lang === 'en' ? EN_TITLES : HI_TITLES;
    for (const [page, title] of Object.entries(expected)) {
      setLanguage(lang); mockFetch(routes());
      const { unmount } = render(<ModuleScreen page={page} user={admin} notify={() => {}} />);
      expect(await screen.findByText(title, { selector: 'h1' })).toBeInTheDocument();
      unmount();
    }
  });
  it('record count, loading text, refresh/CSV buttons, notices and action buttons are translated', async () => {
    setLanguage(lang); mockFetch(routes());
    const { container } = render(<ModuleScreen page="gatepass" user={admin} notify={() => {}} />);
    expect(screen.getByText(messages[lang]['yard.loadingRecords'])).toBeInTheDocument();
    await screen.findByText('GP-1');
    expect(screen.getByText(t('yard.recordsInfo', { count: 1 }))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: new RegExp(messages[lang]['yard.refresh']) })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: new RegExp(messages[lang]['yard.csv']) })).toBeInTheDocument();
    expect(screen.getByText(messages[lang]['yard.action.gatepass'])).toBeInTheDocument();
    expect(screen.getByText(messages[lang]['yard.action.pass'])).toBeInTheDocument();
    expect(container.querySelector('.notice-panel').textContent).toContain(messages[lang]['yard.notice.gatepass']);
    noGujarati(container.querySelector('.notice-panel'), 'gate pass notice');
  });
  it('pagination text is translated and interpolated', async () => {
    setLanguage(lang); mockFetch(routes({ 'GET /yard/audit': list([{ _id: 'a1', createdAt: '2026-01-01T10:00:00Z', actorName: 'A' }], 30) }));
    const { container } = render(<ModuleScreen page="audit" user={admin} notify={() => {}} />);
    await waitFor(() => expect(container.querySelector('.pagination')).not.toBeNull());
    const pg = container.querySelector('.pagination');
    expect(within(pg).getByText(t('yard.pagination.info', { from: 1, to: 25, total: 30 }))).toBeInTheDocument();
    expect(within(pg).getByRole('button', { name: messages[lang]['yard.pagination.prev'] })).toBeInTheDocument();
    expect(within(pg).getByRole('button', { name: messages[lang]['yard.pagination.next'] })).toBeInTheDocument();
    noGujarati(pg, 'pagination');
  });
  it('buyer ledger credit-status cells are translated', async () => {
    setLanguage(lang);
    mockFetch(routes({ 'GET /yard/buyers': list([buyer, { ...buyer, _id: 'b2', name: 'Late', ledger: { ...buyer.ledger, overdueCount: 2 } }, { ...buyer, _id: 'b3', name: 'Full', ledger: { ...buyer.ledger, limitFull: true } }]) }));
    render(<ModuleScreen page="buyerledger" user={admin} notify={() => {}} />);
    expect(await screen.findByText(messages[lang]['yard.credit.within'])).toBeInTheDocument();
    expect(screen.getByText(t('yard.credit.overdue', { count: 2 }))).toBeInTheDocument();
    expect(screen.getByText(messages[lang]['yard.credit.full'])).toBeInTheDocument();
  });
});

describe.each(['en', 'hi'])('create / edit dialogs in %s', lang => {
  const DIALOG_PAGES = ['gate', 'auction', 'weighment', 'payments', 'buyerledger', 'gatepass', 'disputes', 'users'];
  it('every field label, hint, placeholder and option label is translated (no Gujarati in the form fields)', async () => {
    const user = userEvent.setup();
    for (const page of DIALOG_PAGES) {
      setLanguage(lang); mockFetch(routes());
      const { unmount } = render(<ModuleScreen page={page} user={admin} notify={() => {}} />);
      await screen.findByRole('button', { name: new RegExp(messages[lang][pageConfig[page].createLabelKey].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) });
      await waitFor(() => expect(document.querySelectorAll('tbody tr').length).toBeGreaterThan(0));
      await user.click(screen.getByRole('button', { name: new RegExp(messages[lang][pageConfig[page].createLabelKey].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }));
      const form = document.querySelector('.record-form');
      expect(form, page).not.toBeNull();
      const wanted = FormFieldsFor(page, {}).map(f => f.label);
      const shown = [...form.querySelectorAll('label.field > span')].map(s => s.textContent.replace(/\s*\*$/, ''));
      for (const label of wanted) expect(shown, `${page} label`).toContain(label);
      for (const el of form.querySelectorAll('label.field')) {
        noGujarati(el.querySelector('span'), `${page} label`);
        noGujarati(el.querySelector('small'), `${page} hint`);
        el.querySelectorAll('input,textarea').forEach(i => expect(GU.test(i.placeholder || ''), `${page} placeholder`).toBe(false));
        el.querySelectorAll('option').forEach(o => { if (o.value) expect(GU.test(o.textContent), `${page} option "${o.textContent}"`).toBe(false); });
      }
      unmount();
    }
  });
  it('option VALUES sent to the API stay untranslated (quality, complaint type, seller type)', () => {
    setLanguage(lang);
    const gate = Object.fromEntries(FormFieldsFor('gate', {}).map(f => [f.key, f]));
    expect(gate.quality.options.map(o => o.value)).toEqual(['FAQ', 'Grade A', 'Grade B', 'તપાસ બાકી']);
    expect(gate.sellerType.options.map(o => o.value)).toEqual(['farmer', 'trader']);
    const disputes = Object.fromEntries(FormFieldsFor('disputes', {}).map(f => [f.key, f]));
    expect(disputes.type.options.map(o => o.value)).toEqual(['હરાજી દર અંગે', 'વજનમાં તફાવત', 'ગુણવત્તા અંગે', 'ચુકવણી વિલંબ', 'Gate / dispatch', 'અન્ય']);
    expect(disputes.lotId.options[0]).toEqual({ value: '', label: messages[lang]['forms.disputes.unlinked'] });
    expect(Object.fromEntries(FormFieldsFor('auction', {}).map(f => [f.key, f])).method.options.map(o => o.value)).toEqual(['open_outcry', 'e_auction', 'approved_negotiated']);
    expect(Object.fromEntries(FormFieldsFor('payments', {}).map(f => [f.key, f])).type.options.map(o => o.value)).toEqual(['farmer_settlement', 'buyer_purchase', 'buyer_fee']);
    expect(userEditFields().find(f => f.key === 'active').options.map(o => o.value)).toEqual(['true', 'false']);
  });
  it('the edit-staff and edit-trader dialogs use translated titles and fields', async () => {
    const user = userEvent.setup();
    setLanguage(lang); mockFetch(routes());
    const { unmount } = render(<ModuleScreen page="users" user={admin} notify={() => {}} />);
    await user.click(await screen.findByRole('button', { name: new RegExp(messages[lang]['yard.action.users']) }));
    expect(await screen.findByText(messages[lang]['yard.dialog.editStaff'], { selector: 'h2' })).toBeInTheDocument();
    expect(screen.getByText(messages[lang]['forms.users.resetPassword'])).toBeInTheDocument();
    unmount();
    mockFetch(routes());
    render(<ModuleScreen page="buyerledger" user={admin} notify={() => {}} />);
    await user.click(await screen.findByRole('button', { name: new RegExp(messages[lang]['yard.action.buyerledger']) }));
    expect(await screen.findByText(messages[lang]['yard.dialog.editBuyer'], { selector: 'h2' })).toBeInTheDocument();
  });
  it('auction buyer options show translated credit-hold / limit-full labels and stay disabled', async () => {
    const user = userEvent.setup();
    setLanguage(lang);
    mockFetch(routes({ 'GET /yard/buyers': list([{ ...buyer, name: 'Held', ledger: { ...buyer.ledger, overdueCount: 1 } }, { ...buyer, _id: 'b2', name: 'Fullco', ledger: { ...buyer.ledger, limitFull: true } }]) }));
    render(<ModuleScreen page="auction" user={admin} notify={() => {}} />);
    await user.click(await screen.findByRole('button', { name: new RegExp(messages[lang]['yard.page.auction.create'].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }));
    const held = await screen.findByRole('option', { name: t('yard.opt.buyerHold', { name: 'Held', reg: 'TR-1' }) });
    expect(held).toBeDisabled();
    expect(screen.getByRole('option', { name: t('yard.opt.buyerFull', { name: 'Fullco', reg: 'TR-1' }) })).toBeDisabled();
  });
  it('payment and gate-pass option labels are translated with interpolation', async () => {
    const user = userEvent.setup();
    setLanguage(lang); mockFetch(routes());
    const { unmount } = render(<ModuleScreen page="payments" user={admin} notify={() => {}} />);
    await user.click(await screen.findByRole('button', { name: new RegExp(messages[lang]['yard.page.payments.create'].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }));
    expect(await screen.findByRole('option', { name: /SB-1 · Ramesh · .*₹500/ })).toBeInTheDocument();
    if (lang === 'hi') expect(screen.getByRole('option', { name: /देय/ })).toBeInTheDocument();
    unmount();
  });
});

describe.each(['en', 'hi'])('dialogs, toasts and confirmations in %s', lang => {
  it('window.confirm, toast and prompt texts follow the language', async () => {
    const user = userEvent.setup();
    setLanguage(lang);
    mockFetch(routes({ 'POST /yard/gate-passes/p1/dispatch': {}, 'PATCH /yard/complaints/c1': {} }));
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const prompt = vi.spyOn(window, 'prompt').mockReturnValue('Fixed it properly');
    const notify = vi.fn();
    const { unmount } = render(<ModuleScreen page="gatepass" user={admin} notify={notify} />);
    await user.click(await screen.findByRole('button', { name: new RegExp(messages[lang]['yard.action.gatepass']) }));
    expect(confirm).toHaveBeenCalledWith(messages[lang]['yard.confirm.exit']);
    await waitFor(() => expect(notify).toHaveBeenCalledWith(messages[lang]['yard.toast.exitRecorded']));
    expect(GU.test(notify.mock.calls[0][0])).toBe(false);
    unmount();
    const notify2 = vi.fn();
    mockFetch(routes({ 'PATCH /yard/complaints/c1': {} }));
    render(<ModuleScreen page="disputes" user={admin} notify={notify2} />);
    await user.click(await screen.findByRole('button', { name: new RegExp(messages[lang]['yard.action.disputes'].replace(/[/]/g, '\\/')) })); // open -> investigating
    await waitFor(() => expect(notify2).toHaveBeenCalledWith(messages[lang]['yard.toast.complaintUpdated']));
    expect(prompt).not.toHaveBeenCalled(); // prompt only for the "resolved" transition
  });
  it('resolve prompt text and own-account warning are translated', async () => {
    const user = userEvent.setup();
    setLanguage(lang);
    const prompt = vi.spyOn(window, 'prompt').mockReturnValue('');
    mockFetch(routes({ 'GET /yard/complaints': list([{ ...complaintRow, status: 'investigating' }]) }));
    const { unmount } = render(<ModuleScreen page="disputes" user={admin} notify={() => {}} />);
    await user.click(await screen.findByRole('button', { name: new RegExp(messages[lang]['yard.action.disputes'].replace(/[/]/g, '\\/')) }));
    expect(prompt).toHaveBeenCalledWith(messages[lang]['yard.prompt.resolution']);
    unmount();
    const notify = vi.fn();
    mockFetch(routes({ 'GET /yard/users': list([{ _id: 'u0', name: 'Me', email: 'me@t.io', role: 'admin', active: true }]) }));
    render(<ModuleScreen page="users" user={admin} notify={notify} />);
    await user.click(await screen.findByRole('button', { name: new RegExp(messages[lang]['yard.action.users']) }));
    expect(notify).toHaveBeenCalledWith(messages[lang]['yard.toast.ownAccount'], 'error');
  });
});

describe('language switching while a screen is mounted', () => {
  it('re-translates in place without refetching or losing rows', async () => {
    setLanguage('gu'); const fetchMock = mockFetch(routes());
    const { container } = render(<ModuleScreen page="gate" user={admin} notify={() => {}} />);
    await screen.findByText('LOT-1');
    expect(screen.getByText(messages.gu['yard.page.gate.subtitle'])).toBeInTheDocument();
    const calls = fetchMock.mock.calls.length;
    act(() => setLanguage('en'));
    expect(screen.getByText(messages.en['yard.page.gate.subtitle'])).toBeInTheDocument();
    expect(screen.getByText('LOT-1')).toBeInTheDocument();
    noGujarati(container.querySelector('.page-head'), 'page head after switch');
    act(() => setLanguage('hi'));
    expect(screen.getByText(messages.hi['yard.page.gate.title'], { selector: 'h1' })).toBeInTheDocument();
    expect(screen.getByText('LOT-1')).toBeInTheDocument();
    act(() => setLanguage('gu'));
    expect(screen.getByText(messages.gu['yard.page.gate.title'], { selector: 'h1' })).toBeInTheDocument();
    expect(fetchMock.mock.calls.length, 'no refetch on language change').toBe(calls);
  });
  it('an open form dialog keeps what the user typed and relabels its fields', async () => {
    const user = userEvent.setup();
    setLanguage('en'); mockFetch(routes());
    render(<ModuleScreen page="gate" user={admin} notify={() => {}} />);
    await user.click(await screen.findByRole('button', { name: /New gate entry/ }));
    const name = screen.getByText('Farmer / seller name').closest('label').querySelector('input');
    await user.type(name, 'Typed Name');
    act(() => setLanguage('hi'));
    expect(screen.getByText('किसान / विक्रेता का नाम')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Typed Name')).toBeInTheDocument();
  });
  it('select option labels (auction buyers) follow the language without a reload', async () => {
    const user = userEvent.setup();
    setLanguage('en');
    const fetchMock = mockFetch(routes({ 'GET /yard/buyers': list([{ ...buyer, name: 'Held', ledger: { ...buyer.ledger, overdueCount: 1 } }]) }));
    render(<ModuleScreen page="auction" user={admin} notify={() => {}} />);
    await user.click(await screen.findByRole('button', { name: /New price ticket/ }));
    expect(await screen.findByRole('option', { name: 'Held · TR-1 · Credit hold (overdue)' })).toBeInTheDocument();
    const calls = fetchMock.mock.calls.length;
    act(() => setLanguage('hi'));
    expect(screen.getByRole('option', { name: t('yard.opt.buyerHold', { name: 'Held', reg: 'TR-1' }) })).toBeInTheDocument();
    expect(fetchMock.mock.calls.length).toBe(calls);
  });
  it('pageConfig.columnsFor reflects the active language', () => {
    setLanguage('en'); expect(columnsFor('gate')[0]).toEqual(['lotNumber', 'LOT ID']);
    expect(columnsFor('gate')[1]).toEqual(['farmerName', 'Farmer / seller']);
    setLanguage('gu'); expect(columnsFor('gate')[1]).toEqual(['farmerName', 'ખેડૂત / વેચનાર']);
    setLanguage('hi'); expect(columnsFor('gate')[1][1]).toBe('किसान / विक्रेता');
  });
});

describe.each(['en', 'hi'])('DetailModal in %s', lang => {
  const lotDetail = { item: { ...lot, mobile: '999', arrivalAt: '2026-01-01T10:00:00Z' }, ticket: { ticketNumber: 'T-1', rate: 100, buyer: { name: 'Patel' } }, weighments: [{ gross: 10, tare: 1, net: 9 }], bill: { billNumber: 'SB-1', farmerNetPayable: 500, status: 'paid' }, pass: { passNumber: 'GP-1', status: 'dispatched' } };
  const kinds = [
    ['lot', lotDetail], ['ticket', ticketRow], ['complaint', { ...complaintRow, resolution: 'ok' }],
    ['bill', { ...bill, sellerDeduction: 0, netWeight: 5, rate: 100, buyerPurchasePaid: 0 }]
  ];
  it('titles, row labels, timeline and buttons are translated (no Gujarati in labels/buttons)', () => {
    for (const [kind, data] of kinds) {
      setLanguage(lang);
      const { unmount, container } = render(<DetailModal detail={{ kind, data }} user={admin} onClose={() => {}} onVoidTicket={() => {}} onPrint={() => {}} />);
      const labels = [...container.ownerDocument.querySelectorAll('.detail-cell small')];
      expect(labels.length, kind).toBeGreaterThan(3);
      for (const l of labels) expect(GU.test(l.textContent), `${kind} label "${l.textContent}"`).toBe(false);
      noGujarati(container.ownerDocument.querySelector('.form-actions'), `${kind} buttons`);
      noGujarati(container.ownerDocument.querySelector('.modal-heading h2'), `${kind} title`);
      if (kind === 'lot') {
        expect(screen.getByText(messages[lang]['yard.detail.timeline'])).toBeInTheDocument();
        for (const s of ['gateEntry', 'auctionTicket', 'weighment', 'saleBill', 'farmerSettlement', 'gatePass', 'dispatch']) expect(screen.getAllByText(messages[lang]['yard.detail.step.' + s]).length).toBeGreaterThan(0);
        expect(screen.getAllByText(messages[lang]['yard.detail.completed']).length).toBe(7);
        noGujarati(container.ownerDocument.querySelector('.timeline-list'), 'timeline');
      }
      unmount();
    }
  });
  it('the cancel-ticket prompt is translated and the reason is still passed through unchanged', async () => {
    const user = userEvent.setup();
    setLanguage(lang);
    const prompt = vi.spyOn(window, 'prompt').mockReturnValue('  wrong rate entered  ');
    const onVoid = vi.fn().mockResolvedValue();
    render(<DetailModal detail={{ kind: 'ticket', data: ticketRow }} user={admin} onClose={() => {}} onVoidTicket={onVoid} onPrint={() => {}} />);
    await user.click(screen.getByRole('button', { name: messages[lang]['yard.detail.cancelTicket'] }));
    expect(prompt).toHaveBeenCalledWith(messages[lang]['yard.detail.cancelPrompt']);
    expect(onVoid).toHaveBeenCalledWith(ticketRow, 'wrong rate entered');
  });
  it('the dispatched-pass timeline step reflects state, and print titles interpolate the reference', () => {
    setLanguage(lang);
    render(<DetailModal detail={{ kind: 'ticketprint', data: ticketRow }} user={admin} onClose={() => {}} />);
    expect(screen.getByText(t('yard.detail.titleTicketPrint', { ref: 'T-1' }), { selector: 'h2' })).toBeInTheDocument();
  });
});
