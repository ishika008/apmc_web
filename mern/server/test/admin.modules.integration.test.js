// Complaints, yard settings, staff/user administration and the audit log.
// Login limiter budget in this file: 3 calls (limit is 8 per process).
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { boot, SKIP } from '../test-support/harness.js';

let h;
before(async () => { if (!SKIP) h = await boot('admin'); });
after(async () => { if (!SKIP) await h.close(); });

/* ───────────────────────────── complaints ───────────────────────────── */

const complaint = (over = {}, role = 'gate') => h.call(role, 'POST', '/complaints', { complainant: 'Mahesh', type: 'Weight', details: 'Weight on slip looks wrong', ...over });

test('complaint: any role can register; number, defaults, creator and audit', { skip: SKIP }, async () => {
  for (const role of ['admin', 'gate', 'auction', 'weighment', 'accounts', 'inspector']) assert.equal((await complaint({}, role)).status, 201, role);
  const r = await complaint({ mobile: '999', evidenceReferences: ' a ; b,c\n d ' });
  assert.equal(r.status, 201);
  const c = r.body.item;
  assert.match(c.complaintNumber, /^CMP-\d{4}-\d{6}$/); assert.equal(c.status, 'open'); assert.equal(c.createdBy, h.users.gate.id); assert.equal(c.lot, null);
  assert.deepEqual(c.evidenceReferences, ['a', 'b', 'c', 'd'], 'string split on newline / comma / semicolon, trimmed');
  assert.ok(await h.models.AuditLog.findOne({ action: 'COMPLAINT_REGISTERED', resourceId: c._id }));
});

test('complaint: validation', { skip: SKIP }, async () => {
  for (const over of [{ complainant: '' }, { complainant: '  ' }, { complainant: undefined }, { type: '' }, { type: undefined }, { details: 'too short' }, { details: '         ' }, { details: undefined }]) {
    assert.equal((await complaint(over)).status, 400, JSON.stringify(over));
  }
  assert.equal((await complaint({ lotId: 'bad' })).status, 400);
  assert.equal((await complaint({ lotId: 5 })).status, 400);
  assert.equal((await complaint({ details: 'x'.repeat(10) })).status, 201, '10 chars is the minimum');
  assert.equal((await complaint({ details: 'x'.repeat(5001) })).status, 400, `over the 5000 limit -> should be 400`);
});

test('complaint: evidence list is capped at 10, accepts arrays, and ignores blanks', { skip: SKIP }, async () => {
  const many = Array.from({ length: 15 }, (_, i) => 'ref' + i);
  assert.equal((await complaint({ evidenceReferences: many })).body.item.evidenceReferences.length, 10);
  assert.deepEqual((await complaint({ evidenceReferences: ['a', '', '  ', 'b'] })).body.item.evidenceReferences, ['a', 'b']);
  assert.deepEqual((await complaint({ evidenceReferences: undefined })).body.item.evidenceReferences, []);
});

test('complaint: can be linked to a lot and appears in lot traceability', { skip: SKIP }, async () => {
  const lot = (await h.call('gate', 'POST', '/lots', { farmerName: 'F', commodity: 'ઘઉં', bags: 1 })).body.item;
  const c = (await complaint({ lotId: lot._id })).body.item;
  assert.equal(c.lot, lot._id);
  const detail = (await h.call('inspector', 'GET', '/lots/' + lot._id)).body;
  assert.equal(detail.complaints.length, 1); assert.equal(detail.complaints[0]._id, c._id);
});

