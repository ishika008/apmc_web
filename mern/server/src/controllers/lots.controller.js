import { Lot, AuctionTicket, Weighment, SaleBill, GatePass, Complaint } from '../models/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { fail } from '../utils/httpError.js';
import { cleanPage } from '../utils/pagination.js';
import { isId, escapeRegex } from '../utils/validation.js';
import { dateKey } from '../utils/dates.js';
import { nextNumber } from '../services/counter.service.js';
import { getYardConfig } from '../services/config.service.js';
import { audit, auditContext } from '../services/audit.service.js';

export const listLots = asyncHandler(async (req, res) => {
  const { page, limit } = cleanPage(req);
  const filter = {};
  if (req.query.status && req.query.status !== 'all') filter.status = req.query.status;
  if (req.query.search) {
    const term = String(req.query.search).trim().slice(0, 80);
    const safe = escapeRegex(term);
    filter.$or = ['lotNumber','farmerName','mobile','commodity','vehicle','village'].map(key => ({ [key]: { $regex: safe, $options: 'i' } }));
  }
  if (req.query.from || req.query.to) {
    filter.arrivalAt = {};
    if (req.query.from) filter.arrivalAt.$gte = new Date(req.query.from);
    if (req.query.to) filter.arrivalAt.$lte = new Date(req.query.to);
    if (Object.values(filter.arrivalAt).some(d => Number.isNaN(d.getTime()))) throw fail(400, 'Invalid date filter');
  }
  const [items, total] = await Promise.all([
    Lot.find(filter).populate('buyerId','name registrationNo').populate('createdBy','name role')
      .sort({ arrivalAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Lot.countDocuments(filter)
  ]);
  res.json({ items, total, page, limit });
});

export const createLot = asyncHandler(async (req, res) => {
  const v = req.body || {};
  const required = ['farmerName','commodity'];
  for (const key of required) if (!String(v[key] || '').trim()) throw fail(400, key + ' is required');
  if (v.sellerType === 'trader' && !String(v.traderRegistrationNo || '').trim()) throw fail(400, 'Trader registration / licence ID is required for trader sellers');
  const bags = Number(v.bags);
  if (!Number.isInteger(bags) || bags < 1) throw fail(400, 'Bags must be a positive whole number');
  if (v.mobile && !/^[0-9 +()-]{8,18}$/.test(v.mobile)) throw fail(400, 'Enter a valid contact number');
  const cfg = await getYardConfig();
  if (!cfg.commodities.includes(v.commodity)) throw fail(400, 'Select a commodity from the approved master list');
  const lotNumber = `LOT-${dateKey()}-${String(await nextNumber('lot-' + dateKey())).padStart(4,'0')}`;
  const item = await Lot.create({
    lotNumber, sellerType: v.sellerType === 'trader' ? 'trader' : 'farmer',
    farmerName: String(v.farmerName).trim(), mobile: String(v.mobile || '').trim(),
    farmerRegistryId: String(v.farmerRegistryId || '').trim(), landRecordType: String(v.landRecordType || '').trim(),
    landRecordNo: String(v.landRecordNo || '').trim(), traderRegistrationNo: String(v.traderRegistrationNo || '').trim(),
    state: String(v.state || 'Gujarat').trim(), district: String(v.district || '').trim(),
    taluka: String(v.taluka || '').trim(), village: String(v.village || '').trim(), commodity: v.commodity,
    bags, vehicle: String(v.vehicle || '').trim().toUpperCase(), estimated: Math.max(0, Number(v.estimated || 0)),
    quality: String(v.quality || 'FAQ').trim(), notes: String(v.notes || '').trim(), createdBy: req.user._id
  });
  await audit(auditContext(req), 'GATE_ENTRY_CREATED', 'Lot', item._id, null, { lotNumber, farmerName: item.farmerName, commodity: item.commodity });
  res.status(201).json({ item });
});

export const getLot = asyncHandler(async (req, res) => {
  if (!isId(req.params.id)) throw fail(400, 'Invalid lot ID');
  const item = await Lot.findById(req.params.id).populate('buyerId','name registrationNo').populate('createdBy','name role').lean();
  if (!item) throw fail(404, 'Lot not found');
  const [ticket, weighments, bill, pass, complaints] = await Promise.all([
    AuctionTicket.findOne({ lot: item._id, voidedAt: null }).populate('buyer','name registrationNo').lean(),
    Weighment.find({ lot: item._id }).populate('recordedBy','name').sort({ createdAt: 1 }).lean(),
    SaleBill.findOne({ lot: item._id }).populate('buyer','name registrationNo').lean(),
    GatePass.findOne({ lot: item._id }).lean(),
    Complaint.find({ lot: item._id }).sort({ createdAt: -1 }).lean()
  ]);
  res.json({ item, ticket, weighments, bill, pass, complaints });
});
