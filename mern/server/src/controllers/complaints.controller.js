import { Complaint } from '../models/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { fail } from '../utils/httpError.js';
import { cleanPage } from '../utils/pagination.js';
import { isId } from '../utils/validation.js';
import { nextNumber } from '../services/counter.service.js';
import { getYardConfig } from '../services/config.service.js';
import { audit, auditContext } from '../services/audit.service.js';

export const listComplaints = asyncHandler(async (req, res) => {
  const filter = {};
  const { page, limit } = cleanPage(req);
  if (req.query.status) filter.status = req.query.status;
  const [items, total] = await Promise.all([
    Complaint.find(filter).populate('lot','lotNumber farmerName').populate('assignedTo','name').populate('createdBy','name')
      .sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Complaint.countDocuments(filter)
  ]);
  res.json({ items, total, page, limit });
});

export const createComplaint = asyncHandler(async (req, res) => {
  const { complainant, mobile, type, lotId, details, evidenceReferences } = req.body || {};
  if (!String(complainant || '').trim() || !String(type || '').trim() || String(details || '').trim().length < 10) throw fail(400, 'Complainant, complaint type and detailed description are required');
  if (lotId && !isId(lotId)) throw fail(400, 'Invalid linked lot');
  const cfg = await getYardConfig();
  const complaintNumber = `${cfg.complaintPrefix}-${new Date().getFullYear()}-${String(await nextNumber('complaint-' + new Date().getFullYear())).padStart(6,'0')}`;
  const item = await Complaint.create({
    complaintNumber, complainant: complainant.trim(), mobile, type, lot: lotId || null,
    details: details.trim(), evidenceReferences: (Array.isArray(evidenceReferences) ? evidenceReferences : String(evidenceReferences || '').split(/[\n,;]/)).map(x => String(x).trim()).filter(Boolean).slice(0,10),
    createdBy: req.user._id
  });
  await audit(auditContext(req), 'COMPLAINT_REGISTERED', 'Complaint', item._id, null, { complaintNumber, type, lotId });
  res.status(201).json({ item });
});

export const updateComplaint = asyncHandler(async (req, res) => {
  if (!isId(req.params.id)) throw fail(400, 'Invalid complaint ID');
  const item = await Complaint.findById(req.params.id);
  if (!item) throw fail(404, 'Complaint not found');
  const before = { status: item.status, resolution: item.resolution };
  if (req.body.status && !['open','investigating','resolved','rejected'].includes(req.body.status)) throw fail(400, 'Invalid complaint status');
  if (req.body.status) item.status = req.body.status;
  if (req.body.resolution !== undefined) item.resolution = String(req.body.resolution).trim();
  if (req.body.assignedTo) {
    if (!isId(req.body.assignedTo)) throw fail(400, 'Invalid assignee');
    item.assignedTo = req.body.assignedTo;
  }
  if (item.status === 'resolved' && !String(item.resolution || '').trim()) throw fail(400, 'A resolution note is required before closing a complaint');
  if (item.status === 'resolved') item.resolvedAt = new Date();
  await item.save();
  await audit(auditContext(req), 'COMPLAINT_UPDATED', 'Complaint', item._id, before, { status: item.status, resolution: item.resolution });
  res.json({ item });
});
