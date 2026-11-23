import bcrypt from 'bcryptjs';
import { User } from '../models/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { fail } from '../utils/httpError.js';
import { cleanPage } from '../utils/pagination.js';
import { isId } from '../utils/validation.js';
import { audit, auditContext } from '../services/audit.service.js';

const publicUser = item => ({ id: item._id, name: item.name, email: item.email, role: item.role, active: item.active });

export const listUsers = asyncHandler(async (req, res) => {
  const { page, limit } = cleanPage(req);
  const [items, total] = await Promise.all([
    User.find().select('name email role active lastLoginAt createdAt').sort({ name: 1 })
      .skip((page - 1) * limit).limit(limit).lean(),
    User.countDocuments()
  ]);
  res.json({ items, total, page, limit });
});

export const createUser = asyncHandler(async (req, res) => {
  try {
    const { name, email, password, role } = req.body || {};
    if (!String(name || '').trim() || !String(email || '').trim() || !String(password || '').trim()) throw fail(400, 'Name, email and temporary password are required');
    if (String(password).length < 12) throw fail(400, 'Temporary password must be at least 12 characters');
    if (!['gate','auction','weighment','accounts','inspector','admin'].includes(role)) throw fail(400, 'Select a valid role');
    const passwordHash = await bcrypt.hash(password, 12);
    const item = await User.create({ name: name.trim(), email: email.toLowerCase().trim(), passwordHash, role });
    await audit(auditContext(req), 'USER_CREATED', 'User', item._id, null, { name: item.name, email: item.email, role: item.role });
    res.status(201).json({ item: publicUser(item) });
  } catch (error) { if (error.code === 11000) throw fail(409, 'A user with this email already exists'); throw error; }
});

export const updateUser = asyncHandler(async (req, res) => {
  try {
    if (!isId(req.params.id)) throw fail(400, 'Invalid user ID');
    const item = await User.findById(req.params.id);
    if (!item) throw fail(404, 'User not found');
    if (String(item._id) === String(req.user._id) && (req.body.active === false || req.body.active === 'false')) throw fail(409, 'You cannot deactivate your own account');
    const before = { role: item.role, active: item.active };
    if (String(item._id) === String(req.user._id) && req.body.role !== undefined && req.body.role !== item.role) throw fail(409, 'You cannot change your own role');
    if (req.body.role !== undefined) {
      if (!['admin','gate','auction','weighment','accounts','inspector'].includes(req.body.role)) throw fail(400, 'Invalid role');
      item.role = req.body.role;
    }
    if (req.body.active !== undefined) item.active = req.body.active === true || req.body.active === 'true';
    if (req.body.password) {
      if (String(req.body.password).length < 12) throw fail(400, 'New password must be at least 12 characters');
      item.passwordHash = await bcrypt.hash(req.body.password, 12);
    }
    await item.save();
    await audit(auditContext(req), 'USER_UPDATED', 'User', item._id, before, { role: item.role, active: item.active });
    res.json({ item: publicUser(item) });
  } catch (error) { if (error.code === 11000) throw fail(409, 'A user with this email already exists'); throw error; }
});
