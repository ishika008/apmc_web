import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, waitFor, within, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Workspace } from './Workspace.jsx';
import { navigation } from '../constants/navigation.js';
import { mockFetch } from '../test/mockFetch.js';
import { translateServerMessage } from '../i18n/index.js';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
const u = (role, name = 'Asha Patel') => ({ id: 'u1', name, role });
const counts = { openComplaints: 2, auctionQueue: 3, farmerOverdue: 1, buyerOverdue: 0, dispatchOverdue: 4 };
const routes = (o = {}) => new Proxy({
  'GET /yard/nav-counts': counts, 'GET /yard/settings': { item: { committeeName: 'Surat APMC', commodities: [] } },
  'GET /yard/overview': { stats: {} }, 'GET /yard/lots?limit=6': { items: [] },
  'GET /yard/dashboard': { status: { auctionPending: 0, passesIssued: 0, dispatched: 0, inYard: 0, quintalsInside: 0 }, stock: [], farmerDues: [], traderDues: [], farmerTotals: { payable: 0, paid: 0, due: 0, provisional: 0 }, arrivalsByHour: [], activity: [] },
  'GET /yard/audit?page=1&limit=25': { items: [], total: 0 }, 'GET /yard/lots?page=1&limit=25': { items: [], total: 0 },
  ...o }, {});
const navButtons = () => within(document.querySelector('.side-nav')).getAllByRole('button').map(b => b.querySelector('b').textContent);

