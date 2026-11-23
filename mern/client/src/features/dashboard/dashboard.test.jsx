import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Dashboard } from './Dashboard.jsx';
import { YardLive } from './YardLive.jsx';
import { mockFetch } from '../../test/mockFetch.js';

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

const stats = { totalLots: 12, arrived: 3, totalTickets: 7, dispatched: 2, farmerDue: 5000, traderDue: 12000, openComplaints: 1, activeBuyers: 4, farmerPayable: 20000, farmerPaid: 15000, buyerDues: 300, buyerDuesPaid: 100 };
const live = (over = {}) => ({
  status: { auctionPending: 3, passesIssued: 2, dispatched: 1, inYard: 5, quintalsInside: 42.5 },
  stock: [{ _id: 's1', lotNumber: 'LOT-9', farmerName: 'Ramesh', sellerType: 'farmer', village: 'Kamrej', commodity: 'ઘઉં', netWeight: 10, vehicle: 'GJ05', status: 'weighed', buyerId: { name: 'Patel' }, dispatchDueAt: '2099-01-01T00:00:00Z' },
    { _id: 's2', lotNumber: 'LOT-10', farmerName: 'Trade Co', sellerType: 'trader', commodity: 'કપાસ', estimated: 7, status: 'arrived' }],
  farmerDues: [{ kind: 'provisional', farmer: 'Ramesh', reference: 'APMC-1', payable: 37500, paid: 0, balance: 37500, dueAt: '2000-01-01T00:00:00Z' },
    { kind: 'bill', farmer: 'Suresh', reference: 'SB-1', payable: 1000, paid: 400, balance: 600, dueAt: '2099-01-01T00:00:00Z' }],
  traderDues: [{ buyerId: 'b1', name: 'Patel Agro', registrationNo: 'TR-1', creditDays: 3, paid: 0, due: 37500, overdue: true }, { buyerId: 'b2', name: 'No Reg', creditDays: 5, paid: 0, due: 1, overdue: false }],
  farmerTotals: { payable: 38500, paid: 400, due: 38100, provisional: 37500 },
  arrivalsByHour: Array.from({ length: 24 }, (_, hour) => ({ hour, lots: hour === 9 ? 4 : 0 })),
  activity: [{ _id: 'a1', action: 'GATE_ENTRY_CREATED', actorName: 'Gate', resourceId: 'r1', createdAt: '2026-03-05T10:00:00Z' }],
  ...over
});
const routes = (over = {}) => ({
  'GET /yard/overview': { stats }, 'GET /yard/lots?limit=6': { items: [{ _id: 'l1', lotNumber: 'LOT-1', farmerName: 'Ramesh', sellerType: 'farmer', commodity: 'ઘઉં', bags: 5, vehicle: 'GJ', village: 'V', status: 'arrived', arrivalAt: '2026-03-05T10:00:00Z' }] },
  'GET /yard/dashboard': live(), ...over
});

