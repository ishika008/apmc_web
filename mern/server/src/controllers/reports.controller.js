import { Lot, AuctionTicket, SaleBill, Payment, Complaint } from '../models/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { fail } from '../utils/httpError.js';
import { DATASETS, streamCsv, buildCatalog } from '../services/reports.service.js';

export const getSummary = asyncHandler(async (req, res) => {
  const from = req.query.from ? new Date(req.query.from) : new Date(new Date().setHours(0,0,0,0));
  const to = req.query.to ? new Date(req.query.to) : new Date();
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) throw fail(400, 'Invalid report date range');
  const filter = { createdAt: { $gte: from, $lte: to } };
  const [lots,tickets,bills,payments,complaints] = await Promise.all([
    Lot.countDocuments({ arrivalAt: { $gte: from, $lte: to } }),
    AuctionTicket.countDocuments({ ...filter, voidedAt: null }),
    SaleBill.aggregate([{ $match: filter }, { $group: { _id:null, bills:{$sum:1}, gross:{$sum:'$grossAmount'}, farmerPayable:{$sum:'$farmerNetPayable'}, farmerPaid:{$sum:'$farmerPaid'} } }]),
    Payment.aggregate([{ $match: { receivedAt: { $gte: from, $lte: to } } }, { $group: { _id:'$type', amount:{$sum:'$amount'}, count:{$sum:1} } }]),
    Complaint.countDocuments(filter)
  ]);
  res.json({ from, to, lots, tickets, bills: bills[0] || { bills:0,gross:0,farmerPayable:0,farmerPaid:0 }, payments, complaints });
});

export const getCatalog = asyncHandler(async (_req, res) => res.json(await buildCatalog()));

export const exportDataset = asyncHandler(async (req, res) => {
  if (!Object.hasOwn(DATASETS, req.params.dataset || 'audit')) throw fail(404, 'Unknown report');
  await streamCsv(req.params.dataset || 'audit', res);
});
