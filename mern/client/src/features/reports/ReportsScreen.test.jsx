import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReportsScreen } from './ReportsScreen.jsx';
import { mockFetch } from '../../test/mockFetch.js';
import { translateServerMessage } from '../../i18n/index.js';

afterEach(() => vi.unstubAllGlobals());
const catalog = { counts: { lots: 5, tickets: 4, weighments: 3, bills: 2, payments: 1, complaints: 0, audit: 9 }, kpis: { averageRate: 2500, grossSales: 37500, pendingPayable: 100 } };
const summary = { lots: 2, tickets: 1, bills: { bills: 1, gross: 37500, farmerPayable: 37000, farmerPaid: 1000 }, payments: [{ _id: 'farmer_settlement', count: 2, amount: 900 }], complaints: 3 };
const routes = (o = {}) => ({ 'GET /yard/reports/catalog': catalog, ...o });
const summaryRoute = { 'GET /yard/reports/summary': summary };

describe('ReportsScreen', () => {
  beforeEach(() => { URL.createObjectURL = vi.fn(() => 'blob:x'); URL.revokeObjectURL = vi.fn(); vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {}); });

  it('renders catalog KPIs and the report list (audit hidden for non-audit roles)', async () => {
    mockFetch(routes(summaryRoute));
    render(<ReportsScreen user={{ role: 'gate' }} notify={() => {}}/>);
    expect((await screen.findAllByText('₹37,500.00', { selector: 'strong' })).length).toBeGreaterThan(0);
    expect(screen.getByText('ગેટ આવક રજિસ્ટર')).toBeInTheDocument();
    expect(screen.queryByText('ઓડિટ ટ્રેલ')).toBeNull();
    expect(screen.getAllByRole('button', { name: 'CSV એક્સપોર્ટ' })).toHaveLength(6);
  });
  it.each(['admin', 'inspector'])('shows the audit report for %s', async role => {
    mockFetch(routes(summaryRoute));
    render(<ReportsScreen user={{ role }} notify={() => {}}/>);
    expect(await screen.findByText('ઓડિટ ટ્રેલ')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'CSV એક્સપોર્ટ' })).toHaveLength(7);
  });
  it('runs the summary for the selected range on load and via Generate', async () => {
    const f = mockFetch(routes(summaryRoute));
    render(<ReportsScreen user={{ role: 'admin' }} notify={() => {}}/>);
    await screen.findByText('ગેટ આવક');
    const today = new Date().toISOString().slice(0, 10);
    expect(f.calls.find(c => c.path.startsWith('/yard/reports/summary')).path).toBe(`/yard/reports/summary?from=${today}&to=${today}`);
    expect(screen.getByText('ખાતા મુજબ ચુકવણી વસૂલાત')).toBeInTheDocument();
    // the ledger label also appears as a KPI note, so scope to the collections table
    expect(within(screen.getByText('ખાતા મુજબ ચુકવણી વસૂલાત').closest('section')).getByText('ખેડૂત ચુકવણી')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /રિપોર્ટ બનાવો/ }));
    await waitFor(() => expect(f.calls.filter(c => c.path.startsWith('/yard/reports/summary')).length).toBe(2));
  });
  it('shows summary errors (e.g. invalid range)', async () => {
    mockFetch(routes({ 'GET /yard/reports/summary': { status: 400, body: { message: 'Invalid report date range' } } }));
    render(<ReportsScreen user={{ role: 'admin' }} notify={() => {}}/>);
    expect(await screen.findByText(translateServerMessage('Invalid report date range'))).toBeInTheDocument();
  });
  it('shows an empty payments state', async () => {
    mockFetch(routes({ 'GET /yard/reports/summary': { ...summary, payments: [] } }));
    render(<ReportsScreen user={{ role: 'admin' }} notify={() => {}}/>);
    expect(await screen.findByText('આ સમયગાળામાં કોઈ ચુકવણી રસીદ નથી.')).toBeInTheDocument();
  });
  it('exports one dataset with auth and notifies', async () => {
    const f = vi.fn(async url => String(url).includes('/export/') ? new Response('a', { headers: { 'Content-Disposition': 'attachment; filename="apmc-lot-register.csv"' } }) : new Response(JSON.stringify(String(url).includes('catalog') ? catalog : summary), { headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', f);
    const notify = vi.fn();
    render(<ReportsScreen user={{ role: 'admin' }} notify={notify}/>);
    const row = (await screen.findByText('ગેટ આવક રજિસ્ટર')).closest('tr');
    await userEvent.click(within(row).getByRole('button', { name: 'CSV એક્સપોર્ટ' }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith('CSV એક્સપોર્ટ તૈયાર છે.'));
    expect(f.mock.calls.some(c => c[0] === '/api/yard/reports/export/lots')).toBe(true);
  });
  it('reports export failures as errors', async () => {
    const f = vi.fn(async url => String(url).includes('/export/') ? new Response(JSON.stringify({ message: 'Forbidden export' }), { status: 403, headers: { 'Content-Type': 'application/json' } }) : new Response(JSON.stringify(String(url).includes('catalog') ? catalog : summary), { headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', f);
    const notify = vi.fn();
    render(<ReportsScreen user={{ role: 'admin' }} notify={notify}/>);
    const row = (await screen.findByText('ગેટ આવક રજિસ્ટર')).closest('tr');
    await userEvent.click(within(row).getByRole('button', { name: 'CSV એક્સપોર્ટ' }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith('Forbidden export', 'error'));
  });
  it('export-all downloads every visible report', async () => {
    const seen = [];
    const f = vi.fn(async url => { if (String(url).includes('/export/')) { seen.push(url); return new Response('a'); } return new Response(JSON.stringify(String(url).includes('catalog') ? catalog : summary), { headers: { 'Content-Type': 'application/json' } }); });
    vi.stubGlobal('fetch', f);
    render(<ReportsScreen user={{ role: 'gate' }} notify={() => {}}/>);
    await screen.findByText('ગેટ આવક રજિસ્ટર');
    await userEvent.click(screen.getByRole('button', { name: 'બધો ડેટા એક્સપોર્ટ કરો' }));
    await waitFor(() => expect(seen).toHaveLength(6), { timeout: 4000 });
    expect(seen.some(u => u.endsWith('/audit'))).toBe(false);
  });
  it('still renders (without KPIs) when the catalog fails', async () => {
    mockFetch({ 'GET /yard/reports/catalog': { status: 500, body: { message: 'x' } }, ...summaryRoute });
    render(<ReportsScreen user={{ role: 'admin' }} notify={() => {}}/>);
    expect(await screen.findByText('ગેટ આવક')).toBeInTheDocument();
    expect(screen.queryByText('રિપોર્ટ સેન્ટર')).toBeNull();
  });
});