describe('Dashboard', () => {
  it('shows loading then the metrics, greeting by first name and role pill', async () => {
    mockFetch(routes());
    render(<Dashboard user={{ name: 'Asha Patel', role: 'accounts' }} onNavigate={() => {}}/>);
    expect(screen.getByText(/ડેશબોર્ડ ડેટા/)).toBeInTheDocument();
    expect(await screen.findByText('નમસ્કાર, Asha')).toBeInTheDocument();
    expect(screen.getByText('હિસાબી અધિકારી')).toBeInTheDocument();
    expect(screen.getAllByText('₹5,000.00').length).toBeGreaterThan(0);
    expect(screen.getAllByText('₹12,000.00').length).toBeGreaterThan(0);
    expect(screen.getByText('₹12,000.00', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getByText('₹200.00')).toBeInTheDocument(); // buyer dues pending
    expect(screen.getByText('LOT-1')).toBeInTheDocument();
    expect(screen.getByText('આવક નોંધાઈ')).toBeInTheDocument(); // status rendered as a label, not a date
  });
  it('shows the API error', async () => {
    mockFetch(routes({ 'GET /yard/overview': { status: 500, body: { message: 'DB down' } } }));
    render(<Dashboard user={{ name: 'A', role: 'admin' }} onNavigate={() => {}}/>);
    expect(await screen.findByText('DB down')).toBeInTheDocument();
  });
  it('quick actions are role-based and navigate', async () => {
    mockFetch(routes());
    const onNavigate = vi.fn();
    render(<Dashboard user={{ name: 'G', role: 'gate' }} onNavigate={onNavigate}/>);
    await screen.findByText('ઝડપી કામગીરી');
    const qa = document.querySelector('.quick-actions');
    expect(within(qa).queryByText('ચુકવણી અને હિસાબ')).toBeNull();
    await userEvent.click(within(qa).getByText('ગેટ એન્ટ્રી'));
    expect(onNavigate).toHaveBeenCalledWith('gate');
    expect(qa.querySelectorAll('button').length).toBeLessThanOrEqual(6);
  });
  it('navigation shortcuts and refresh work', async () => {
    const f = mockFetch(routes());
    const onNavigate = vi.fn();
    render(<Dashboard user={{ name: 'A', role: 'admin' }} onNavigate={onNavigate}/>);
    await screen.findByText('નાણાકીય સારાંશ');
    await userEvent.click(screen.getByText(/ચુકવણી ખાતું ખોલો/));
    expect(onNavigate).toHaveBeenCalledWith('payments');
    await userEvent.click(screen.getByText(/બધા જુઓ/));
    expect(onNavigate).toHaveBeenCalledWith('gate');
    const before = f.calls.length;
    await userEvent.click(screen.getByRole('button', { name: /રિફ્રેશ/ }));
    await vi.waitFor(() => expect(f.calls.length).toBe(before + 3));
  });
  it('clamps buyer dues at zero when overpaid', async () => {
    mockFetch(routes({ 'GET /yard/overview': { stats: { ...stats, buyerDues: 100, buyerDuesPaid: 500 } } }));
    render(<Dashboard user={{ name: 'A', role: 'admin' }} onNavigate={() => {}}/>);
    const row = (await screen.findByText('ખરીદદાર-પક્ષની બાકી લેણી રકમ')).parentElement;
    expect(within(row).getByText('₹0.00')).toBeInTheDocument();
  });
});

describe('YardLive', () => {
  it('renders status cards, stock, dues, activity and the arrivals chart', () => {
    const onNavigate = vi.fn();
    render(<YardLive live={live()} onNavigate={onNavigate}/>);
    expect(screen.getByText('3 લોટ')).toBeInTheDocument();
    expect(screen.getByText('2 પાસ')).toBeInTheDocument();
    expect(screen.getByText('42.5 ક્વિન્ટલ અંદર')).toBeInTheDocument();
    expect(screen.getByText('LOT-9')).toBeInTheDocument();
    expect(screen.getByText('10 Q')).toBeInTheDocument();
    expect(screen.getByText('7 Q')).toBeInTheDocument(); // estimated fallback
    expect(screen.getByText('Patel')).toBeInTheDocument();
    expect(screen.getByText('હરાજી બાકી', { selector: 'td' })).toBeInTheDocument();
    expect(screen.getByText('કામચલાઉ · વજન બાકી')).toBeInTheDocument();
    expect(screen.getByText('ક્રેડિટ મુદત વટાવી')).toBeInTheDocument();
    expect(screen.getByText('વસૂલાત બાકી')).toBeInTheDocument();
    expect(screen.getByText('નોંધણી ID બાકી')).toBeInTheDocument();
    expect(screen.getByText('ગેટ એન્ટ્રી નોંધાઈ')).toBeInTheDocument();
    const svg = screen.getByRole('img', { name: /આજની કલાક પ્રમાણે આવક/ });
    expect(svg.querySelectorAll('rect')).toHaveLength(17); // hours 5..21
    expect(within(svg).getByText('4')).toBeInTheDocument();
    expect(screen.getByText('મર્યાદા વટાવી')).toBeInTheDocument();
  });
  it('shows empty states and the no-activity notice for restricted roles', () => {
    render(<YardLive live={live({ stock: [], farmerDues: [], traderDues: [], activity: [] })} onNavigate={() => {}}/>);
    expect(screen.getByText('યાર્ડમાં કોઈ સ્ટોક નથી')).toBeInTheDocument();
    expect(screen.getByText('ખેડૂતની કોઈ ચુકવણી બાકી નથી.')).toBeInTheDocument();
    expect(screen.getByText('વેપારીની ખરીદ ચુકવણી બાકી નથી.')).toBeInTheDocument();
    expect(screen.getByText('આ ભૂમિકા માટે પ્રવૃત્તિ ફીડ ઉપલબ્ધ નથી')).toBeInTheDocument();
  });
  it('draws a flat chart (no NaN) when there are no arrivals', () => {
    const { container } = render(<YardLive live={live({ arrivalsByHour: Array.from({ length: 24 }, (_, hour) => ({ hour, lots: 0 })) })} onNavigate={() => {}}/>);
    expect(container.innerHTML).not.toContain('NaN');
  });
  it('payment and ledger links navigate', async () => {
    const onNavigate = vi.fn();
    render(<YardLive live={live()} onNavigate={onNavigate}/>);
    await userEvent.click(screen.getByText('ચુકવણી ખોલો'));
    await userEvent.click(screen.getByText('વેપારી ખાતું'));
    expect(onNavigate.mock.calls.map(c => c[0])).toEqual(['payments', 'buyerledger']);
  });
});
