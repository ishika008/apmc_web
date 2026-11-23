import { Weighment } from '../models/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { cleanPage } from '../utils/pagination.js';
import { auditContext } from '../services/audit.service.js';
import { recordWeighment } from '../services/weighment.service.js';

export const listWeighments = asyncHandler(async (req, res) => {
  const { page, limit } = cleanPage(req);
  const [items, total] = await Promise.all([
    Weighment.find().populate('lot','lotNumber farmerName commodity vehicle').populate('recordedBy','name').sort({ createdAt: -1 }).skip((page-1)*limit).limit(limit).lean(),
    Weighment.countDocuments()
  ]);
  res.json({ items, total, page, limit });
});

export const createWeighment = asyncHandler(async (req, res) => {
  const { weighment, bill, corrected } = await recordWeighment(auditContext(req), req.body);
  res.status(corrected ? 200 : 201).json({ item: weighment, bill });
});
