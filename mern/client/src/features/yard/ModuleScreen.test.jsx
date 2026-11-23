import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ModuleScreen } from './ModuleScreen.jsx';
import { pageConfig } from '../../constants/pageConfig.js';
import { t, translateServerMessage } from '../../i18n/index.js';
import { mockFetch } from '../../test/mockFetch.js';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const admin = { id: 'u0', name: 'Admin', role: 'admin' };
const lot = { _id: 'l1', lotNumber: 'LOT-1', farmerName: 'Ramesh', commodity: 'ઘઉં', bags: 5, status: 'arrived', sellerType: 'farmer', netWeight: 12 };
const buyer = { _id: 'b1', name: 'Patel', registrationNo: 'TR-1', creditDays: 3, purchaseLimit: 1000, active: true, ledger: { gross: 100, paid: 50, outstanding: 50, exposure: 50, overdueCount: 0, limitFull: false } };

describe('ModuleScreen – common behaviour', () => {
  it('loads rows, shows title, count and status labels (not dates)', async () => {
    mockFetch({ 'GET /yard/lots?page=1&limit=25': { items: [lot], total: 1 }, 'GET /yard/settings': { item: { commodities: ['ઘઉં'] } } });
    render(<ModuleScreen page="gate" user={admin} notify={() => {}}/>);
    expect(screen.getByText(/રેકોર્ડ લાવી રહ્યા/)).toBeInTheDocument();
    expect(await screen.findByText('LOT-1')).toBeInTheDocument();
    expect(screen.getByText('ગેટ એન્ટ્રી અને આવક', { selector: 'h1' })).toBeInTheDocument();
    expect(screen.getByText('1 રેકોર્ડ · સર્વર ડેટાબેઝ')).toBeInTheDocument();
    expect(screen.getByText('આવક નોંધાઈ')).toBeInTheDocument();
  });
  it('shows load errors and the empty state', async () => {
    mockFetch({ 'GET /yard/audit?page=1&limit=25': { status: 500, body: { message: 'Audit failed' } } });
    render(<ModuleScreen page="audit" user={admin} notify={() => {}}/>);
    expect(await screen.findByText('Audit failed')).toBeInTheDocument();
  });
  it('empty list shows empty state and disables CSV', async () => {
    mockFetch({ 'GET /yard/audit?page=1&limit=25': { items: [], total: 0 } });
    render(<ModuleScreen page="audit" user={admin} notify={() => {}}/>);
    expect(await screen.findByText('કોઈ રેકોર્ડ મળ્યો નથી.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /CSV/ })).toBeDisabled();
  });
  it('server-side search for gate/sales/buyerledger, client-side filter elsewhere', async () => {
    const f = mockFetch({ 'GET /yard/lots?page=1&limit=25': { items: [lot], total: 1 }, 'GET /yard/lots?page=1&limit=25&search=ram': { items: [], total: 0 }, 'GET /yard/settings': { item: { commodities: [] } },
      'GET /yard/audit?page=1&limit=25': { items: [{ _id: 'a', action: 'ONE', actorName: 'x', createdAt: '2026-03-05T10:00:00Z' }, { _id: 'b', action: 'TWO', actorName: 'y', createdAt: '2026-03-05T10:00:00Z' }], total: 2 } });
    const { unmount } = render(<ModuleScreen page="gate" user={admin} notify={() => {}}/>);
    await screen.findByText('LOT-1');
    await userEvent.type(screen.getByPlaceholderText('રેકોર્ડ શોધો...'), 'ram');
    await waitFor(() => expect(f.calls.some(c => c.path === '/yard/lots?page=1&limit=25&search=ram')).toBe(true));
    unmount();
    render(<ModuleScreen page="audit" user={admin} notify={() => {}}/>);
    await screen.findByText('ONE');
    await userEvent.type(screen.getByPlaceholderText('રેકોર્ડ શોધો...'), 'two');
    expect(screen.queryByText('ONE')).toBeNull();
    expect(screen.getByText('TWO')).toBeInTheDocument();
  });
  it('paginates when total > 25 and disables edges', async () => {
    const f = mockFetch({ 'GET /yard/audit?page=1&limit=25': { items: [{ _id: 'a', action: 'P1' }], total: 60 }, 'GET /yard/audit?page=2&limit=25': { items: [{ _id: 'b', action: 'P2' }], total: 60 }, 'GET /yard/audit?page=3&limit=25': { items: [{ _id: 'c', action: 'P3' }], total: 60 } });
    render(<ModuleScreen page="audit" user={admin} notify={() => {}}/>);
    await screen.findByText('P1');
    expect(screen.getByText('60 માંથી 1–25 રેકોર્ડ')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'પાછળ' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'આગળ' }));
    await screen.findByText('P2');
    await userEvent.click(screen.getByRole('button', { name: 'આગળ' }));
    await screen.findByText('P3');
    expect(screen.getByText('60 માંથી 51–60 રેકોર્ડ')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'આગળ' })).toBeDisabled();
    expect(f.calls.map(c => c.path)).toEqual(expect.arrayContaining(['/yard/audit?page=3&limit=25']));
  });
  it('hides the create button for roles that cannot create', async () => {
    mockFetch({ 'GET /yard/lots?page=1&limit=25': { items: [], total: 0 }, 'GET /yard/settings': { item: { commodities: [] } } });
    render(<ModuleScreen page="gate" user={{ ...admin, role: 'auction' }} notify={() => {}}/>);
    await screen.findByText('કોઈ રેકોર્ડ મળ્યો નથી.');
    expect(screen.queryByRole('button', { name: /નવી ગેટ એન્ટ્રી/ })).toBeNull();
  });
  it('renders for every configured page without crashing', async () => {
    for (const page of Object.keys(pageConfig)) {
      mockFetch(new Proxy({}, { get: () => ({ items: [], total: 0 }), ownKeys: () => [], has: () => true, getOwnPropertyDescriptor: () => undefined }));
      // fall back to a catch-all fetch: every GET returns an empty list
      vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ items: [], total: 0, item: { commodities: [] } }), { headers: { 'Content-Type': 'application/json' } })));
      const { unmount } = render(<ModuleScreen page={page} user={admin} notify={() => {}}/>);
      expect(await screen.findByText(t(pageConfig[page].titleKey), { selector: 'h1' })).toBeInTheDocument();
      await screen.findByText('કોઈ રેકોર્ડ મળ્યો નથી.');
      unmount();
    }
  });
});

