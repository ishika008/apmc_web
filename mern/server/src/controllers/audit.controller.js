import { AuditLog } from '../models/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { cleanPage } from '../utils/pagination.js';

export const listAuditLogs = asyncHandler(async (req, res) => {
  const { page, limit } = cleanPage(req);
  const filter = {};
  if (req.query.resource) filter.resource = req.query.resource;
  if (req.query.action) filter.action = req.query.action;
  const [items,total] = await Promise.all([
    AuditLog.find(filter).populate('actor','name email role').sort({createdAt:-1}).skip((page-1)*limit).limit(limit).lean(),
    AuditLog.countDocuments(filter)
  ]);
  res.json({items,total,page,limit});
});
