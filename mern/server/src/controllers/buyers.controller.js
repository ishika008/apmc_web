import { Buyer } from '../models/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { fail } from '../utils/httpError.js';
import { cleanPage } from '../utils/pagination.js';
import { isId } from '../utils/validation.js';
import { audit, auditContext } from '../services/audit.service.js';
import { computeBuyerLedgers } from '../services/buyerLedger.service.js';

export const listBuyers = asyncHandler(async (req, res) => {
  const filter = {};
  const { page, limit } = cleanPage(req);
  if (req.query.active !== undefined) filter.active = req.query.active === 'true';
  const searchTerm = String(req.query.search || '').trim().slice(0, 80);
  const safeSearch = Array.from(searchTerm).filter(ch => { const cp = ch.codePointAt(0); return /[A-Za-z0-9 _-]/.test(ch) || (cp >= 0x0A80 && cp <= 0x0AFF); }).join('');
  if (safeSearch) filter.name = { $regex: safeSearch, $options: 'i' };
  const [items, total] = await Promise.all([
    Buyer.find(filter).sort({ name: 1 }).skip((page - 1) * limit).limit(limit).lean(),
    Buyer.countDocuments(filter)
  ]);
  const ledgers = await computeBuyerLedgers(items);
  const empty = { gross: 0, paid: 0, dueFees: 0, outstanding: 0, exposure: 0, overdueCount: 0, limitFull: false };
  res.json({ items: items.map(x => ({ ...x, ledger: ledgers.get(String(x._id)) || empty })), total, page, limit });
});

export const createBuyer = asyncHandler(async (req, res) => {
  try {
    const { name, registrationNo, creditDays, purchaseLimit, notes } = req.body || {};
    if (!String(name || '').trim() || !String(registrationNo || '').trim()) throw fail(400, 'Trader name and registration ID are required');
    const item = await Buyer.create({ name: name.trim(), registrationNo: registrationNo.trim(),
      creditDays: Number(creditDays ?? 5), purchaseLimit: Number(purchaseLimit ?? 0), notes });
    await audit(auditContext(req), 'BUYER_CREATED', 'Buyer', item._id, null, { name: item.name, registrationNo: item.registrationNo });
    res.status(201).json({ item });
  } catch (error) { if (error.code === 11000) throw fail(409, 'A buyer with this name already exists'); throw error; }
});

export const updateBuyer = asyncHandler(async (req, res) => {
  if (!isId(req.params.id)) throw fail(400, 'Invalid buyer ID');
  const before = await Buyer.findById(req.params.id);
  if (!before) throw fail(404, 'Buyer not found');
  const allowed = ['name','registrationNo','creditDays','purchaseLimit','notes','active'];
  for (const key of allowed) if (req.body[key] !== undefined) before[key] = req.body[key];
  await before.save();
  await audit(auditContext(req), 'BUYER_UPDATED', 'Buyer', before._id, { name: before.name }, { name: before.name, registrationNo: before.registrationNo });
  res.json({ item: before });
});
