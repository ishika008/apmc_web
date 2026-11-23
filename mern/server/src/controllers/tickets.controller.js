import { AuctionTicket } from '../models/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { fail } from '../utils/httpError.js';
import { cleanPage } from '../utils/pagination.js';
import { auditContext } from '../services/audit.service.js';
import { issueTicket, voidTicket } from '../services/ticket.service.js';

export const listTickets = asyncHandler(async (req, res) => {
  const filter = { voidedAt: null };
  const { page, limit } = cleanPage(req);
  const items = await AuctionTicket.find(filter).populate('lot').populate('buyer','name registrationNo creditDays purchaseLimit').populate('issuedBy','name')
    .sort({ createdAt: -1 }).skip((page-1)*limit).limit(limit).lean();
  const total = await AuctionTicket.countDocuments(filter);
  res.json({ items, total, page, limit });
});

export const createTicket = asyncHandler(async (req, res) => {
  try {
    const ticket = await issueTicket(auditContext(req), req.body);
    res.status(201).json({ item: ticket });
  } catch (error) { if (error.code === 11000) throw fail(409, 'Lot is not available for auction'); throw error; }
});

export const voidTicketHandler = asyncHandler(async (req, res) => {
  const ticket = await voidTicket(auditContext(req), req.params.id, req.body);
  res.json({ item: ticket });
});