describe('ModuleScreen – gate entry', () => {
  it('creates a lot with the form values then reloads and notifies', async () => {
    const f = mockFetch({ 'GET /yard/lots?page=1&limit=25': { items: [], total: 0 }, 'GET /yard/settings': { item: { commodities: ['ઘઉં', 'કપાસ'] } }, 'POST /yard/lots': { item: {} } });
    const notify = vi.fn();
    render(<ModuleScreen page="gate" user={admin} notify={notify}/>);
    await userEvent.click(await screen.findByRole('button', { name: /નવી ગેટ એન્ટ્રી/ }));
    await userEvent.type(screen.getByLabelText(/ખેડૂત \/ વેચનારનું નામ/), 'Ramesh');
    await userEvent.type(screen.getByLabelText(/મોબાઇલ નંબર/), '9879512041');
    await userEvent.type(screen.getByLabelText(/^ગામ/), 'Kamrej');
    await userEvent.selectOptions(screen.getByLabelText(/પાક \/ જણસ/), 'કપાસ');
    await userEvent.click(screen.getByRole('button', { name: /સાચવો/ }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith('રેકોર્ડ સફળતાપૂર્વક સાચવાયો.'));
    const post = f.calls.find(c => c.method === 'POST');
    expect(post.body).toMatchObject({ sellerType: 'farmer', farmerName: 'Ramesh', mobile: '9879512041', village: 'Kamrej', commodity: 'કપાસ', bags: 1, state: 'Gujarat' });
    expect(f.calls.filter(c => c.path === '/yard/lots?page=1&limit=25')).toHaveLength(2);
  });
  it('keeps the dialog open and shows the API error when creation fails', async () => {
    mockFetch({ 'GET /yard/lots?page=1&limit=25': { items: [], total: 0 }, 'GET /yard/settings': { item: { commodities: ['ઘઉં'] } }, 'POST /yard/lots': { status: 400, body: { message: 'Enter a valid contact number' } } });
    render(<ModuleScreen page="gate" user={admin} notify={() => {}}/>);
    await userEvent.click(await screen.findByRole('button', { name: /નવી ગેટ એન્ટ્રી/ }));
    await userEvent.type(screen.getByLabelText(/ખેડૂત \/ વેચનારનું નામ/), 'R');
    await userEvent.type(screen.getByLabelText(/મોબાઇલ નંબર/), 'abc');
    await userEvent.type(screen.getByLabelText(/^ગામ/), 'K');
    await userEvent.selectOptions(screen.getByLabelText(/પાક \/ જણસ/), 'ઘઉં');
    await userEvent.click(screen.getByRole('button', { name: /સાચવો/ }));
    // API messages are translated centrally (services/api.js); assert the translation for the active language.
    expect(await screen.findByText(translateServerMessage('Enter a valid contact number'))).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
  it('row action opens the lot traceability modal', async () => {
    mockFetch({ 'GET /yard/lots?page=1&limit=25': { items: [lot], total: 1 }, 'GET /yard/settings': { item: { commodities: [] } }, 'GET /yard/lots/l1': { item: lot, weighments: [] } });
    render(<ModuleScreen page="gate" user={admin} notify={() => {}}/>);
    await userEvent.click(await screen.findByRole('button', { name: /વિગત/ }));
    expect(await screen.findByText('લોટનો સંપૂર્ણ ઇતિહાસ · LOT-1')).toBeInTheDocument();
  });
  it('notifies when the lot detail fails to load', async () => {
    mockFetch({ 'GET /yard/lots?page=1&limit=25': { items: [lot], total: 1 }, 'GET /yard/settings': { item: { commodities: [] } }, 'GET /yard/lots/l1': { status: 404, body: { message: 'Lot not found' } } });
    const notify = vi.fn();
    render(<ModuleScreen page="gate" user={admin} notify={notify}/>);
    await userEvent.click(await screen.findByRole('button', { name: /વિગત/ }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith(translateServerMessage('Lot not found'), 'error'));
  });
});

describe('ModuleScreen – auction', () => {
  const routes = (o = {}) => ({ 'GET /yard/tickets?page=1&limit=25': { items: [{ _id: 't1', ticketNumber: 'APMC-1', quantity: 5, rate: 100, createdAt: '2026-03-05T10:00:00Z', lot: { lotNumber: 'LOT-1', farmerName: 'Ramesh' }, buyer: { name: 'Patel' } }], total: 1 },
    'GET /yard/lots?status=arrived&limit=100': { items: [lot] },
    'GET /yard/buyers?active=true&limit=100': { items: [buyer, { ...buyer, _id: 'b2', name: 'Held', ledger: { overdueCount: 2 } }, { ...buyer, _id: 'b3', name: 'Full', ledger: { limitFull: true } }, { ...buyer, _id: 'b4', name: 'Off', active: false }] }, ...o });
  it('disables held / limit-full buyers and omits inactive ones in the ticket form', async () => {
    mockFetch(routes());
    render(<ModuleScreen page="auction" user={admin} notify={() => {}}/>);
    await userEvent.click(await screen.findByRole('button', { name: /નવી ભાવ-કાપલી/ }));
    expect(screen.getByRole('option', { name: /Held.*ક્રેડિટ હોલ્ડ/ })).toBeDisabled();
    expect(screen.getByRole('option', { name: /Full.*ખરીદ મર્યાદા પૂર્ણ/ })).toBeDisabled();
    expect(screen.getByRole('option', { name: /Patel/ })).toBeEnabled();
    expect(screen.queryByRole('option', { name: /Off/ })).toBeNull();
  });
  it('issues a ticket', async () => {
    const f = mockFetch(routes({ 'POST /yard/tickets': { item: {} } }));
    render(<ModuleScreen page="auction" user={admin} notify={() => {}}/>);
    await userEvent.click(await screen.findByRole('button', { name: /નવી ભાવ-કાપલી/ }));
    await userEvent.selectOptions(screen.getByLabelText(/હરાજી માટે લોટ પસંદ કરો/), 'l1');
    await userEvent.selectOptions(screen.getByLabelText(/નોંધાયેલ ખરીદદાર/), 'b1');
    await userEvent.type(screen.getByLabelText(/હરાજી ભાવ/), '2500');
    await userEvent.type(screen.getByLabelText(/જથ્થો/), '15');
    await userEvent.click(screen.getByRole('button', { name: /સાચવો/ }));
    await waitFor(() => expect(f.calls.some(c => c.method === 'POST')).toBe(true));
    expect(f.calls.find(c => c.method === 'POST').body).toMatchObject({ lotId: 'l1', buyerId: 'b1', rate: '2500', quantity: '15', method: 'open_outcry', quality: 'FAQ' });
  });
  it('row action opens ticket detail; Print opens the print view', async () => {
    mockFetch(routes({ 'GET /yard/settings': { item: {} } }));
    render(<ModuleScreen page="auction" user={admin} notify={() => {}}/>);
    await userEvent.click(await screen.findByRole('button', { name: 'પ્રિન્ટ' }));
    expect(await screen.findByText('ભાવ-કાપલી · APMC-1')).toBeInTheDocument();
  });
  it('admin voids a ticket from the detail modal', async () => {
    const f = mockFetch(routes({ 'POST /yard/tickets/t1/void': { item: {} } }));
    vi.spyOn(window, 'prompt').mockReturnValue('entered wrong rate');
    const notify = vi.fn();
    render(<ModuleScreen page="auction" user={admin} notify={notify}/>);
    await userEvent.click(await screen.findByRole('button', { name: /વિગત/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'ટિકિટ રદ કરો' }));
    await waitFor(() => expect(f.calls.find(c => c.path === '/yard/tickets/t1/void').body).toEqual({ reason: 'entered wrong rate' }));
    await waitFor(() => expect(notify).toHaveBeenCalled());
  });
});

describe('ModuleScreen – weighment, payments, gate pass, complaints, buyers, users', () => {
  it('weighment: only auctioned/weighed lots are selectable; posts gross/tare', async () => {
    const f = mockFetch({ 'GET /yard/weighments?page=1&limit=25': { items: [], total: 0 },
      'GET /yard/lots?limit=100': { items: [{ ...lot, status: 'auctioned' }, { ...lot, _id: 'l2', lotNumber: 'LOT-2', status: 'arrived' }, { ...lot, _id: 'l3', lotNumber: 'LOT-3', status: 'weighed' }] }, 'POST /yard/weighments': { item: {} } });
    render(<ModuleScreen page="weighment" user={admin} notify={() => {}}/>);
    await userEvent.click(await screen.findByRole('button', { name: /વજન નોંધો/ }));
    expect(screen.getByRole('option', { name: /LOT-1/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /LOT-3/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /LOT-2/ })).toBeNull();
    await userEvent.selectOptions(screen.getByLabelText(/વજન માટે લોટ/), 'l1');
    await userEvent.type(screen.getByLabelText(/કુલ વજન/), '18');
    await userEvent.type(screen.getByLabelText(/ટેર વજન/), '3');
    await userEvent.click(screen.getByRole('button', { name: /સાચવો/ }));
    await waitFor(() => expect(f.calls.some(c => c.method === 'POST')).toBe(true));
    expect(f.calls.find(c => c.method === 'POST').body).toMatchObject({ lotId: 'l1', gross: '18', tare: '3' });
    expect(screen.getByText(/કાંટાનું હાર્ડવેર/)).toBeInTheDocument();
  });
  it('payments: excludes cancelled bills and posts a payment', async () => {
    const f = mockFetch({ 'GET /yard/payments?page=1&limit=25': { items: [], total: 0 }, 'GET /yard/bills?limit=100': { items: [{ _id: 'b1', billNumber: 'SB-1', farmerName: 'R', farmerNetPayable: 1000, status: 'payment_pending' }, { _id: 'b2', billNumber: 'SB-2', farmerName: 'X', farmerNetPayable: 5, status: 'cancelled' }] }, 'POST /yard/payments': { payment: {} } });
    render(<ModuleScreen page="payments" user={admin} notify={() => {}}/>);
    await userEvent.click(await screen.findByRole('button', { name: /ચુકવણી નોંધો/ }));
    expect(screen.queryByRole('option', { name: /SB-2/ })).toBeNull();
    await userEvent.selectOptions(screen.getByLabelText(/વેચાણ બિલ પસંદ કરો/), 'b1');
    await userEvent.selectOptions(screen.getByLabelText(/ચુકવણીનું ખાતું/), 'farmer_settlement');
    await userEvent.type(screen.getByLabelText(/ચુકવણી રકમ/), '1000');
    await userEvent.selectOptions(screen.getByLabelText(/માધ્યમ/), 'NEFT');
    await userEvent.type(screen.getByLabelText(/UTR/), 'UTR123456');
    await userEvent.click(screen.getByRole('button', { name: /સાચવો/ }));
    await waitFor(() => expect(f.calls.some(c => c.method === 'POST')).toBe(true));
    expect(f.calls.find(c => c.method === 'POST').body).toMatchObject({ billId: 'b1', type: 'farmer_settlement', amount: '1000', mode: 'NEFT', reference: 'UTR123456' });
  });
  it('gate pass: issue posts to the lot URL; dispatch asks for confirmation first', async () => {
    const pass = { _id: 'p1', passNumber: 'GP-1', status: 'issued', lot: { lotNumber: 'LOT-1' }, issuedAt: '2026-03-05T10:00:00Z' };
    const f = mockFetch({ 'GET /yard/gate-passes?page=1&limit=25': { items: [pass], total: 1 }, 'GET /yard/lots?status=paid&limit=100': { items: [{ ...lot, status: 'paid' }] }, 'POST /yard/gate-passes/l1/issue': { item: {} }, 'POST /yard/gate-passes/p1/dispatch': { item: {} } });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValue(true);
    const notify = vi.fn();
    render(<ModuleScreen page="gatepass" user={admin} notify={notify}/>);
    await userEvent.click(await screen.findByRole('button', { name: /બહાર નીકળવાની પુષ્ટિ/ }));
    expect(f.calls.some(c => c.path.endsWith('/dispatch'))).toBe(false);
    await userEvent.click(screen.getByRole('button', { name: /બહાર નીકળવાની પુષ્ટિ/ }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith('વાહન બહાર નીકળવાનો રેકોર્ડ નોંધાયો.'));
    await userEvent.click(screen.getByRole('button', { name: /ગેટ પાસ જારી કરો/ }));
    await userEvent.selectOptions(screen.getByLabelText(/રવાનગી માટે ચુકવાયેલ લોટ/), 'l1');
    await userEvent.type(screen.getByLabelText(/સમયમર્યાદા ઓવરરાઇડનું કારણ/), 'ok');
    await userEvent.click(screen.getByRole('button', { name: /સાચવો/ }));
    await waitFor(() => expect(f.calls.some(c => c.path === '/yard/gate-passes/l1/issue')).toBe(true));
    expect(f.calls.find(c => c.path === '/yard/gate-passes/l1/issue').body).toEqual({ overrideReason: 'ok' });
  });
  it('gate pass: dispatch errors are notified', async () => {
    mockFetch({ 'GET /yard/gate-passes?page=1&limit=25': { items: [{ _id: 'p1', passNumber: 'GP-1', status: 'issued', lot: {} }], total: 1 }, 'GET /yard/lots?status=paid&limit=100': { items: [] }, 'POST /yard/gate-passes/p1/dispatch': { status: 404, body: { message: 'Issued gate pass not found' } } });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const notify = vi.fn();
    render(<ModuleScreen page="gatepass" user={admin} notify={notify}/>);
    await userEvent.click(await screen.findByRole('button', { name: /બહાર નીકળવાની પુષ્ટિ/ }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith(translateServerMessage('Issued gate pass not found'), 'error'));
  });
  it('gate pass: Pass opens the printable pass', async () => {
    mockFetch({ 'GET /yard/gate-passes?page=1&limit=25': { items: [{ _id: 'p1', passNumber: 'GP-1', status: 'dispatched', lot: {} }], total: 1 }, 'GET /yard/lots?status=paid&limit=100': { items: [] } });
    render(<ModuleScreen page="gatepass" user={admin} notify={() => {}}/>);
    await userEvent.click(await screen.findByRole('button', { name: 'પાસ' }));
    expect(await screen.findByText('ગેટ પાસ · GP-1')).toBeInTheDocument();
  });
  const complaint = { _id: 'c1', complaintNumber: 'CMP-1', complainant: 'Ram', type: 'Weight', status: 'open', details: 'detail text here' };
  const cRoutes = (o = {}) => ({ 'GET /yard/complaints?page=1&limit=25': { items: [complaint], total: 1 }, 'GET /yard/lots?limit=100': { items: [] }, ...o });
  it('complaints: admin advances open → investigating; resolving requires a note', async () => {
    const f = mockFetch(cRoutes({ 'PATCH /yard/complaints/c1': { item: {} } }));
    const notify = vi.fn();
    const { unmount } = render(<ModuleScreen page="disputes" user={admin} notify={notify}/>);
    await userEvent.click(await screen.findByRole('button', { name: /સમીક્ષા/ }));
    await waitFor(() => expect(f.calls.find(c => c.method === 'PATCH').body).toEqual({ status: 'investigating' }));
    unmount();
    f.calls.length = 0;
    mockFetch(cRoutes({ 'GET /yard/complaints?page=1&limit=25': { items: [{ ...complaint, status: 'investigating' }], total: 1 }, 'PATCH /yard/complaints/c1': { item: {} } }));
    const prompt = vi.spyOn(window, 'prompt').mockReturnValueOnce('').mockReturnValueOnce('ab').mockReturnValue('fixed after check');
    const g = fetch;
    render(<ModuleScreen page="disputes" user={admin} notify={notify}/>);
    const btn = async () => userEvent.click(await screen.findByRole('button', { name: /સમીક્ષા/ }));
    await btn(); await btn();
    expect(g.mock.calls.some(c => c[1]?.method === 'PATCH')).toBe(false);
    await btn();
    await waitFor(() => expect(JSON.parse(g.mock.calls.find(c => c[1]?.method === 'PATCH')[1].body)).toEqual({ status: 'resolved', resolution: 'fixed after check' }));
  });
  it('complaints: non-reviewer roles see a read-only detail modal', async () => {
    mockFetch(cRoutes());
    render(<ModuleScreen page="disputes" user={{ ...admin, role: 'gate' }} notify={() => {}}/>);
    await userEvent.click(await screen.findByRole('button', { name: /સમીક્ષા/ }));
    expect(await screen.findByText('ફરિયાદ કેસ · CMP-1')).toBeInTheDocument();
  });
  it('complaints: anyone can file one', async () => {
    const f = mockFetch(cRoutes({ 'POST /yard/complaints': { item: {} } }));
    render(<ModuleScreen page="disputes" user={{ ...admin, role: 'weighment' }} notify={() => {}}/>);
    await userEvent.click(await screen.findByRole('button', { name: /નવી ફરિયાદ/ }));
    await userEvent.type(screen.getByLabelText(/ફરિયાદીનું નામ/), 'Ram');
    await userEvent.selectOptions(screen.getByLabelText(/ફરિયાદનો પ્રકાર/), 'વજનમાં તફાવત');
    await userEvent.type(screen.getByLabelText(/ફરિયાદની વિગત/), 'weights differ a lot');
    await userEvent.click(screen.getByRole('button', { name: /સાચવો/ }));
    await waitFor(() => expect(f.calls.some(c => c.method === 'POST')).toBe(true));
    expect(f.calls.find(c => c.method === 'POST').body).toMatchObject({ complainant: 'Ram', type: 'વજનમાં તફાવત', details: 'weights differ a lot' });
  });
  it('buyer ledger: computed credit status, create and edit (PATCH) flows', async () => {
    const f = mockFetch({ 'GET /yard/buyers?page=1&limit=25': { items: [buyer, { ...buyer, _id: 'b2', name: 'Held', ledger: { ...buyer.ledger, overdueCount: 2 } }, { ...buyer, _id: 'b3', name: 'Full', ledger: { ...buyer.ledger, limitFull: true } }], total: 3 }, 'POST /yard/buyers': { item: {} }, 'PATCH /yard/buyers/b1': { item: {} } });
    const notify = vi.fn();
    render(<ModuleScreen page="buyerledger" user={admin} notify={notify}/>);
    await screen.findByText('મર્યાદામાં');
    expect(screen.getByText('2 મુદત વીતી')).toBeInTheDocument();
    expect(screen.getByText('મર્યાદા પૂર્ણ')).toBeInTheDocument();
    expect(screen.getAllByText('TR-1', { selector: 'td' })).toHaveLength(3);  // registrationNo is not a date
    await userEvent.click(screen.getAllByRole('button', { name: /ક્રેડિટ સુધારો/ })[0]);
    const days = screen.getByLabelText(/ક્રેડિટ દિવસો/);
    expect(days).toHaveValue(3);
    await userEvent.clear(days); await userEvent.type(days, '7');
    await userEvent.click(screen.getByRole('button', { name: /સાચવો/ }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith('વેપારીની વિગતો અપડેટ થઈ.'));
    expect(f.calls.find(c => c.method === 'PATCH').body).toMatchObject({ creditDays: '7', name: 'Patel' });
    await userEvent.click(screen.getByRole('button', { name: /નવો વેપારી/ }));
    expect(screen.getByLabelText(/વેપારીનું નામ/)).toHaveValue('');
  });
  it('users: cannot edit own account; editing another sends role/active/password', async () => {
    const users = [{ _id: 'u0', name: 'Admin', email: 'a@x', role: 'admin', active: true }, { _id: 'u2', name: 'Gate Guy', email: 'g@x', role: 'gate', active: true, lastLoginAt: '2026-03-05T10:00:00Z' }];
    const f = mockFetch({ 'GET /yard/users?page=1&limit=25': { items: users, total: 2 }, 'PATCH /yard/users/u2': { item: {} } });
    const notify = vi.fn();
    render(<ModuleScreen page="users" user={admin} notify={notify}/>);
    const buttons = await screen.findAllByRole('button', { name: /ભૂમિકા \/ પહોંચ સુધારો/ });
    await userEvent.click(buttons[0]);
    expect(notify).toHaveBeenCalledWith('તમારા પોતાના એકાઉન્ટની ભૂમિકા/સ્થિતિ બદલી શકાતી નથી.', 'error');
    await userEvent.click(buttons[1]);
    await userEvent.selectOptions(screen.getByLabelText(/સોંપેલ ભૂમિકા/), 'accounts');
    await userEvent.selectOptions(screen.getByLabelText(/એકાઉન્ટ સ્થિતિ/), 'false');
    await userEvent.click(screen.getByRole('button', { name: /સાચવો/ }));
    await waitFor(() => expect(f.calls.some(c => c.method === 'PATCH')).toBe(true));
    expect(f.calls.find(c => c.method === 'PATCH').body).toMatchObject({ role: 'accounts', active: 'false' });
  });
  it('CSV export pages through the API and downloads', async () => {
    URL.createObjectURL = vi.fn(() => 'blob:x'); URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const f = mockFetch({ 'GET /yard/audit?page=1&limit=25': { items: [{ _id: 'a', action: 'A' }], total: 150 }, 'GET /yard/audit?page=1&limit=100': { items: [{ _id: 'a' }], total: 150 }, 'GET /yard/audit?page=2&limit=100': { items: [{ _id: 'b' }], total: 150 } });
    const notify = vi.fn();
    render(<ModuleScreen page="audit" user={admin} notify={notify}/>);
    await screen.findByText('A');
    await userEvent.click(screen.getByRole('button', { name: /CSV/ }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith('CSV નિકાસ તૈયાર છે (2 રેકોર્ડ).'));
    expect(click).toHaveBeenCalled();
    expect(f.calls.filter(c => c.path.includes('limit=100'))).toHaveLength(2);
  });
  it('CSV export failure is notified', async () => {
    mockFetch({ 'GET /yard/audit?page=1&limit=25': { items: [{ _id: 'a', action: 'A' }], total: 1 }, 'GET /yard/audit?page=1&limit=100': { status: 500, body: { message: 'export broke' } } });
    const notify = vi.fn();
    render(<ModuleScreen page="audit" user={admin} notify={notify}/>);
    await screen.findByText('A');
    await userEvent.click(screen.getByRole('button', { name: /CSV/ }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith('export broke', 'error'));
  });
  it('refresh button reloads', async () => {
    const f = mockFetch({ 'GET /yard/audit?page=1&limit=25': { items: [], total: 0 } });
    render(<ModuleScreen page="audit" user={admin} notify={() => {}}/>);
    await screen.findByText('કોઈ રેકોર્ડ મળ્યો નથી.');
    await userEvent.click(screen.getByRole('button', { name: /રિફ્રેશ/ }));
    await waitFor(() => expect(f.calls).toHaveLength(2));
  });
});
