import { describe, it, expect } from 'vitest';
import { roles } from './roles.js';
import { navigation } from './navigation.js';
import { pageConfig, columnsFor } from './pageConfig.js';
import { t } from '../i18n/index.js';

const ROLE_KEYS = ['admin', 'gate', 'auction', 'weighment', 'accounts', 'inspector'];

describe('roles', () => {
  it('has the six server roles with labels', () => {
    expect(Object.keys(roles).sort()).toEqual([...ROLE_KEYS].sort());
    for (const label of Object.values(roles)) expect(label).toBeTruthy();
  });
});

describe('navigation', () => {
  it('has unique ids and valid roles/icons/labels', () => {
    const ids = navigation.map(n => n.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const n of navigation) {
      expect(n.label && n.sub).toBeTruthy();
      expect(n.icon).toBeTruthy();
      expect(n.roles.length).toBeGreaterThan(0);
      for (const r of n.roles) expect(ROLE_KEYS).toContain(r);
    }
  });
  it('admin sees every module', () => expect(navigation.every(n => n.roles.includes('admin'))).toBe(true));
  const visible = role => navigation.filter(n => n.roles.includes(role)).map(n => n.id);
  it('enforces least privilege for navigation', () => {
    expect(visible('gate')).toEqual(expect.arrayContaining(['dashboard', 'gate', 'gatepass']));
    expect(visible('gate')).not.toContain('payments');
    expect(visible('gate')).not.toContain('users');
    expect(visible('accounts')).toEqual(expect.arrayContaining(['payments', 'buyerledger', 'sales']));
    expect(visible('accounts')).not.toContain('audit');
    expect(visible('auction')).not.toContain('settings');
    expect(visible('weighment')).not.toContain('payments');
    expect(visible('inspector')).toEqual(expect.arrayContaining(['audit', 'sales']));
    expect(visible('inspector')).not.toContain('payments');
    for (const r of ROLE_KEYS.filter(r => r !== 'admin')) { expect(visible(r)).not.toContain('users'); expect(visible(r)).not.toContain('settings'); }
  });
  it('every role can reach dashboard, complaints and reports', () => {
    for (const r of ROLE_KEYS) for (const id of ['dashboard', 'disputes', 'reports']) expect(visible(r)).toContain(id);
  });
});

describe('pageConfig', () => {
  it('has a config for every module that is not a dedicated screen', () => {
    const dedicated = ['dashboard', 'reports', 'settings'];
    for (const n of navigation.filter(n => !dedicated.includes(n.id))) expect(pageConfig[n.id], n.id).toBeDefined();
  });
  it('has well-formed endpoint, title and columns', () => {
    for (const [id, cfg] of Object.entries(pageConfig)) {
      expect(cfg.endpoint, id).toMatch(/^\/yard\/[a-z-]+$/);
      expect(cfg.titleKey && cfg.subtitleKey, id).toBeTruthy();
      expect(t(cfg.titleKey) !== cfg.titleKey && t(cfg.subtitleKey) !== cfg.subtitleKey, id + ' title/subtitle keys resolve').toBe(true);
      expect(cfg.columns.length, id).toBeGreaterThan(0);
      const keys = cfg.columns.map(c => c[0]);
      expect(new Set(keys).size, id + ' duplicate column keys').toBe(keys.length);
      for (const c of cfg.columns) { expect(c).toHaveLength(2); expect(c[0] && c[1]).toBeTruthy(); expect(t(c[1]) !== c[1], `${id}.${c[0]} label key resolves`).toBe(true); }
      expect(columnsFor(id).map(c => c[0])).toEqual(keys);
      if (cfg.createLabelKey) {
        expect(t(cfg.createLabelKey) !== cfg.createLabelKey, id + ' create label resolves').toBe(true); expect(cfg.createRoles.length, id).toBeGreaterThan(0); for (const r of cfg.createRoles) expect(ROLE_KEYS).toContain(r); }
    }
  });
  it('create roles are a subset of roles allowed to see the module', () => {
    for (const [id, cfg] of Object.entries(pageConfig)) {
      if (!cfg.createRoles) continue;
      const nav = navigation.find(n => n.id === id);
      for (const r of cfg.createRoles) expect(nav.roles, `${id}:${r}`).toContain(r);
    }
  });
  it('endpoints match the server routes', () => {
    expect(pageConfig.gate.endpoint).toBe('/yard/lots');
    expect(pageConfig.auction.endpoint).toBe('/yard/tickets');
    expect(pageConfig.gatepass.endpoint).toBe('/yard/gate-passes');
    expect(pageConfig.buyerledger.endpoint).toBe('/yard/buyers');
  });
});
