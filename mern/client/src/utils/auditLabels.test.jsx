import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import { auditLabel, textValue } from './format.js';
import { setLanguage, t } from '../i18n/index.js';
import { YardLive } from '../features/dashboard/YardLive.jsx';
import { DataTable } from '../components/common/DataTable.jsx';

beforeEach(() => setLanguage('gu'));
afterEach(() => setLanguage('gu'));

// Every audit(...) action code and resource the API can write must be translatable; found by scanning the server source.
const serverSrc = path.resolve(fs.realpathSync(import.meta.dirname), '../../../server/src');
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const source = walk(serverSrc).filter(f => f.endsWith('.js')).map(f => fs.readFileSync(f, 'utf8')).join('\n');
const actions = [...new Set([...source.matchAll(/'([A-Z]+(?:_[A-Z]+)+)'/g)].map(m => m[1]))].filter(a => /_(CREATED|UPDATED|ISSUED|VOIDED|REGISTERED|RECORDED|CONFIRMED|CORRECTED)$/.test(a));
const resources = [...new Set([...source.matchAll(/audit\([^)]*?'[A-Z_]+',\s*'([A-Za-z]+)'/g)].map(m => m[1]))];

describe('audit trail labels', () => {
  it('finds the server audit codes (guards the scanner itself)', () => {
    expect(actions.length).toBeGreaterThanOrEqual(15); expect(actions).toContain('WEIGHMENT_CORRECTED'); expect(resources).toContain('AuctionTicket');
  });
  it('every action code and resource written by the server has a gu, en and hi label', () => {
    for (const lang of ['gu', 'en', 'hi']) {
      setLanguage(lang);
      for (const a of actions) expect(t('audit.action.' + a), `${lang} ${a}`).not.toBe('audit.action.' + a);
      for (const r of resources) expect(t('audit.resource.' + r), `${lang} ${r}`).not.toBe('audit.resource.' + r);
    }
  });
  it('labels are in the right script (no raw codes, no Latin words in gu/hi)', () => {
    for (const lang of ['gu', 'hi']) {
      setLanguage(lang);
      for (const a of actions) expect(auditLabel('action', a), `${lang} ${a}`).not.toMatch(/[A-Za-z]{2,}/);
      for (const r of resources) expect(auditLabel('resource', r), `${lang} ${r}`).not.toMatch(/[A-Za-z]{2,}/);
    }
    setLanguage('en'); expect(auditLabel('action', 'GATE_ENTRY_CREATED')).toBe('Gate entry recorded');
  });
  it('unknown codes pass through unchanged instead of showing a key', () => {
    expect(auditLabel('action', 'SOMETHING_NEW')).toBe('SOMETHING_NEW'); expect(auditLabel('resource', undefined)).toBe('—');
  });
  it('textValue translates the audit table columns', () => {
    setLanguage('hi'); expect(textValue('GATE_PASS_ISSUED', 'action')).toBe('गेट पास जारी किया गया'); expect(textValue('GatePass', 'resource')).toBe('गेट पास');
  });
  it('the audit table and the dashboard activity feed follow the language', () => {
    const rows = [{ _id: '1', createdAt: '2026-01-01T10:00:00Z', actorName: 'Ravi', role: 'admin', action: 'PAYMENT_RECORDED', resource: 'Payment', resourceId: 'x', reason: '' }];
    const cols = [['action', 'a'], ['resource', 'b']];
    render(<DataTable columns={cols} rows={rows} />);
    expect(screen.getByText('ચુકવણી નોંધાઈ')).toBeInTheDocument();
    act(() => setLanguage('en'));
    expect(screen.getByText('Payment recorded')).toBeInTheDocument();
    expect(screen.queryByText('PAYMENT_RECORDED')).toBeNull();
  });
  it('YardLive activity shows translated action names', () => {
    const live = { status: { auctionPending: 0, passesIssued: 0, dispatched: 0, inYard: 0, quintalsInside: 0 }, stock: [], farmerDues: [], traderDues: [], farmerTotals: { payable: 0, paid: 0, due: 0, provisional: 0 }, arrivalsByHour: [], activity: [{ _id: 'a', action: 'GATE_ENTRY_CREATED', actorName: 'Ravi', resourceId: 'LOT-1', createdAt: '2026-01-01T10:00:00Z' }] };
    setLanguage('hi'); render(<YardLive live={live} onNavigate={() => {}} />);
    expect(screen.getByText('गेट एंट्री दर्ज की गई')).toBeInTheDocument(); expect(screen.queryByText('GATE_ENTRY_CREATED')).toBeNull();
  });
});

describe('document title', () => {
  it('follows the selected language', () => {
    setLanguage('en'); expect(document.title).toBe('APMC YardOS · Market Yard Management');
    setLanguage('hi'); expect(document.title).toBe('APMC YardOS · मार्केट यार्ड प्रबंधन');
    setLanguage('gu'); expect(document.title).toBe('APMC YardOS · માર્કેટ યાર્ડ વ્યવસ્થાપન');
  });
});
