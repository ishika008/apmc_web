import { asyncHandler } from '../utils/asyncHandler.js';
import { fail } from '../utils/httpError.js';
import { getYardConfig } from '../services/config.service.js';
import { audit, auditContext } from '../services/audit.service.js';

export const getSettings = asyncHandler(async (_req, res) => {
  res.json({ item: await getYardConfig() });
});

export const updateSettings = asyncHandler(async (req, res) => {
  const item = await getYardConfig();
  const keys = ['committeeName','yardCode','timezone','ticketPrefix','billPrefix','passPrefix','complaintPrefix',
    'farmerPaymentDays','dispatchDays','defaultBuyerCreditDays','sellerApprovedDeduction','buyerMarketFee','buyerOtherDues','commodities'];
  const before = item.toObject();
  for (const key of keys) if (req.body[key] !== undefined) item[key] = req.body[key];
  if (!Array.isArray(item.commodities) || !item.commodities.length || item.commodities.some(x => !String(x).trim())) throw fail(400, 'At least one valid commodity is required');
  await item.save();
  await audit(auditContext(req), 'YARD_SETTINGS_UPDATED', 'YardConfig', item._id, before, item.toObject());
  res.json({ item });
});