describe('Workspace', () => {
  it.each(['admin', 'gate', 'auction', 'weighment', 'accounts', 'inspector'])('shows only the modules %s may access', async role => {
    mockFetch(routes());
    render(<Workspace user={u(role)} onLogout={() => {}} notify={() => {}}/>);
    const expected = navigation.filter(n => n.roles.includes(role)).map(n => n.label);
    expect(navButtons()).toEqual(expected);
    await screen.findByText('Surat APMC');
  });
  it('shows user identity, role label, avatar initial and the yard name', async () => {
    mockFetch(routes());
    render(<Workspace user={u('accounts')} onLogout={() => {}} notify={() => {}}/>);
    expect(screen.getAllByText('Asha Patel').length).toBeGreaterThan(0);
    expect(screen.getAllByText('હિસાબી અધિકારી').length).toBeGreaterThan(0);
    expect(screen.getAllByText('A', { selector: '.user-avatar' }).length).toBeGreaterThan(0);
    expect(await screen.findByText('Surat APMC')).toBeInTheDocument();
    expect(document.querySelector('.yard-select small').textContent).toBe('માર્કેટ યાર્ડ');
  });
  it('falls back to a generic yard tag when settings fail', async () => {
    mockFetch(routes({ 'GET /yard/settings': { status: 500, body: { message: 'x' } } }));
    render(<Workspace user={u('admin')} onLogout={() => {}} notify={() => {}}/>);
    expect(await screen.findByText('APMC યાર્ડ')).toBeInTheDocument();
  });
  it('navigates between modules and updates the breadcrumb', async () => {
    mockFetch(routes());
    render(<Workspace user={u('admin')} onLogout={() => {}} notify={() => {}}/>);
    expect(document.querySelector('.breadcrumb b').textContent).toBe('ડેશબોર્ડ');
    await userEvent.click(screen.getByRole('button', { name: /ઓડિટ ટ્રેલ/ }));
    expect(document.querySelector('.breadcrumb b').textContent).toBe('ઓડિટ ટ્રેલ');
    expect(await screen.findByText('ઓડિટ ટ્રેલ અને પ્રવૃત્તિ લોગ', { selector: 'h1' })).toBeInTheDocument();
  });
  it('shows nav badges for the auction queue and open complaints', async () => {
    mockFetch(routes());
    render(<Workspace user={u('admin')} onLogout={() => {}} notify={() => {}}/>);
    const auction = screen.getByRole('button', { name: /હરાજી \/ ભાવ-કાપલી/ });
    await waitFor(() => expect(within(auction).getByText('3')).toHaveClass('nav-badge'));
    expect(within(screen.getByRole('button', { name: /ફરિયાદ \/ વિવાદ/ })).getByText('2')).toBeInTheDocument();
  });
  it('bell lists only non-zero reminders and navigates to the relevant module', async () => {
    mockFetch(routes());
    render(<Workspace user={u('admin')} onLogout={() => {}} notify={() => {}}/>);
    await waitFor(() => expect(document.querySelector('.bell-dot')).not.toBeNull());
    await userEvent.click(screen.getByRole('button', { name: 'રિમાઇન્ડર' }));
    const menu = screen.getByRole('menu');
    expect(within(menu).getByText('ખુલ્લી ફરિયાદો (તપાસ બાકી)')).toBeInTheDocument();
    expect(within(menu).getByText('માલ નિકાલની સમયમર્યાદા વટાવી')).toBeInTheDocument();
    expect(within(menu).queryByText('વેપારીની ક્રેડિટ મુદત વટાવી')).toBeNull();
    await userEvent.click(within(menu).getByText('માલ નિકાલની સમયમર્યાદા વટાવી'));
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.querySelector('.breadcrumb b').textContent).toBe('ગેટ પાસ / નિકાલ');
  });
  it('bell shows an empty message and no dot when nothing is pending', async () => {
    mockFetch(routes({ 'GET /yard/nav-counts': { openComplaints: 0, auctionQueue: 0, farmerOverdue: 0, buyerOverdue: 0, dispatchOverdue: 0 } }));
    render(<Workspace user={u('admin')} onLogout={() => {}} notify={() => {}}/>);
    await userEvent.click(screen.getByRole('button', { name: 'રિમાઇન્ડર' }));
    expect(screen.getByText('કોઈ બાકી રિમાઇન્ડર નથી.')).toBeInTheDocument();
    expect(document.querySelector('.bell-dot')).toBeNull();
  });
  it('survives a failing nav-counts request', async () => {
    mockFetch(routes({ 'GET /yard/nav-counts': { status: 500, body: { message: 'x' } } }));
    render(<Workspace user={u('admin')} onLogout={() => {}} notify={() => {}}/>);
    await userEvent.click(screen.getByRole('button', { name: 'રિમાઇન્ડર' }));
    expect(screen.getByText('કોઈ બાકી રિમાઇન્ડર નથી.')).toBeInTheDocument();
  });
  it('polls nav counts every 60 seconds', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const f = mockFetch(routes());
    render(<Workspace user={u('admin')} onLogout={() => {}} notify={() => {}}/>);
    await waitFor(() => expect(f.calls.filter(c => c.path === '/yard/nav-counts').length).toBe(1));
    await act(async () => { await vi.advanceTimersByTimeAsync(60000); });
    expect(f.calls.filter(c => c.path === '/yard/nav-counts').length).toBe(2);
  });
  it('sign out buttons call onLogout', async () => {
    mockFetch(routes());
    const onLogout = vi.fn();
    render(<Workspace user={u('admin')} onLogout={onLogout} notify={() => {}}/>);
    await userEvent.click(document.querySelector('.logout-btn'));
    await userEvent.click(screen.getByTitle('સાઇન આઉટ'));
    expect(onLogout).toHaveBeenCalledTimes(2);
  });
  it('mobile menu opens and closes via overlay', async () => {
    mockFetch(routes());
    const { container } = render(<Workspace user={u('admin')} onLogout={() => {}} notify={() => {}}/>);
    expect(container.querySelector('.sidebar-open')).toBeNull();
    fireEvent.click(container.querySelector('.mobile-trigger'));
    expect(container.querySelector('.sidebar.sidebar-open')).not.toBeNull();
    await userEvent.click(screen.getByLabelText('મેનુ બંધ કરો'));
    expect(container.querySelector('.sidebar-open')).toBeNull();
  });
  it('global search ignores terms shorter than 2 chars, opens results otherwise, and Escape clears', async () => {
    const f = mockFetch(routes({ 'GET /yard/search?q=ra': { lots: [{ _id: 'l1', lotNumber: 'LOT-1', farmerName: 'Ramesh', commodity: 'ઘઉં', status: 'arrived' }], tickets: [] } }));
    render(<Workspace user={u('admin')} onLogout={() => {}} notify={() => {}}/>);
    const box = screen.getByLabelText('સર્વત્ર શોધ');
    await userEvent.type(box, 'r{enter}');
    expect(f.calls.some(c => c.path.startsWith('/yard/search'))).toBe(false);
    await userEvent.type(box, 'a{enter}');
    expect(await screen.findByText('શોધ પરિણામો · ra')).toBeInTheDocument();
    expect(await screen.findByText('LOT-1')).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('બંધ કરો'));
    await userEvent.type(box, '{Escape}');
    expect(box).toHaveValue('');
  });
  it('Ctrl/Cmd+K focuses the search box', async () => {
    mockFetch(routes());
    render(<Workspace user={u('admin')} onLogout={() => {}} notify={() => {}}/>);
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(screen.getByLabelText('સર્વત્ર શોધ')).toHaveFocus();
  });
  it('opens a lot from search results, and reports lot load errors', async () => {
    const lotRoutes = (lotResp) => routes({ 'GET /yard/search?q=ra': { lots: [{ _id: 'l1', lotNumber: 'LOT-1', farmerName: 'Ramesh', commodity: 'ઘઉં', status: 'arrived' }], tickets: [] }, 'GET /yard/lots/l1': lotResp });
    mockFetch(lotRoutes({ item: { lotNumber: 'LOT-1', farmerName: 'Ramesh', commodity: 'ઘઉં', bags: 1, status: 'arrived' }, weighments: [] }));
    const notify = vi.fn();
    const { unmount } = render(<Workspace user={u('admin')} onLogout={() => {}} notify={notify}/>);
    await userEvent.type(screen.getByLabelText('સર્વત્ર શોધ'), 'ra{enter}');
    await userEvent.click(await screen.findByRole('button', { name: 'ખોલો' }));
    expect(await screen.findByText('લોટનો સંપૂર્ણ ઇતિહાસ · LOT-1')).toBeInTheDocument();
    unmount();
    mockFetch(lotRoutes({ status: 404, body: { message: 'Lot not found' } }));
    render(<Workspace user={u('admin')} onLogout={() => {}} notify={notify}/>);
    await userEvent.type(screen.getByLabelText('સર્વત્ર શોધ'), 'ra{enter}');
    await userEvent.click(await screen.findByRole('button', { name: 'ખોલો' }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith(translateServerMessage('Lot not found'), 'error'));
  });
  it('opens a ticket from search and lets an admin void it, refreshing counts', async () => {
    const ticket = { _id: 't1', ticketNumber: 'APMC-1', quantity: 5, rate: 100, createdAt: '2026-03-05T10:00:00Z', lot: { farmerName: 'R', commodity: 'ઘઉં', lotNumber: 'LOT-1' }, buyer: { name: 'P' } };
    const f = mockFetch(routes({ 'GET /yard/search?q=ap': { lots: [], tickets: [ticket] }, 'POST /yard/tickets/t1/void': { item: {} } }));
    vi.spyOn(window, 'prompt').mockReturnValue('rate typed wrongly');
    const notify = vi.fn();
    render(<Workspace user={u('admin')} onLogout={() => {}} notify={notify}/>);
    await userEvent.type(screen.getByLabelText('સર્વત્ર શોધ'), 'ap{enter}');
    await userEvent.click(await screen.findByRole('button', { name: 'કાપલી' }));
    expect(await screen.findByText('હરાજી ટિકિટ · APMC-1')).toBeInTheDocument();
    const before = f.calls.filter(c => c.path === '/yard/nav-counts').length;
    await userEvent.click(screen.getByRole('button', { name: 'ટિકિટ રદ કરો' }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith('ટિકિટ રદ થઈ ગઈ.'));
    expect(f.calls.find(c => c.path === '/yard/tickets/t1/void').body).toEqual({ reason: 'rate typed wrongly' });
    await waitFor(() => expect(f.calls.filter(c => c.path === '/yard/nav-counts').length).toBeGreaterThan(before));
    expect(screen.queryByText('હરાજી ટિકિટ · APMC-1')).toBeNull();
  });
});
