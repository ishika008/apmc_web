import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsScreen } from './SettingsScreen.jsx';
import { mockFetch } from '../../test/mockFetch.js';
import { translateServerMessage } from '../../i18n/index.js';

afterEach(() => vi.unstubAllGlobals());
const item = { committeeName: 'Surat APMC', yardCode: 'APMC-01', timezone: 'Asia/Kolkata', ticketPrefix: 'APMC', billPrefix: 'SB', passPrefix: 'GP', complaintPrefix: 'CMP', farmerPaymentDays: 1, dispatchDays: 2, defaultBuyerCreditDays: 5, sellerApprovedDeduction: 0, buyerMarketFee: 0, buyerOtherDues: 0, commodities: ['ઘઉં', 'કપાસ'] };
const base = (o = {}) => ({ 'GET /yard/settings': { item }, 'GET /yard/buyers?limit=100': { items: [{ _id: 'b1', name: 'Patel', registrationNo: 'TR-1', creditDays: 3, purchaseLimit: 5000, active: true }, { _id: 'b2', name: 'Open', creditDays: 5, purchaseLimit: 0, active: false }] }, ...o });

describe('SettingsScreen', () => {
  it('shows loading then the form populated from the server', async () => {
    mockFetch(base());
    render(<SettingsScreen notify={() => {}}/>);
    expect(screen.getByText(/સેટિંગ્સ લાવી રહ્યા/)).toBeInTheDocument();
    expect(await screen.findByDisplayValue('Surat APMC')).toBeInTheDocument();
    expect(screen.getByLabelText('દરેક લીટીમાં એક પાકનું નામ')).toHaveValue('ઘઉં\nકપાસ');
    expect(screen.getByDisplayValue('APMC-01')).toBeInTheDocument();
  });
  it('lists buyers with limit / not-set / active flags', async () => {
    mockFetch(base());
    render(<SettingsScreen notify={() => {}}/>);
    expect(await screen.findByText('Patel')).toBeInTheDocument();
    expect(screen.getByText('₹5,000.00')).toBeInTheDocument();
    expect(screen.getByText('ખુલ્લી / નક્કી નથી')).toBeInTheDocument();
    expect(screen.getByText('3 દિવસ')).toBeInTheDocument();
  });
  it('shows an empty buyer table', async () => {
    mockFetch(base({ 'GET /yard/buyers?limit=100': { items: [] } }));
    render(<SettingsScreen notify={() => {}}/>);
    expect(await screen.findByText('કોઈ વેપારી નોંધાયો નથી.')).toBeInTheDocument();
  });
  it('shows a load error without crashing', async () => {
    mockFetch(base({ 'GET /yard/settings': { status: 500, body: { message: 'cannot load' } } }));
    render(<SettingsScreen notify={() => {}}/>);
    expect(await screen.findByText('cannot load')).toBeInTheDocument();
    expect(screen.queryByText('ગોઠવણી સાચવો')).toBeNull();
  });
  it('saves edited values with numeric coercion and a parsed commodity list, then reloads and notifies', async () => {
    const f = mockFetch(base({ 'PATCH /yard/settings': { item } }));
    const notify = vi.fn();
    render(<SettingsScreen notify={notify}/>);
    const days = await screen.findByLabelText('ખેડૂત ચુકવણીના દિવસો');
    await userEvent.clear(days); await userEvent.type(days, '4');
    const ta = screen.getByLabelText('દરેક લીટીમાં એક પાકનું નામ');
    await userEvent.clear(ta); await userEvent.type(ta, 'ઘઉં,  જીરું{enter}{enter}મગફળી');
    await userEvent.click(screen.getByRole('button', { name: /ગોઠવણી સાચવો/ }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith('યાર્ડ સેટિંગ્સ સાચવાઈ.'));
    const patch = f.calls.find(c => c.method === 'PATCH');
    expect(patch.body.farmerPaymentDays).toBe(4);
    expect(typeof patch.body.buyerMarketFee).toBe('number');
    expect(patch.body.commodities).toEqual(['ઘઉં', 'જીરું', 'મગફળી']);
    expect(f.calls.filter(c => c.method === 'GET' && c.path === '/yard/settings')).toHaveLength(2);
  });
  it('shows server validation errors on save and does not notify success', async () => {
    mockFetch(base({ 'PATCH /yard/settings': { status: 400, body: { message: 'At least one valid commodity is required' } } }));
    const notify = vi.fn();
    render(<SettingsScreen notify={notify}/>);
    await screen.findByDisplayValue('Surat APMC');
    await userEvent.click(screen.getByRole('button', { name: /ગોઠવણી સાચવો/ }));
    expect(await screen.findByText(translateServerMessage('At least one valid commodity is required'))).toBeInTheDocument();
    expect(notify).not.toHaveBeenCalled();
  });
  it('navigates to the buyer ledger', async () => {
    mockFetch(base());
    const onNavigate = vi.fn();
    render(<SettingsScreen notify={() => {}} onNavigate={onNavigate}/>);
    await userEvent.click(await screen.findByRole('button', { name: /વેપારી ખાતું અને ક્રેડિટ/ }));
    expect(onNavigate).toHaveBeenCalledWith('buyerledger');
  });
  it('refresh reloads the settings', async () => {
    const f = mockFetch(base());
    render(<SettingsScreen notify={() => {}}/>);
    await screen.findByDisplayValue('Surat APMC');
    await userEvent.click(screen.getByRole('button', { name: /રિફ્રેશ/ }));
    await waitFor(() => expect(f.calls.filter(c => c.path === '/yard/settings')).toHaveLength(2));
  });
});
