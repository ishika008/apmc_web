import { GatePass } from '../models/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { fail } from '../utils/httpError.js';
import { cleanPage } from '../utils/pagination.js';
import { auditContext } from '../services/audit.service.js';
import { issueGatePass, dispatchGatePass } from '../services/gatePass.service.js';

export const listGatePasses = asyncHandler(async (req, res) => {
  const { page, limit } = cleanPage(req);
  const [items, total] = await Promise.all([
    GatePass.find().populate('lot','lotNumber farmerName commodity netWeight vehicle status')
      .populate('buyer','name registrationNo').populate('issuedBy','name').populate('dispatchedBy','name')
      .sort({ issuedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    GatePass.countDocuments()
  ]);
  res.json({ items, total, page, limit });
});

export const issuePass = asyncHandler(async (req, res) => {
  try {
    const item = await issueGatePass(auditContext(req), req.params.lotId, req.body);
    res.status(201).json({ item });
  } catch (error) { if (error.code === 11000) throw fail(409, 'A gate pass already exists for this lot'); throw error; }
});

export const dispatchPass = asyncHandler(async (req, res) => {
  const item = await dispatchGatePass(auditContext(req), req.params.id);
  res.json({ item });
});
