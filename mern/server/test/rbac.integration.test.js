// Every /api/yard route x every role. "allowed" means the route guard let the request through
// (the handler may still answer 400/404 for an empty body / unknown id); "denied" means exactly 403.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { boot, ROLES, SKIP } from '../test-support/harness.js';

let h;
const ID = '507f1f77bcf86cd799439011';
before(async () => { if (!SKIP) h = await boot('rbac'); });
after(async () => { if (!SKIP) await h.close(); });

const ALL = ROLES;
const only = (...r) => r;
// [method, path, allowed roles]
const MATRIX = [
  ['GET', '/overview', ALL], ['GET', '/dashboard', ALL], ['GET', '/nav-counts', ALL], ['GET', '/search?q=ab', ALL],
  ['GET', '/lots', ALL], ['POST', '/lots', only('admin', 'gate')], ['GET', `/lots/${ID}`, ALL],
  ['GET', '/buyers', ALL], ['POST', '/buyers', only('admin', 'accounts')], ['PATCH', `/buyers/${ID}`, only('admin', 'accounts')],
  ['GET', '/tickets', ALL], ['POST', '/tickets', only('admin', 'auction')], ['POST', `/tickets/${ID}/void`, only('admin')],
  ['GET', '/weighments', ALL], ['POST', '/weighments', only('admin', 'weighment')],
  ['GET', '/bills', ALL], ['GET', '/payments', ALL], ['POST', '/payments', only('admin', 'accounts')],
  ['GET', '/gate-passes', ALL], ['POST', `/gate-passes/${ID}/issue`, only('admin', 'gate')], ['POST', `/gate-passes/${ID}/dispatch`, only('admin', 'gate')],
  ['GET', '/complaints', ALL], ['POST', '/complaints', ALL], ['PATCH', `/complaints/${ID}`, only('admin', 'inspector')],
  ['GET', '/reports/summary', ALL], ['GET', '/reports/catalog', ALL],
  ['GET', '/reports/export/audit', only('admin', 'inspector')], ['GET', '/reports/export/lots', ALL],
  ['GET', '/settings', ALL], ['PATCH', '/settings', only('admin')],
  ['GET', '/users', only('admin')], ['POST', '/users', only('admin')], ['PATCH', `/users/${ID}`, only('admin')],
  ['GET', '/audit', only('admin', 'inspector')]
];

test('all routes reject unauthenticated requests with 401', { skip: SKIP }, async () => {
  for (const [method, path] of MATRIX) {
    const r = await h.raw(method, '/api/yard' + path, { body: ['GET'].includes(method) ? undefined : {} });
    assert.equal(r.status, 401, `${method} ${path}`);
  }
});

for (const role of ROLES) {
  test(`role matrix: ${role}`, { skip: SKIP }, async () => {
    const wrong = [];
    for (const [method, path, allowed] of MATRIX) {
      const r = await h.call(role, method, path, method === 'GET' ? undefined : {});
      const permitted = allowed.includes(role);
      const ok = permitted ? (r.status !== 403 && r.status !== 401) : r.status === 403;
      if (!ok) wrong.push(`${method} ${path} -> ${r.status} (expected ${permitted ? 'allowed' : '403'})`);
    }
    assert.deepEqual(wrong, []);
  });
}

test('denied requests never reach the handler (no side effects)', { skip: SKIP }, async () => {
  const body = { farmerName: 'X', commodity: 'ઘઉં', bags: 1 };
  assert.equal((await h.call('auction', 'POST', '/lots', body)).status, 403);
  assert.equal((await h.call('inspector', 'POST', '/lots', body)).status, 403);
  assert.equal(await h.models.Lot.countDocuments(), 0);
  assert.equal(await h.models.AuditLog.countDocuments({ action: 'GATE_ENTRY_CREATED' }), 0);
});
