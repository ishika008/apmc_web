import { Lot, AuctionTicket } from '../models/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { escapeRegex } from '../utils/validation.js';

/** Global search across lots and auction tickets (same read access as the list endpoints). */
export const search = asyncHandler(async (req, res) => {
  const term = String(req.query.q || '').trim().slice(0, 80);
  if (term.length < 2) return res.json({ lots: [], tickets: [] });
  const rx = { $regex: escapeRegex(term), $options: 'i' };
  const lotFilter = { $or: ['lotNumber', 'farmerName', 'mobile', 'commodity', 'vehicle'].map(k => ({ [k]: rx })) };
  const [lots, matchingLotIds] = await Promise.all([
    Lot.find(lotFilter).sort({ arrivalAt: -1 }).limit(8).select('lotNumber farmerName commodity status').lean(),
    Lot.find(lotFilter).limit(50).distinct('_id')
  ]);
  const tickets = await AuctionTicket.find({ voidedAt: null, $or: [{ ticketNumber: rx }, { lot: { $in: matchingLotIds } }] })
    .sort({ createdAt: -1 }).limit(5).populate('lot').populate('buyer', 'name').lean();
  res.json({ lots, tickets });
});