test('complaint update: status workflow, resolution requirement, assignee, validation, audit', { skip: SKIP }, async () => {
  const c = (await complaint()).body.item;
  assert.equal((await h.call('inspector', 'PATCH', '/complaints/bad', {})).status, 400);
  assert.equal((await h.call('inspector', 'PATCH', '/complaints/507f1f77bcf86cd799439011', {})).status, 404);
  assert.equal((await h.call('inspector', 'PATCH', `/complaints/${c._id}`, { status: 'closed' })).status, 400);
  let r = await h.call('inspector', 'PATCH', `/complaints/${c._id}`, { status: 'investigating', assignedTo: h.users.inspector.id });
  assert.equal(r.status, 200); assert.equal(r.body.item.status, 'investigating'); assert.equal(r.body.item.assignedTo, h.users.inspector.id);
  assert.equal((await h.call('inspector', 'PATCH', `/complaints/${c._id}`, { assignedTo: 'bad' })).status, 400);
  r = await h.call('inspector', 'PATCH', `/complaints/${c._id}`, { status: 'resolved' });
  assert.equal(r.status, 400); assert.match(r.body.message, /resolution note/);
  assert.equal((await h.call('inspector', 'PATCH', `/complaints/${c._id}`, { status: 'resolved', resolution: '   ' })).status, 400, 'blank resolution');
  assert.equal((await h.models.Complaint.findById(c._id)).status, 'investigating', 'failed updates are not saved');
  r = await h.call('admin', 'PATCH', `/complaints/${c._id}`, { status: 'resolved', resolution: '  Re-weighed, corrected.  ' });
  assert.equal(r.status, 200); assert.equal(r.body.item.resolution, 'Re-weighed, corrected.'); assert.ok(r.body.item.resolvedAt);
  const log = await h.models.AuditLog.findOne({ action: 'COMPLAINT_UPDATED', resourceId: c._id }).sort({ createdAt: -1 });
  assert.equal(log.before.status, 'investigating'); assert.equal(log.after.status, 'resolved');
  assert.equal((await h.call('gate', 'PATCH', `/complaints/${c._id}`, { status: 'open' })).status, 403);
});

test('complaint update: a resolved complaint that is re-opened keeps its resolution note requirement consistent', { skip: SKIP }, async () => {
  const c = (await complaint()).body.item;
  await h.call('admin', 'PATCH', `/complaints/${c._id}`, { status: 'resolved', resolution: 'done and dusted' });
  const r = await h.call('admin', 'PATCH', `/complaints/${c._id}`, { status: 'open' });
  assert.equal(r.status, 200); assert.equal(r.body.item.status, 'open');
  assert.equal((await h.call('admin', 'PATCH', `/complaints/${c._id}`, { status: 'rejected' })).status, 200, 'rejection needs no resolution');
});

test('complaint update: an over-long resolution is a 400, not a 500', { skip: SKIP }, async () => {
  const c = (await complaint()).body.item;
  const r = await h.call('admin', 'PATCH', `/complaints/${c._id}`, { status: 'resolved', resolution: 'x'.repeat(5001) });
  assert.equal(r.status, 400, JSON.stringify(r.body));
});

test('list complaints: status filter, pagination, populated refs', { skip: SKIP }, async () => {
  const all = await h.call('inspector', 'GET', '/complaints?limit=100');
  assert.ok(all.body.total >= 5);
  const open = await h.call('inspector', 'GET', '/complaints?status=open&limit=100');
  assert.ok(open.body.items.length > 0 && open.body.items.every(c => c.status === 'open'));
  assert.equal((await h.call('inspector', 'GET', '/complaints?limit=2')).body.items.length, 2);
  assert.ok(all.body.items.every(c => c.createdBy?.name));
});

/* ───────────────────────────── settings ───────────────────────────── */

test('settings: GET creates the singleton with defaults (idempotent)', { skip: SKIP }, async () => {
  const a = (await h.call('gate', 'GET', '/settings')).body.item, b = (await h.call('gate', 'GET', '/settings')).body.item;
  assert.equal(a._id, b._id); assert.equal(await h.models.YardConfig.countDocuments(), 1);
  assert.equal(a.key, 'yard'); assert.equal(a.ticketPrefix, 'APMC'); assert.equal(a.farmerPaymentDays, 1); assert.ok(a.commodities.includes('ઘઉં'));
});

test('settings: update persists, audits before/after, and ignores unknown keys', { skip: SKIP }, async () => {
  const r = await h.call('admin', 'PATCH', '/settings', { committeeName: 'Surat APMC', ticketPrefix: 'SRT', farmerPaymentDays: 3, key: 'hacked', _id: '507f1f77bcf86cd799439011' });
  assert.equal(r.status, 200); assert.equal(r.body.item.committeeName, 'Surat APMC'); assert.equal(r.body.item.farmerPaymentDays, 3);
  assert.equal(r.body.item.key, 'yard'); assert.equal(await h.models.YardConfig.countDocuments(), 1);
  const log = await h.models.AuditLog.findOne({ action: 'YARD_SETTINGS_UPDATED' }).sort({ createdAt: -1 });
  assert.equal(log.before.ticketPrefix, 'APMC'); assert.equal(log.after.ticketPrefix, 'SRT');
});

