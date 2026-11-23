import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DetailModal } from './DetailModal.jsx';
import { mockFetch } from '../../test/mockFetch.js';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const lotData = (o = {}) => ({ item: { lotNumber: 'LOT-1', farmerName: 'Ramesh', mobile: '9879512041', commodity: 'ઘઉં', bags: 10, vehicle: 'GJ05', arrivalAt: '2026-03-05T10:00:00Z', status: 'weighed' },
  ticket: { ticketNumber: 'APMC-1', rate: 2500, buyer: { name: 'Patel' } }, weighments: [{ gross: 20, tare: 2, net: 18 }, { gross: 18, tare: 3, net: 15 }],
  bill: { billNumber: 'SB-1', farmerNetPayable: 37500, status: 'paid' }, pass: { passNumber: 'GP-1', status: 'issued' }, ...o });
const ticket = { _id: 't1', ticketNumber: 'APMC-9', quantity: 10, rate: 100, createdAt: '2026-03-05T10:00:00Z', lot: { lotNumber: 'LOT-3', farmerName: 'Suresh' }, buyer: { name: 'Patel' } };

describe('DetailModal', () => {
  it('lot: shows traceability data using the latest weighment and a full timeline', () => {
    render(<DetailModal detail={{ kind: 'lot', data: lotData() }} user={{ role: 'gate' }} onClose={() => {}}/>);
    expect(screen.getByText('લોટનો સંપૂર્ણ ઇતિહાસ · LOT-1')).toBeInTheDocument();
    expect(screen.getByText('18 / 3 / 15 Q')).toBeInTheDocument();
    expect(screen.getByText('₹2,500.00 / Q')).toBeInTheDocument();
    expect(screen.getByText('₹37,500.00')).toBeInTheDocument();
    expect(screen.getByText('GP-1')).toBeInTheDocument();
    expect(screen.getByText('તોલ પૂર્ણ')).toBeInTheDocument();
    expect(screen.getAllByText('પૂર્ણ')).toHaveLength(6);   // all but Dispatch (pass only issued)
    expect(screen.getAllByText('બાકી')).toHaveLength(1);
  });
  it('lot: omits missing sections and marks later stages pending', () => {
    render(<DetailModal detail={{ kind: 'lot', data: { item: { lotNumber: 'LOT-2', farmerName: 'X', commodity: 'ઘઉં', bags: 1, status: 'arrived' }, weighments: [] } }} user={{ role: 'gate' }} onClose={() => {}}/>);
    expect(screen.queryByText('Ticket')).toBeNull();
    expect(screen.getAllByText('બાકી')).toHaveLength(6);
    expect(screen.getAllByText('પૂર્ણ')).toHaveLength(1);
  });
  it('ticket: details; admin can cancel with a valid reason; reasons under 8 chars are ignored', async () => {
    const onVoid = vi.fn().mockResolvedValue();
    const prompt = vi.spyOn(window, 'prompt');
    render(<DetailModal detail={{ kind: 'ticket', data: ticket }} user={{ role: 'admin' }} onClose={() => {}} onVoidTicket={onVoid} onPrint={() => {}}/>);
    expect(screen.getByText('હરાજી ટિકિટ · APMC-9')).toBeInTheDocument();
    expect(screen.getByText('₹1,000.00')).toBeInTheDocument();
    prompt.mockReturnValueOnce('short');
    await userEvent.click(screen.getByRole('button', { name: 'ટિકિટ રદ કરો' }));
    expect(onVoid).not.toHaveBeenCalled();
    prompt.mockReturnValueOnce(null);
    await userEvent.click(screen.getByRole('button', { name: 'ટિકિટ રદ કરો' }));
    expect(onVoid).not.toHaveBeenCalled();
    prompt.mockReturnValueOnce('  wrong rate entered  ');
    await userEvent.click(screen.getByRole('button', { name: 'ટિકિટ રદ કરો' }));
    await waitFor(() => expect(onVoid).toHaveBeenCalledWith(ticket, 'wrong rate entered'));
  });
  it('ticket: surfaces void failures via alert', async () => {
    vi.spyOn(window, 'prompt').mockReturnValue('valid reason here');
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
    render(<DetailModal detail={{ kind: 'ticket', data: ticket }} user={{ role: 'admin' }} onClose={() => {}} onVoidTicket={async () => { throw new Error('A ticket linked to a sale bill cannot be voided'); }}/>);
    await userEvent.click(screen.getByRole('button', { name: 'ટિકિટ રદ કરો' }));
    await waitFor(() => expect(alert).toHaveBeenCalledWith('A ticket linked to a sale bill cannot be voided'));
  });
  it('ticket: non-admin cannot cancel; print callback fires', async () => {
    const onPrint = vi.fn();
    render(<DetailModal detail={{ kind: 'ticket', data: ticket }} user={{ role: 'auction' }} onClose={() => {}} onPrint={onPrint}/>);
    expect(screen.queryByRole('button', { name: 'ટિકિટ રદ કરો' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /ટિકિટ પ્રિન્ટ કરો/ }));
    expect(onPrint).toHaveBeenCalledWith(ticket);
  });
  it('bill: statement with computed balance and buyer dues', () => {
    const bill = { billNumber: 'SB-7', lot: { lotNumber: 'LOT-7' }, farmerName: 'R', buyer: { name: 'P' }, netWeight: 10, rate: 100, grossAmount: 1000, sellerDeduction: 10, farmerNetPayable: 990, farmerPaid: 400, buyerPurchasePaid: 0, buyerMarketFee: 20, buyerOtherDues: 5 };
    render(<DetailModal detail={{ kind: 'bill', data: bill }} user={{ role: 'accounts' }} onClose={() => {}}/>);
    expect(screen.getByText('વેચાણ પત્રક · SB-7')).toBeInTheDocument();
    expect(screen.getByText('₹590.00')).toBeInTheDocument();
    expect(screen.getByText('₹25.00')).toBeInTheDocument();
  });
  it('complaint: shows case data', () => {
    render(<DetailModal detail={{ kind: 'complaint', data: { complaintNumber: 'CMP-1', complainant: 'Ram', type: 'Weight', status: 'open', details: 'Short weight seen', createdAt: '2026-03-05T10:00:00Z' } }} user={{ role: 'gate' }} onClose={() => {}}/>);
    expect(screen.getByText('ફરિયાદ કેસ · CMP-1')).toBeInTheDocument();
    expect(screen.getByText('Short weight seen')).toBeInTheDocument();
    expect(screen.getByText('ખુલ્લી')).toBeInTheDocument();
    expect(screen.queryByText('ઉકેલ')).toBeNull();
  });
  it('ticketprint and passprint kinds render the print views', () => {
    mockFetch({ 'GET /yard/settings': { item: {} } });
    const { unmount } = render(<DetailModal detail={{ kind: 'ticketprint', data: ticket }} user={{}} onClose={() => {}}/>);
    expect(screen.getByText('ભાવ-કાપલી · APMC-9')).toBeInTheDocument();
    unmount();
    render(<DetailModal detail={{ kind: 'passprint', data: { passNumber: 'GP-5', status: 'issued', lot: {} } }} user={{}} onClose={() => {}}/>);
    expect(screen.getByText('ગેટ પાસ · GP-5')).toBeInTheDocument();
  });
  it('close and print buttons work', async () => {
    window.print = vi.fn(); const onClose = vi.fn();
    render(<DetailModal detail={{ kind: 'ticket', data: ticket }} user={{}} onClose={onClose}/>);
    await userEvent.click(screen.getByText('બંધ કરો', { selector: 'button.btn' }));
    expect(onClose).toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: /^પ્રિન્ટ$/ }));
    expect(window.print).toHaveBeenCalled();
  });
});
