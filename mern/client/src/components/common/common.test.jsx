import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Package } from 'lucide-react';
import { StatCard } from './StatCard.jsx';
import { DataTable } from './DataTable.jsx';
import { Modal } from './Modal.jsx';
import { FormDialog } from './FormDialog.jsx';
import { ErrorBoundary } from './ErrorBoundary.jsx';
import { SearchModal } from './SearchModal.jsx';
import { TicketPrint } from './TicketPrint.jsx';
import { GatePassPrint } from './GatePassPrint.jsx';
import { mockFetch } from '../../test/mockFetch.js';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('StatCard', () => {
  it('renders label, value, note and tone class', () => {
    const { container } = render(<StatCard label="Lots" value="12" note="today" icon={Package} tone="amber"/>);
    expect(screen.getByText('Lots')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('today')).toBeInTheDocument();
    expect(container.querySelector('.metric-icon.amber')).not.toBeNull();
  });
  it('works without a tone', () => {
    const { container } = render(<StatCard label="L" value="1" note="n" icon={Package}/>);
    expect(container.querySelector('.metric-icon').className.trim()).toBe('metric-icon');
  });
});

describe('DataTable', () => {
  const columns = [['lotNumber', 'Lot'], ['status', 'Stage'], ['buyer.name', 'Buyer']];
  it('shows the empty state for empty/undefined rows with default and custom text', () => {
    const { rerender } = render(<DataTable columns={columns} rows={[]}/>);
    expect(screen.getByText('કોઈ રેકોર્ડ મળ્યો નથી.')).toBeInTheDocument();
    rerender(<DataTable columns={columns} rows={undefined} empty="Nothing here"/>);
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });
  it('renders headers, nested paths and localised status labels (not dates)', () => {
    render(<DataTable columns={columns} rows={[{ _id: '1', lotNumber: 'LOT-1', status: 'paid', buyer: { name: 'Patel' } }, { _id: '2', lotNumber: 'LOT-2', status: 'arrived' }]}/>);
    expect(screen.getByText('Stage')).toBeInTheDocument();
    expect(screen.getByText('Patel')).toBeInTheDocument();
    expect(screen.getByText('ચુકવણી પૂર્ણ')).toHaveClass('good');
    expect(screen.getByText('આવક નોંધાઈ')).toHaveClass('neutral');
    expect(screen.getAllByText('—')).toHaveLength(1);
  });
  it('colours pending statuses as warn and active flags', () => {
    render(<DataTable columns={[['status', 'S'], ['active', 'A']]} rows={[{ id: 1, status: 'payment_pending', active: false }, { id: 2, status: 'dispatched', active: true }]}/>);
    expect(screen.getByText('ચુકવણી બાકી')).toHaveClass('warn');
    expect(screen.getByText('ના')).toHaveClass('warn');
    expect(screen.getByText('હા')).toHaveClass('good');
    expect(screen.getByText('માલ રવાના')).toHaveClass('good');
  });
  it('has no Action column without handlers', () => {
    render(<DataTable columns={columns} rows={[{ _id: 1, lotNumber: 'x' }]}/>);
    expect(screen.queryByText('Action')).toBeNull();
  });
  it('invokes row and secondary actions with the row', async () => {
    const onRow = vi.fn(), second = vi.fn();
    const row = { _id: 'a', lotNumber: 'L' };
    render(<DataTable columns={columns} rows={[row]} onRowAction={onRow} actionLabel="Open" secondaryAction={{ label: 'Print', onClick: second }}/>);
    await userEvent.click(screen.getByRole('button', { name: /Open/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Print' }));
    expect(onRow).toHaveBeenCalledWith(row); expect(second).toHaveBeenCalledWith(row);
  });
  it('uses the default action label and compact class', () => {
    const { container } = render(<DataTable columns={columns} rows={[{ _id: 1 }]} onRowAction={() => {}} compact/>);
    expect(screen.getByRole('button', { name: /ખોલો/ })).toBeInTheDocument();
    expect(container.querySelector('table.compact-table')).not.toBeNull();
  });
});

describe('Modal', () => {
  it('renders title/children and closes via button, Escape and backdrop (not card clicks)', async () => {
    const onClose = vi.fn();
    const { container } = render(<Modal title="Hello" onClose={onClose}><p>Body</p></Modal>);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Hello')).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByText('Body'));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.mouseDown(container.querySelector('.modal-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByLabelText('બંધ કરો'));
    expect(onClose).toHaveBeenCalledTimes(2);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(3);
    fireEvent.keyDown(window, { key: 'a' });
    expect(onClose).toHaveBeenCalledTimes(3);
  });
  it('applies wide and removes the key listener on unmount', () => {
    const onClose = vi.fn();
    const { container, unmount } = render(<Modal title="t" onClose={onClose} wide>x</Modal>);
    expect(container.querySelector('.modal-card.wide')).not.toBeNull();
    unmount(); fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('FormDialog', () => {
  const fields = [
    { key: 'name', label: 'Name', type: 'text', required: true },
    { key: 'qty', label: 'Qty', type: 'number', defaultValue: 3 },
    { key: 'kind', label: 'Kind', type: 'select', options: [{ value: 'a', label: 'Alpha' }, { value: 'b', label: 'Beta', disabled: true }] },
    { key: 'note', label: 'Note', type: 'textarea', hint: 'a hint' }
  ];
  it('shows defaults, hints, required marker', () => {
    render(<FormDialog title="T" fields={fields} onClose={() => {}} onSubmit={() => {}}/>);
    expect(screen.getByLabelText(/Qty/)).toHaveValue(3);
    expect(screen.getByText('a hint')).toBeInTheDocument();
    expect(screen.getByText('*')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Beta' })).toBeDisabled();
  });
  it('prefers initialValues (selects coerced to string) over defaults', () => {
    render(<FormDialog title="T" fields={[{ key: 'active', label: 'Active', type: 'select', options: [{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }] }, { key: 'qty', label: 'Qty', type: 'number', defaultValue: 3 }]} initialValues={{ active: false, qty: 9 }} onClose={() => {}} onSubmit={() => {}}/>);
    expect(screen.getByLabelText('Active')).toHaveValue('false');
    expect(screen.getByLabelText('Qty')).toHaveValue(9);
  });
  it('submits the values then closes', async () => {
    const onSubmit = vi.fn().mockResolvedValue(), onClose = vi.fn();
    render(<FormDialog title="T" fields={fields} onClose={onClose} onSubmit={onSubmit}/>);
    await userEvent.type(screen.getByLabelText(/Name/), 'Ram');
    await userEvent.selectOptions(screen.getByLabelText('Kind'), 'a');
    await userEvent.type(screen.getByLabelText(/Note/), 'hi');
    await userEvent.click(screen.getByRole('button', { name: /સાચવો/ }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onSubmit).toHaveBeenCalledWith({ name: 'Ram', qty: 3, kind: 'a', note: 'hi' });
  });
  it('shows the error and stays open when submit fails', async () => {
    const onClose = vi.fn();
    render(<FormDialog title="T" fields={fields} onClose={onClose} onSubmit={async () => { throw new Error('Server says no'); }}/>);
    await userEvent.type(screen.getByLabelText(/Name/), 'x');
    await userEvent.click(screen.getByRole('button', { name: /સાચવો/ }));
    expect(await screen.findByText('Server says no')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
  it('does not submit when a required field is empty (native validation)', async () => {
    const onSubmit = vi.fn();
    render(<FormDialog title="T" fields={fields} onClose={() => {}} onSubmit={onSubmit}/>);
    await userEvent.click(screen.getByRole('button', { name: /સાચવો/ }));
    expect(onSubmit).not.toHaveBeenCalled();
  });
  it('busy disables submit; cancel closes', async () => {
    const onClose = vi.fn();
    render(<FormDialog title="T" fields={fields} onClose={onClose} onSubmit={() => {}} busy/>);
    expect(screen.getByRole('button', { name: /સાચવી રહ્યું છે/ })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'રદ કરો' }));
    expect(onClose).toHaveBeenCalled();
  });
  it('renders password/email input types and custom submit label', () => {
    render(<FormDialog title="T" submitLabel="Go" fields={[{ key: 'p', label: 'Pw', type: 'password' }, { key: 'e', label: 'Em', type: 'email' }]} onClose={() => {}} onSubmit={() => {}}/>);
    expect(screen.getByLabelText('Pw')).toHaveAttribute('type', 'password');
    expect(screen.getByLabelText('Em')).toHaveAttribute('type', 'email');
    expect(screen.getByRole('button', { name: /Go/ })).toBeInTheDocument();
  });
});

describe('ErrorBoundary', () => {
  const Boom = () => { throw new Error('kaboom'); };
  it('renders children when healthy', () => {
    render(<ErrorBoundary><p>ok</p></ErrorBoundary>);
    expect(screen.getByText('ok')).toBeInTheDocument();
  });
  it('shows an alert fallback and logs when a child crashes', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<ErrorBoundary><Boom/></ErrorBoundary>);
    expect(screen.getByRole('alert')).toHaveTextContent('કંઈક ખોટું થયું');
    expect(err.mock.calls.some(c => String(c[0]).includes('[apmc] Unhandled UI error'))).toBe(true);
  });
});

describe('SearchModal', () => {
  const lot = { _id: 'l1', lotNumber: 'LOT-1', farmerName: 'Ramesh', commodity: 'ઘઉં', status: 'arrived' };
  const ticket = { _id: 't1', ticketNumber: 'APMC-1', rate: 2500, lot: { farmerName: 'Ramesh', commodity: 'ઘઉં' } };
  it('requests the encoded query, shows lots and tickets and wires the open handlers', async () => {
    const f = mockFetch({ 'GET /yard/search?q=a%26b': { lots: [lot], tickets: [ticket] } });
    const onOpenLot = vi.fn(), onOpenTicket = vi.fn();
    render(<SearchModal query="a&b" onClose={() => {}} onOpenLot={onOpenLot} onOpenTicket={onOpenTicket}/>);
    expect(screen.getByText('શોધી રહ્યા છીએ…')).toBeInTheDocument();
    expect(await screen.findByText('LOT-1')).toBeInTheDocument();
    expect(f.calls[0].path).toBe('/yard/search?q=a%26b');
    expect(screen.getByText('₹2,500.00')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'ખોલો' }));
    expect(onOpenLot).toHaveBeenCalledWith('l1');
    await userEvent.click(screen.getByRole('button', { name: 'કાપલી' }));
    expect(onOpenTicket).toHaveBeenCalledWith(ticket);
  });
  it('shows an empty state when nothing matches', async () => {
    mockFetch({ 'GET /yard/search?q=zz': { lots: [], tickets: [] } });
    render(<SearchModal query="zz" onClose={() => {}} onOpenLot={() => {}} onOpenTicket={() => {}}/>);
    expect(await screen.findByText('કોઈ મળતો રેકોર્ડ નથી')).toBeInTheDocument();
  });
  it('shows server errors', async () => {
    mockFetch({ 'GET /yard/search?q=zz': { status: 500, body: { message: 'Search broke' } } });
    render(<SearchModal query="zz" onClose={() => {}} onOpenLot={() => {}} onOpenTicket={() => {}}/>);
    expect(await screen.findByText('Search broke')).toBeInTheDocument();
  });
  it('re-queries when the query prop changes', async () => {
    const f = mockFetch({ 'GET /yard/search?q=aa': { lots: [lot], tickets: [] }, 'GET /yard/search?q=bb': { lots: [], tickets: [] } });
    const { rerender } = render(<SearchModal query="aa" onClose={() => {}} onOpenLot={() => {}} onOpenTicket={() => {}}/>);
    await screen.findByText('LOT-1');
    rerender(<SearchModal query="bb" onClose={() => {}} onOpenLot={() => {}} onOpenTicket={() => {}}/>);
    await screen.findByText('કોઈ મળતો રેકોર્ડ નથી');
    expect(f.calls.map(c => c.path)).toEqual(['/yard/search?q=aa', '/yard/search?q=bb']);
  });
});

describe('TicketPrint', () => {
  const ticket = {
    ticketNumber: 'APMC-2026-000001', rate: 2500, quantity: 15, method: 'e_auction', quality: 'FAQ', createdAt: '2026-03-05T10:00:00Z',
    farmerPaymentDueAt: '2026-03-06T10:00:00Z', dispatchDueAt: '2026-03-07T10:00:00Z', buyerCreditDueAt: '2026-03-10T10:00:00Z',
    buyer: { name: 'Patel Agro', registrationNo: 'TR-1' },
    lot: { lotNumber: 'LOT-1', farmerName: 'Ramesh', commodity: 'ઘઉં', bags: 10, sellerType: 'farmer', farmerRegistryId: 'FR1', landRecordType: '7/12', landRecordNo: '55' }
  };
  beforeEach(() => { window.QRCode = undefined; });
  it('renders three copies with ticket data, using the configured yard name', async () => {
    mockFetch({ 'GET /yard/settings': { item: { committeeName: 'Surat APMC' } } });
    window.QRCode = vi.fn(function () {}); window.QRCode.CorrectLevel = { M: 1 };
    const { container } = render(<TicketPrint ticket={ticket}/>);
    expect(screen.getAllByText('APMC-2026-000001')).toHaveLength(3);
    expect(screen.getByText(/વેચનાર નકલ/)).toBeInTheDocument();
    expect(screen.getByText(/ખરીદદાર નકલ/)).toBeInTheDocument();
    expect(screen.getByText(/યાર્ડ નકલ/)).toBeInTheDocument();
    expect(screen.getAllByText('₹37,500.00')).toHaveLength(3);
    expect(screen.getAllByText('ખેડૂત ID: FR1 · 7/12: 55')).toHaveLength(3);
    await waitFor(() => expect(screen.getAllByText(/Surat APMC/)).toHaveLength(3));
    await waitFor(() => expect(window.QRCode).toHaveBeenCalledTimes(3));
    expect(window.QRCode.mock.calls[0][1].text).toBe('APMC-2026-000001|LOT-1|2500');
    expect(container.querySelectorAll('.qr-wrap[data-qr]')).toHaveLength(3);
  });
  it('shows trader identity and falls back to the default yard name when settings fail', async () => {
    mockFetch({ 'GET /yard/settings': { status: 500, body: { message: 'x' } } });
    window.QRCode = vi.fn(function () {}); window.QRCode.CorrectLevel = { M: 1 };
    render(<TicketPrint ticket={{ ...ticket, lot: { ...ticket.lot, sellerType: 'trader', traderRegistrationNo: 'TRD-9' } }}/>);
    expect(screen.getAllByText('વેપારી નોંધણી: TRD-9')).toHaveLength(3);
    await waitFor(() => expect(window.QRCode).toHaveBeenCalled());
    expect(screen.getAllByText(/APMC માર્કેટ યાર્ડ/).length).toBe(3);
  });
  it('handles missing optional data with dashes and keeps the QR placeholder if QR lib throws', async () => {
    mockFetch({ 'GET /yard/settings': { item: {} } });
    const QR = vi.fn(function () { throw new Error('qr'); }); QR.CorrectLevel = { M: 1 }; window.QRCode = QR;
    const { container } = render(<TicketPrint ticket={{ ticketNumber: 'T', rate: 1, quantity: 1 }}/>);
    await waitFor(() => expect(QR).toHaveBeenCalled());
    expect(container.querySelector('.qr-wrap').textContent).toBe('QR');
  });
  it('prints via window.print', async () => {
    mockFetch({ 'GET /yard/settings': { item: {} } });
    window.QRCode = vi.fn(function () {}); window.QRCode.CorrectLevel = { M: 1 };
    window.print = vi.fn();
    render(<TicketPrint ticket={ticket}/>);
    await userEvent.click(screen.getByRole('button', { name: /પ્રિન્ટ/ }));
    expect(window.print).toHaveBeenCalled();
  });
});

describe('GatePassPrint', () => {
  const pass = { passNumber: 'GP-1', status: 'dispatched', vehicle: 'GJ05AB', issuedAt: '2026-03-05T10:00:00Z', dispatchAt: '2026-03-05T12:00:00Z', buyer: { name: 'Patel' }, issuedBy: { name: 'Gate Op' }, overrideReason: 'urgent override', lot: { lotNumber: 'LOT-1', farmerName: 'Ramesh', commodity: 'ઘઉં', netWeight: 15.25 } };
  it('renders pass details', () => {
    render(<GatePassPrint pass={pass}/>);
    for (const t of ['GP-1', 'LOT-1', 'Ramesh', 'Patel', '15.25 Q', 'GJ05AB', 'માલ રવાના', 'Gate Op', 'urgent override']) expect(screen.getByText(t)).toBeInTheDocument();
  });
  it('shows dashes for missing data and falls back to the lot vehicle', () => {
    render(<GatePassPrint pass={{ passNumber: 'GP-2', status: 'issued', lot: { vehicle: 'LOTVEH' } }}/>);
    expect(screen.getByText('LOTVEH')).toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(5);
  });
  it('prints', async () => {
    window.print = vi.fn();
    render(<GatePassPrint pass={pass}/>);
    await userEvent.click(screen.getByRole('button', { name: /પ્રિન્ટ/ }));
    expect(window.print).toHaveBeenCalled();
  });
});
