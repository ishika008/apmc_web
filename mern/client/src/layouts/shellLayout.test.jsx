// Structure of the shell as defined by the reference design: sectioned, numbered sidebar; grouped topbar; two-part footer.
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Workspace } from './Workspace.jsx';
import { mockFetch } from '../test/mockFetch.js';
import { setLanguage } from '../i18n/index.js';

afterEach(() => { setLanguage('gu'); vi.unstubAllGlobals(); });
const base = { 'GET /yard/nav-counts': { openComplaints: 0, auctionQueue: 0, farmerOverdue: 0, buyerOverdue: 0, dispatchOverdue: 0 }, 'GET /yard/settings': { item: { committeeName: 'Surat APMC', commodities: [] } },
  'GET /yard/overview': { stats: {} }, 'GET /yard/lots?limit=6': { items: [] }, 'GET /yard/dashboard': { status: { auctionPending: 0, passesIssued: 0, dispatched: 0, inYard: 0, quintalsInside: 0 }, stock: [], farmerDues: [], traderDues: [], farmerTotals: { payable: 0, paid: 0, due: 0, provisional: 0 }, arrivalsByHour: [], activity: [] } };
const show = role => { mockFetch(new Proxy(base, {})); render(<Workspace user={{ id: 'u', name: 'Asha Patel', role }} onLogout={() => {}} notify={() => {}} />); };
const sidebar = () => document.querySelector('.side-nav');

describe('shell layout (reference design)', () => {
  it('brand block shows the Gujarati mark, YardOS wordmark and tagline', () => {
    show('admin');
    expect(document.querySelector('.brand-logo').textContent).toBe('અ');
    expect(document.querySelector('.sidebar-brand b').textContent).toBe('YardOS');
    expect(document.querySelector('.sidebar-brand small').textContent).toBe('APMC DIGITAL SYSTEM');
  });
  it('brand mark is localised (A in English, अ in Hindi)', () => {
    setLanguage('en'); show('admin');
    expect(document.querySelector('.brand-logo').textContent).toBe('A');
  });
  it('sidebar has the two reference sections with the operations items before control items', () => {
    show('admin');
    const labels = [...sidebar().querySelectorAll('.nav-label')].map(e => e.textContent);
    expect(labels).toEqual(['મુખ્ય વ્યવસ્થાપન', 'નિયંત્રણ અને અહેવાલ']);
    const order = [...sidebar().children].map(e => e.classList.contains('nav-label') ? 'L' : 'B').join('');
    expect(order).toBe('L' + 'B'.repeat(8) + 'L' + 'B'.repeat(5));
  });
  it('a restricted role still gets both section labels (it has shared control items such as complaints and reports)', () => {
    show('weighment');
    expect([...sidebar().querySelectorAll('.nav-label')].map(e => e.textContent)).toEqual(['મુખ્ય વ્યવસ્થાપન', 'નિયંત્રણ અને અહેવાલ']);
  });
  it('operations items are numbered 01.. in order; control items are not numbered', () => {
    show('admin');
    const nums = [...sidebar().querySelectorAll('.nav-link kbd')].map(e => e.textContent);
    expect(nums).toEqual(['01', '02', '03', '04', '05', '06', '07', '08']);
    expect(sidebar().querySelectorAll('.nav-link').length).toBe(13);
  });
  it('the current page is exposed to assistive tech and styled active', () => {
    show('admin');
    const active = sidebar().querySelector('.nav-link.active');
    expect(active.getAttribute('aria-current')).toBe('page');
    expect(sidebar().querySelectorAll('[aria-current="page"]').length).toBe(1);
  });
  it('topbar right cluster order is search, status, language, bell, user, sign-out', () => {
    show('admin');
    const kids = [...document.querySelector('.topbar-right').children].map(e => e.className.split(' ')[0]);
    expect(kids[0]).toBe('global-search'); expect(kids).toContain('lang-select'); expect(kids.indexOf('lang-select')).toBeLessThan(kids.indexOf('bell-wrap'));
    expect(kids.indexOf('bell-wrap')).toBeLessThan(kids.indexOf('top-user')); expect(document.querySelector('.topbar-right').lastElementChild.classList.contains('desktop-logout')).toBe(true);
  });
  it('top user chip shows name and role under the avatar', () => {
    show('inspector');
    const chip = document.querySelector('.top-user');
    expect(chip.querySelector('strong').textContent).toBe('Asha Patel');
    expect(chip.querySelector('small').textContent).toBe('નિરીક્ષક');
    expect(chip.querySelector('.user-avatar').textContent).toBe('A');
  });
  it('footer has a left (records notice) and a right (reference tagline) part', () => {
    show('admin');
    const spans = document.querySelectorAll('.app-footer > span');
    expect(spans).toHaveLength(2);
    expect(spans[0].textContent).toMatch(/સંચાલનના રેકોર્ડ ગોઠવેલા સર્વર ડેટાબેઝમાં/);
    expect(spans[1].textContent).toBe('ગુજરાતી પ્રથમ · સુરક્ષિત રેકોર્ડ · ઓડિટ માટે તૈયાર વર્કફ્લો');
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });
});
