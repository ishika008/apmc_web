import { SaleBill, Payment } from '../models/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { fail } from '../utils/httpError.js';
import { cleanPage } from '../utils/pagination.js';
import { escapeRegex } from '../utils/validation.js';
import { auditContext } from '../services/audit.service.js';
import { recordPayment } from '../services/payment.service.js';

export const listBills = asyncHandler(async (req, res) => {
  const { page, limit } = cleanPage(req);
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.search) {
    const safe = escapeRegex(String(req.query.search).trim().slice(0,80));
    filter.$or = [{ billNumber: { $regex: safe, $options: 'i' } }, { farmerName: { $regex: safe, $options: 'i' } }];
  }
  const [items,total] = await Promise.all([
    SaleBill.find(filter).populate('buyer','name registrationNo').populate('lot','lotNumber vehicle').sort({createdAt:-1}).skip((page-1)*limit).limit(limit).lean(),
    SaleBill.countDocuments(filter)
  ]);
  res.json({ items,total,page,limit });
});

export const listPayments = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.type) filter.type = req.query.type;
  const { page, limit } = cleanPage(req);
  const [items,total] = await Promise.all([
    Payment.find(filter).populate('bill','billNumber farmerName').populate('lot','lotNumber').populate('recordedBy','name').sort({receivedAt:-1}).skip((page-1)*limit).limit(limit).lean(),
    Payment.countDocuments(filter)
  ]);
  res.json({ items,total,page,limit });
});

export const createPayment = asyncHandler(async (req, res) => {
  try {
    const result = await recordPayment(auditContext(req), req.body);
    res.status(201).json(result);
  } catch (error) { if (error.code === 11000) throw fail(409, 'This payment reference has already been recorded for this ledger'); throw error; }
});
