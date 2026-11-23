// Rendered yard screens, dialogs and detail views in Gujarati and Hindi must contain no untranslated English words.
// Fixture data is written in the target script, so any Latin word left in the DOM comes from the UI itself.
// Exempt: acronyms / technical tokens (same list as i18n/scriptPurity.test.js) and tokens containing digits (ids, plates, amounts).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ModuleScreen } from './ModuleScreen.jsx';
import { DetailModal } from './DetailModal.jsx';
import { pageConfig } from '../../constants/pageConfig.js';
import { setLanguage } from '../../i18n/index.js';
import { mockFetch } from '../../test/mockFetch.js';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); setLanguage('gu'); });
const ALLOWED = new Set(['APMC', 'YardOS', 'UTR', 'CSV', 'QR', 'ID', 'NEFT', 'RTGS', 'IMPS', 'UPI', 'MIS', 'PDF', 'Excel', 'FAQ', 'GJ', 'XX', 'SMS', 'Q', 'KB', 'MB', 'OK', 'IST', 'UTC', 'PIN', 'GPS', 'OTP', 'PAN', 'GST', 'IFSC', 'KYC', 'AM', 'PM']);
const latinWords = text => (text.replace(/\S*\d\S*/g, ' ').match(/[A-Za-z][A-Za-z'’]+/g) || []).filter(w => !ALLOWED.has(w));
const attrs = root => [...root.querySelectorAll('[placeholder],[aria-label],[title]')].map(e => [e.placeholder, e.getAttribute('aria-label'), e.title].filter(Boolean).join(' ')).join(' ');
const optionText = root => [...root.querySelectorAll('option')].map(o => o.textContent).join(' ');
const screenText = root => {
  const copy = root.cloneNode(true);
  copy.querySelectorAll('option').forEach(o => o.remove());   // option labels are read separately, with separators
  return `${copy.textContent} ${attrs(root)} ${optionText(root)}`;
};
const noLatin = (root, what) => expect(latinWords(screenText(root)), what).toEqual([]);

const NAMES = { gu: { farmer: 'રમેશ', buyer: 'પટેલ', admin: 'એડમિન', crop: 'ઘઉં', village: 'કામરેજ', complaintType: 'વજનમાં તફાવત' }, hi: { farmer: 'रमेश', buyer: 'पटेल', admin: 'एडमिन', crop: 'गेहूँ', village: 'कामरेज', complaintType: 'वजन में अंतर' } };
const fx = lang => {
  const n = NAMES[lang];
  const lot = { _id: 'l1', lotNumber: 'LOT-1', farmerName: n.farmer, commodity: n.crop, bags: 5, status: 'auctioned', sellerType: 'farmer', netWeight: 12, vehicle: 'GJ05AB1234', village: n.village, arrivalAt: '2026-01-01T10:00:00Z', estimated: 20 };
  const buyer = { _id: 'b1', name: n.buyer, registrationNo: 'TR-1', creditDays: 3, purchaseLimit: 1000, active: true, ledger: { gross: 100, paid: 50, outstanding: 50, exposure: 50, overdueCount: 0, limitFull: false } };
  const held = { ...buyer, _id: 'b2', name: n.buyer + '२', ledger: { ...buyer.ledger, overdueCount: 2 } };
  const full = { ...buyer, _id: 'b3', name: n.buyer + '३', ledger: { ...buyer.ledger, limitFull: true } };
  const bill = { _id: 'bl1', billNumber: 'SB-1', farmerName: n.farmer, status: 'payment_pending', farmerNetPayable: 500, farmerPaid: 0, grossAmount: 500, buyerMarketFee: 0, buyerOtherDues: 0, lot: { lotNumber: 'LOT-1' }, buyer: { name: n.buyer } };
  const ticket = { _id: 't1', ticketNumber: 'T-1', quantity: 5, rate: 100, quality: 'FAQ', method: 'open_outcry', lot: { lotNumber: 'LOT-1', farmerName: n.farmer, commodity: n.crop }, buyer: { name: n.buyer, registrationNo: 'TR-1' }, createdAt: '2026-01-01T10:00:00Z' };
  const pass = { _id: 'p1', passNumber: 'GP-1', status: 'issued', lot: { lotNumber: 'LOT-1', farmerName: n.farmer }, buyer: { name: n.buyer }, vehicle: 'GJ05AB1234', issuedAt: '2026-01-01T10:00:00Z' };
  const complaint = { _id: 'c1', complaintNumber: 'CMP-1', complainant: n.farmer, type: n.complaintType, status: 'open', details: n.farmer, lot: { lotNumber: 'LOT-1' }, createdAt: '2026-01-01T10:00:00Z' };
  const list = (items, total = items.length) => ({ items, total, item: { commodities: [n.crop] } });
  return {
    lot, buyer, bill, ticket, pass, complaint,
    routes: {
      'GET /yard/lots': list([lot]), 'GET /yard/settings': list([]), 'GET /yard/tickets': list([ticket]), 'GET /yard/buyers': list([buyer, held, full]),
      'GET /yard/weighments': list([{ _id: 'w1', lot: { lotNumber: 'LOT-1', farmerName: n.farmer }, gross: 10, tare: 1, net: 9, createdAt: '2026-01-01T10:00:00Z' }]),
      'GET /yard/bills': list([bill]), 'GET /yard/payments': list([{ _id: 'pay1', receiptNumber: 'R-1', bill: { billNumber: 'SB-1' }, type: 'farmer_settlement', amount: 5, mode: 'NEFT', reference: 'UTR1', receivedAt: '2026-01-01T10:00:00Z' }]),
      'GET /yard/gate-passes': list([pass]), 'GET /yard/complaints': list([complaint]),
      'GET /yard/audit': list([{ _id: 'a1', createdAt: '2026-01-01T10:00:00Z', actorName: n.admin, role: 'admin', action: 'X', resource: 'Lot', resourceId: '1', reason: '' }]),
      'GET /yard/users': list([{ _id: 'u9', name: n.farmer, email: 'u9@t9.in', role: 'gate', active: true, lastLoginAt: '2026-01-01T10:00:00Z' }])
    }
  };
};
const admin = lang => ({ id: 'u0', name: NAMES[lang].admin, role: 'admin' });

describe.each(['gu', 'hi'])('yard screens in %s contain no untranslated English words', lang => {
  it.each(Object.keys(pageConfig))('page %s', async page => {
    setLanguage(lang); const f = fx(lang); mockFetch(f.routes);
    const { container } = render(<ModuleScreen page={page} user={admin(lang)} notify={() => {}} />);
    await waitFor(() => expect(container.querySelectorAll('tbody tr').length).toBeGreaterThan(0));
    if (page === 'audit') {
      // The audit table lists raw API action / resource identifiers (e.g. "Lot"); check everything around the table.
      for (const sel of ['.page-head', 'thead', '.table-info', '.search-box']) noLatin(container.querySelector(sel), `${page} ${sel}`);
    } else {
      noLatin(container, `${page} screen`);
    }
  });
  it.each(['gate', 'auction', 'weighment', 'payments', 'buyerledger', 'gatepass', 'disputes', 'users'])('create dialog of %s (labels, hints, placeholders, options)', async page => {
    setLanguage(lang); const f = fx(lang); mockFetch(f.routes);
    const { container } = render(<ModuleScreen page={page} user={admin(lang)} notify={() => {}} />);
    await waitFor(() => expect(container.querySelectorAll('tbody tr').length).toBeGreaterThan(0));
    await userEvent.click(container.querySelector('.page-actions .btn.primary'));
    const dialog = await screen.findByRole('dialog');
    noLatin(dialog, `${page} create dialog`);
  });
  it('edit dialogs (trader credit, staff access) and row-action buttons', async () => {
    for (const page of ['buyerledger', 'users']) {
      setLanguage(lang); const f = fx(lang); mockFetch(f.routes);
      const { container, unmount } = render(<ModuleScreen page={page} user={admin(lang)} notify={() => {}} />);
      await waitFor(() => expect(container.querySelectorAll('tbody tr').length).toBeGreaterThan(0));
      await userEvent.click(container.querySelector('tbody .row-action'));
      noLatin(await screen.findByRole('dialog'), `${page} edit dialog`);
      unmount();
    }
  });
  it('detail modal for lot, ticket, bill and complaint', () => {
    setLanguage(lang); const f = fx(lang);
    const data = { lot: { item: f.lot, ticket: f.ticket, weighments: [{ gross: 10, tare: 1, net: 9 }], bill: { ...f.bill, status: 'paid' }, pass: f.pass }, ticket: f.ticket, bill: f.bill, complaint: f.complaint };
    for (const kind of ['lot', 'ticket', 'bill', 'complaint']) {
      const { container, unmount } = render(<DetailModal detail={{ kind, data: data[kind] }} user={admin(lang)} onClose={() => {}} onVoidTicket={() => {}} onPrint={() => {}} />);
      noLatin(container, `detail ${kind}`);
      unmount();
    }
  });
});