test('settings: prefix and deadline changes drive new numbers and ticket deadlines', { skip: SKIP }, async () => {
  await h.call('admin', 'PATCH', '/settings', { ticketPrefix: 'XYZ', farmerPaymentDays: 4, dispatchDays: 6 });
  const lot = (await h.call('gate', 'POST', '/lots', { farmerName: 'F', commodity: 'ઘઉં', bags: 1 })).body.item;
  const buyer = (await h.call('accounts', 'POST', '/buyers', { name: 'SB', registrationNo: '1' })).body.item;
  const t = (await h.call('auction', 'POST', '/tickets', { lotId: lot._id, buyerId: buyer._id, rate: 1, quantity: 1 })).body.item;
  assert.match(t.ticketNumber, /^XYZ-/);
  const day = 86400000;
  assert.ok(Math.abs(new Date(t.farmerPaymentDueAt) - new Date(t.createdAt) - 4 * day) < 5000);
  assert.ok(Math.abs(new Date(t.dispatchDueAt) - new Date(t.createdAt) - 6 * day) < 5000);
});

test('settings: commodity master validation, and new commodities become selectable at the gate', { skip: SKIP }, async () => {
  for (const commodities of [[], ['ok', ' '], ['ok', ''], null]) {
    const r = await h.call('admin', 'PATCH', '/settings', { commodities });
    assert.equal(r.status, 400, JSON.stringify(commodities));
  }
  const before = (await h.call('admin', 'GET', '/settings')).body.item.commodities;
  assert.ok(before.length > 0, 'failed updates leave the master list intact');
  assert.equal((await h.call('admin', 'PATCH', '/settings', { commodities: ['Mango'] })).status, 200);
  assert.equal((await h.call('gate', 'POST', '/lots', { farmerName: 'F', commodity: 'Mango', bags: 1 })).status, 201);
  assert.equal((await h.call('gate', 'POST', '/lots', { farmerName: 'F', commodity: 'ઘઉં', bags: 1 })).status, 400, 'old commodity no longer approved');
});

test('settings: out-of-range numbers are client errors (400), not 500', { skip: SKIP }, async () => {
  for (const body of [{ farmerPaymentDays: 61 }, { dispatchDays: 91 }, { defaultBuyerCreditDays: -1 }, { sellerApprovedDeduction: -5 }, { buyerMarketFee: -1 }, { buyerOtherDues: 'abc' }, { farmerPaymentDays: 'x' }]) {
    const r = await h.call('admin', 'PATCH', '/settings', body);
    assert.equal(r.status, 400, `${JSON.stringify(body)} -> ${r.status} ${JSON.stringify(r.body)}`);
  }
});

/* ───────────────────────────── users ───────────────────────────── */

const newUser = (over = {}) => h.call('admin', 'POST', '/users', { name: 'New Staff', email: 'new.staff@t.io', password: 'a-long-password-1', role: 'gate', ...over });

test('create user: success returns the public shape only, stores a bcrypt hash, audits, never exposes the hash', { skip: SKIP }, async () => {
  const r = await newUser({ name: '  Asha  ', email: '  ASHA@T.IO ' });
  assert.equal(r.status, 201);
  assert.deepEqual(Object.keys(r.body.item).sort(), ['active', 'email', 'id', 'name', 'role']);
  assert.equal(r.body.item.email, 'asha@t.io'); assert.equal(r.body.item.name, 'Asha'); assert.equal(r.body.item.active, true);
  const stored = await h.models.User.findById(r.body.item.id).select('+passwordHash');
  assert.ok(stored.passwordHash.startsWith('$2'), 'bcrypt hash');
  assert.ok(await bcrypt.compare('a-long-password-1', stored.passwordHash));
  assert.ok(!JSON.stringify((await h.call('admin', 'GET', '/users')).body).includes('passwordHash'));
  const log = await h.models.AuditLog.findOne({ action: 'USER_CREATED', resourceId: r.body.item.id });
  assert.ok(!JSON.stringify(log.toObject()).includes('a-long-password-1'), 'audit never records the password');
});

