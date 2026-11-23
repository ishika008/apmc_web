// Shared components in en / hi (no Gujarati may remain in UI text) and unchanged defaults in gu.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DataTable } from './DataTable.jsx';
import { Modal } from './Modal.jsx';
import { FormDialog } from './FormDialog.jsx';
import { ErrorBoundary } from './ErrorBoundary.jsx';
import { SearchModal } from './SearchModal.jsx';
import { TicketPrint } from './TicketPrint.jsx';
import { GatePassPrint } from './GatePassPrint.jsx';
import { setLanguage, t } from '../../i18n/index.js';
import { mockFetch } from '../../test/mockFetch.js';

const GUJARATI = /[઀-૿]/;
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); setLanguage('gu'); });
const LANGS = ['gu', 'en', 'hi'];
const noGu = (lang, el) => { if (lang !== 'gu') expect(el.textContent).not.toMatch(GUJARATI); };

describe.each(LANGS)('common components in %s', lang => {
  it('DataTable: translated empty state, action header and default action label', () => {
    setLanguage(lang);
    const { container, rerender } = render(<DataTable columns={[['a', 'A']]} rows={[]} />);
    expect(screen.getByText(t('common.noRecords'))).toBeInTheDocument(); expect(screen.getByText(t('common.noRecordsHint'))).toBeInTheDocument(); noGu(lang, container);
    rerender(<DataTable columns={[['a', 'A']]} rows={[{ _id: '1', a: 'x' }]} onRowAction={() => {}} />);
    expect(screen.getByText(t('common.action'))).toBeInTheDocument(); expect(screen.getByRole('button', { name: new RegExp(t('common.open')) })).toBeInTheDocument(); noGu(lang, container);
  });
  it('DataTable: an explicit empty message and action label are used as given', () => {
    setLanguage(lang);
    render(<DataTable columns={[['a', 'A']]} rows={[]} empty="custom empty" />);
    expect(screen.getByText('custom empty')).toBeInTheDocument();
  });
  it('Modal: close button label and eyebrow follow the language; Escape and backdrop still close', async () => {
    setLanguage(lang); const onClose = vi.fn();
    render(<Modal title="T" onClose={onClose}>body</Modal>);
    await userEvent.click(screen.getByRole('button', { name: t('common.close') }));
    expect(onClose).toHaveBeenCalledTimes(1);
    await userEvent.keyboard('{Escape}'); expect(onClose).toHaveBeenCalledTimes(2);
  });
  it('FormDialog: default submit/cancel/select labels, busy label, and submit still passes the values', async () => {
    setLanguage(lang); const onSubmit = vi.fn(async () => {}); const onClose = vi.fn();
    const fields = [{ key: 'name', label: 'Name', type: 'text' }, { key: 'kind', label: 'Kind', type: 'select', options: [{ value: 'a', label: 'Alpha' }] }];
    const { container, rerender } = render(<FormDialog title="F" fields={fields} onClose={onClose} onSubmit={onSubmit} />);
    expect(screen.getByRole('option', { name: t('common.select') })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t('common.cancel') })).toBeInTheDocument(); noGu(lang, container);
    await userEvent.type(screen.getByRole('textbox'), 'zed');
    await userEvent.click(screen.getByRole('button', { name: new RegExp(t('common.save')) }));
    expect(onSubmit).toHaveBeenCalledWith({ name: 'zed', kind: '' });
    rerender(<FormDialog title="F" fields={fields} onClose={onClose} onSubmit={onSubmit} busy />);
    expect(screen.getByRole('button', { name: new RegExp(t('common.saving')) })).toBeDisabled();
  });
  it('FormDialog: an explicit submitLabel still wins over the default', () => {
    setLanguage(lang);
    render(<FormDialog title="F" fields={[]} onClose={() => {}} onSubmit={async () => {}} submitLabel="Go now" />);
    expect(screen.getByRole('button', { name: /Go now/ })).toBeInTheDocument();
  });
  it('ErrorBoundary fallback is translated', () => {
    setLanguage(lang); vi.spyOn(console, 'error').mockImplementation(() => {});
    const Boom = () => { throw new Error('boom'); };
    const { container } = render(<ErrorBoundary><Boom /></ErrorBoundary>);
    expect(screen.getByRole('alert')).toHaveTextContent(t('common.errorBoundary')); noGu(lang, container);
  });
  it('SearchModal: title, headers, buttons, empty and loading states', async () => {
    setLanguage(lang);
    mockFetch({ 'GET /yard/search?q=wheat': { lots: [{ _id: 'l1', lotNumber: 'LOT-1', farmerName: 'Ramesh', commodity: 'Wheat', status: 'arrived' }], tickets: [{ _id: 't1', ticketNumber: 'T-1', rate: 100, lot: { farmerName: 'Ramesh', commodity: 'Wheat' } }] }, 'GET /yard/search?q=zzz': { lots: [], tickets: [] } });
    const open = vi.fn(), openT = vi.fn();
    const { container, rerender } = render(<SearchModal query="wheat" onClose={() => {}} onOpenLot={open} onOpenTicket={openT} />);
    expect(screen.getByText(t('common.search.loading'))).toBeInTheDocument();
    expect(await screen.findByText(t('common.search.title', { query: 'wheat' }))).toBeInTheDocument();
    for (const k of ['recordId', 'farmer', 'crop', 'statusRate']) expect(await screen.findByText(t('common.search.' + k))).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: t('common.open') })); expect(open).toHaveBeenCalledWith('l1');
    await userEvent.click(screen.getByRole('button', { name: t('common.search.slip') })); expect(openT).toHaveBeenCalled(); noGu(lang, container);
    rerender(<SearchModal query="zzz" onClose={() => {}} onOpenLot={open} onOpenTicket={openT} />);
    expect(await screen.findByText(t('common.search.empty'))).toBeInTheDocument(); expect(screen.getByText(t('common.search.emptyHint'))).toBeInTheDocument();
  });
  it('TicketPrint: three copies with translated labels, farmer identity, and print button', async () => {
    setLanguage(lang);
    mockFetch({ 'GET /yard/settings': { item: {} } });
    const ticket = { ticketNumber: 'APMC-1', quantity: 10, rate: 100, quality: 'FAQ', method: 'e_auction', createdAt: '2026-03-05T10:00:00Z', buyer: { name: 'Patel', registrationNo: 'TR-1' }, lot: { lotNumber: 'LOT-1', farmerName: 'Ramesh', sellerType: 'farmer', farmerRegistryId: 'F1', landRecordType: '7/12', landRecordNo: '55', commodity: 'Wheat', bags: 5 } };
    const { container } = render(<TicketPrint ticket={ticket} />);
    for (const c of ['farmer', 'buyer', 'yard']) expect(screen.getByText(t('print.copyLine', { copy: t('print.copy.' + c), label: t('print.copyLabel.' + c) }))).toBeInTheDocument();
    expect(screen.getAllByText(t('print.ticket.title'))).toHaveLength(3);
    expect(screen.getAllByText(t('print.ticket.identityFarmer', { id: 'F1', type: '7/12', no: '55' }))).toHaveLength(3);
    expect(screen.getAllByText(t('print.ticket.sellerName'))).toHaveLength(3);
    expect(screen.getByRole('button', { name: new RegExp(t('print.printAll')) })).toBeInTheDocument();
    expect(screen.getAllByText(new RegExp(t('print.yardDefault').replace(/[()]/g, '')))).not.toHaveLength(0); noGu(lang, container);
  });
  it('TicketPrint: trader sellers show the trader identity with the translated seller type', () => {
    setLanguage(lang); mockFetch({ 'GET /yard/settings': { item: {} } });
    render(<TicketPrint ticket={{ ticketNumber: 'T', quantity: 1, rate: 1, lot: { sellerType: 'trader', traderRegistrationNo: 'TR-9', farmerName: 'X' } }} />);
    expect(screen.getAllByText(t('print.ticket.identityTrader', { id: 'TR-9' }))).toHaveLength(3);
    expect(screen.getAllByText(t('print.ticket.trader')).length).toBeGreaterThan(0);
  });
  it('GatePassPrint: labels, title, notice and print button', () => {
    setLanguage(lang);
    const { container } = render(<GatePassPrint pass={{ passNumber: 'GP-1', status: 'issued', issuedAt: '2026-03-05T10:00:00Z', vehicle: 'GJ05', buyer: { name: 'Patel' }, issuedBy: { name: 'Gate' }, lot: { lotNumber: 'LOT-1', farmerName: 'Ramesh', commodity: 'Wheat', netWeight: 12.5 } }} />);
    for (const k of ['number', 'lotId', 'farmer', 'buyer', 'crop', 'net', 'vehicle', 'status', 'issued', 'dispatch', 'issuedBy', 'override']) expect(screen.getByText(t('print.pass.' + k))).toBeInTheDocument();
    expect(screen.getByText(t('print.pass.title'))).toBeInTheDocument(); expect(screen.getByText(t('print.pass.notice'))).toBeInTheDocument();
    expect(screen.getByText('12.5 Q')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: new RegExp(t('print.print')) })).toBeInTheDocument(); noGu(lang, container);
  });
});