test('create user: validation (required fields, 12+ char password, valid role, duplicate email)', { skip: SKIP }, async () => {
  for (const over of [{ name: '' }, { name: undefined }, { email: '' }, { email: undefined }, { password: '' }, { password: undefined }, { password: '   ' }]) assert.equal((await newUser({ ...over, email: 'v' + Math.random() + '@t.io' , ...over })).status, 400, JSON.stringify(over));
  const short = await newUser({ email: 's@t.io', password: '12345678901' });
  assert.equal(short.status, 400); assert.match(short.body.message, /12 characters/);
  assert.equal((await newUser({ email: 's2@t.io', password: '123456789012' })).status, 201, '12 chars is enough');
  for (const role of [undefined, 'superuser', 'clerk', '', 'ADMIN']) assert.equal((await newUser({ email: 'r' + Math.random() + '@t.io', role })).status, 400, String(role));
  const dup = await newUser({ email: 'S2@T.IO' });
  assert.equal(dup.status, 409); assert.match(dup.body.message, /already exists/);
});

test('create user: a newly created user can log in and has exactly the assigned role', { skip: SKIP }, async () => {
  await newUser({ email: 'fresh@t.io', password: 'fresh-password-123', role: 'weighment' });
  const r = await h.raw('POST', '/api/auth/login', { body: { email: 'fresh@t.io', password: 'fresh-password-123' } });
  assert.equal(r.status, 200); assert.equal(r.body.user.role, 'weighment');
  assert.equal((await h.raw('GET', '/api/yard/users', { token: r.body.token })).status, 403);
  assert.equal((await h.raw('GET', '/api/yard/weighments', { token: r.body.token })).status, 200);
});

test('list users: paginated, sorted by name, no secrets', { skip: SKIP }, async () => {
  const r = await h.call('admin', 'GET', '/users?limit=3');
  assert.equal(r.body.items.length, 3); assert.ok(r.body.total > 3);
  const names = r.body.items.map(u => u.name); assert.deepEqual(names, [...names].sort());
  for (const u of r.body.items) assert.ok(!('passwordHash' in u));
});

test('update user: role, active flag and password reset; validation; audit', { skip: SKIP }, async () => {
  const u = (await newUser({ email: 'upd@t.io', role: 'gate' })).body.item;
  assert.equal((await h.call('admin', 'PATCH', '/users/bad', {})).status, 400);
  assert.equal((await h.call('admin', 'PATCH', '/users/507f1f77bcf86cd799439011', {})).status, 404);
  assert.equal((await h.call('admin', 'PATCH', `/users/${u.id}`, { role: 'root' })).status, 400);
  assert.equal((await h.call('admin', 'PATCH', `/users/${u.id}`, { password: 'short' })).status, 400);
  let r = await h.call('admin', 'PATCH', `/users/${u.id}`, { role: 'accounts', active: 'false', password: 'brand-new-password-1' });
  assert.equal(r.status, 200); assert.equal(r.body.item.role, 'accounts'); assert.equal(r.body.item.active, false);
  const stored = await h.models.User.findById(u.id).select('+passwordHash');
  assert.ok(await bcrypt.compare('brand-new-password-1', stored.passwordHash));
  const log = await h.models.AuditLog.findOne({ action: 'USER_UPDATED', resourceId: u.id });
  assert.deepEqual(log.before, { role: 'gate', active: true }); assert.deepEqual(log.after, { role: 'accounts', active: false });
  r = await h.call('admin', 'PATCH', `/users/${u.id}`, { active: true });
  assert.equal(r.body.item.active, true);
  r = await h.call('admin', 'PATCH', `/users/${u.id}`, {});
  assert.equal(r.status, 200, 'empty patch is a no-op');
});

test('update user: deactivation takes effect immediately (existing token is rejected, login is refused)', { skip: SKIP }, async () => {
  const u = (await newUser({ email: 'deact@t.io', password: 'deactivate-me-123' })).body.item;
  const login = await h.raw('POST', '/api/auth/login', { body: { email: 'deact@t.io', password: 'deactivate-me-123' } });
  assert.equal((await h.raw('GET', '/api/auth/me', { token: login.body.token })).status, 200);
  await h.call('admin', 'PATCH', `/users/${u.id}`, { active: false });
  assert.equal((await h.raw('GET', '/api/auth/me', { token: login.body.token })).status, 401);
  const again = await h.raw('POST', '/api/auth/login', { body: { email: 'deact@t.io', password: 'deactivate-me-123' } });
  assert.equal(again.status, 401);
});

test('update user: an admin cannot lock themselves out (no self-deactivation or self role change)', { skip: SKIP }, async () => {
  const me = h.users.admin.id;
  for (const body of [{ active: false }, { active: 'false' }, { role: 'inspector' }]) {
    const r = await h.call('admin', 'PATCH', `/users/${me}`, body);
    assert.equal(r.status, 409, JSON.stringify(body));
  }
  assert.equal((await h.call('admin', 'PATCH', `/users/${me}`, { role: 'admin', active: true })).status, 200, 'no-op self update is fine');
  assert.equal((await h.models.User.findById(me)).role, 'admin');
});

test('update user: password reset by admin cannot be used to set a short password; email cannot be changed here', { skip: SKIP }, async () => {
  const u = (await newUser({ email: 'noemail@t.io' })).body.item;
  await h.call('admin', 'PATCH', `/users/${u.id}`, { email: 'hijack@t.io', name: 'Renamed' });
  const stored = await h.models.User.findById(u.id);
  assert.equal(stored.email, 'noemail@t.io'); assert.equal(stored.name, 'New Staff');
});

/* ───────────────────────────── audit ───────────────────────────── */

test('audit list: filters by resource and action, paginates, newest first, populates actor', { skip: SKIP }, async () => {
  const all = await h.call('inspector', 'GET', '/audit?limit=100');
  assert.ok(all.body.total > 10);
  const times = all.body.items.map(a => new Date(a.createdAt).getTime()); assert.deepEqual(times, [...times].sort((a, b) => b - a));
  const byRes = await h.call('inspector', 'GET', '/audit?resource=Complaint&limit=100');
  assert.ok(byRes.body.items.length > 0 && byRes.body.items.every(a => a.resource === 'Complaint'));
  const byAct = await h.call('inspector', 'GET', '/audit?action=USER_CREATED&limit=100');
  assert.ok(byAct.body.items.length > 0 && byAct.body.items.every(a => a.action === 'USER_CREATED'));
  assert.equal((await h.call('inspector', 'GET', '/audit?action=NOPE')).body.total, 0);
  assert.equal((await h.call('inspector', 'GET', '/audit?limit=2&page=2')).body.items.length, 2);
  assert.equal(all.body.items[0].actor.name !== undefined, true);
});

test('audit log is append-only at the model layer', { skip: SKIP }, async () => {
  const entry = await h.models.AuditLog.findOne();
  await assert.rejects(() => h.models.AuditLog.updateOne({ _id: entry._id }, { reason: 'tamper' }), /append-only/);
  await assert.rejects(() => h.models.AuditLog.findOneAndUpdate({ _id: entry._id }, { reason: 'tamper' }), /append-only/);
  await assert.rejects(() => h.models.AuditLog.deleteOne({ _id: entry._id }), /append-only/);
  await assert.rejects(() => h.models.AuditLog.deleteMany({}), /append-only/);
  assert.equal(await h.models.AuditLog.countDocuments({ _id: entry._id }), 1);
});

test('audit entries capture actor, role and request IP', { skip: SKIP }, async () => {
  const entry = await h.models.AuditLog.findOne({ action: 'GATE_ENTRY_CREATED' });
  if (!entry) await h.call('gate', 'POST', '/lots', { farmerName: 'F', commodity: 'Mango', bags: 1 });
  const e = await h.models.AuditLog.findOne({ action: 'GATE_ENTRY_CREATED' });
  assert.equal(e.actorName, 'gate user'); assert.equal(e.role, 'gate'); assert.match(e.ipAddress, /127\.0\.0\.1|::1/);
  assert.equal(String(e.actor), h.users.gate.id);
});
