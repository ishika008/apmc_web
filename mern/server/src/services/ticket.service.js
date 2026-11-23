import { Lot, Buyer, AuctionTicket, SaleBill } from '../models/index.js';
import { fail } from '../utils/httpError.js';
import { addDays } from '../utils/dates.js';
import { isId } from '../utils/validation.js';
import { nextNumber } from './counter.service.js';
import { getYardConfig } from './config.service.js';
import { sessionRun } from './transaction.js';
import { audit } from './audit.service.js';

export async function issueTicket(ctx, body) {
  const { lotId, buyerId, rate, quantity, quality, method, notes } = body || {};
  if (!isId(lotId) || !isId(buyerId)) throw fail(400, 'Select a valid lot and buyer');
  const price = Number(rate), qty = Number(quantity);
  if (!(price > 0) || !(qty > 0)) throw fail(400, 'Auction rate and quantity must be positive');
  const lot = await Lot.findById(lotId);
  if (!lot || lot.status !== 'arrived') throw fail(409, 'Lot is not available for auction');
  if (qty > Number(lot.estimated || 0) && Number(lot.estimated || 0) > 0) throw fail(400, 'Auction quantity cannot exceed estimated quantity');
  const buyer = await Buyer.findById(buyerId);
  if (!buyer || !buyer.active) throw fail(404, 'Active registered buyer not found');
  const bills = await SaleBill.find({ buyer: buyer._id, status: { $ne: 'cancelled' } });
  const outstanding = bills.reduce((sum, b) => sum + Math.max(0, b.grossAmount - b.buyerPurchasePaid), 0);
  const overdueBalance = bills.some(b => b.grossAmount > b.buyerPurchasePaid && b.buyerCreditDueAt && b.buyerCreditDueAt < new Date());
  const activeTickets = await AuctionTicket.find({ buyer: buyer._id, voidedAt: null });
  let pendingExposure = 0;
  for (const t of activeTickets) {
    const relatedLot = await Lot.findById(t.lot).select('billId status');
    if (relatedLot && !relatedLot.billId && relatedLot.status !== 'dispatched') pendingExposure += t.quantity * t.rate;
  }
  const exposure = outstanding + pendingExposure;
  if (overdueBalance) throw fail(409, 'Buyer is on credit hold: overdue purchase balance must be settled first');
  if (buyer.purchaseLimit > 0 && exposure + qty * price > buyer.purchaseLimit) throw fail(409, 'This bid would exceed the buyer purchase credit limit');
  const cfg = await getYardConfig();
  const issuedAt = new Date();
  const ticketNumber = `${cfg.ticketPrefix}-${issuedAt.getFullYear()}-${String(await nextNumber('ticket-' + issuedAt.getFullYear())).padStart(6,'0')}`;
  const ticket = await sessionRun(async session => {
    const created = await AuctionTicket.create([{
      ticketNumber, lot: lot._id, buyer: buyer._id, quantity: qty, rate: price,
      quality: String(quality || lot.quality), method: ['open_outcry','e_auction','approved_negotiated'].includes(method) ? method : 'open_outcry',
      notes: String(notes || ''), buyerCreditDays: buyer.creditDays,
      farmerPaymentDueAt: addDays(issuedAt, cfg.farmerPaymentDays),
      dispatchDueAt: addDays(issuedAt, cfg.dispatchDays),
      buyerCreditDueAt: addDays(issuedAt, buyer.creditDays), issuedBy: ctx.user._id
    }], { session });
    await Lot.updateOne({ _id: lot._id, status: 'arrived' }, {
      $set: { status: 'auctioned', ticketId: created[0]._id, buyerId: buyer._id, auctionRate: price }
    }, { session });
    return created[0];
  });
  await audit(ctx, 'AUCTION_TICKET_ISSUED', 'AuctionTicket', ticket._id, null, { ticketNumber, lotNumber: lot.lotNumber, buyer: buyer.name, rate: price, quantity: qty });
  return ticket;
}

export async function voidTicket(ctx, ticketId, body) {
  if (!isId(ticketId)) throw fail(400, 'Invalid ticket ID');
  const reason = String(body.reason || '').trim();
  if (reason.length < 8) throw fail(400, 'Provide a correction / cancellation reason (at least 8 characters)');
  const ticket = await AuctionTicket.findById(ticketId);
  if (!ticket || ticket.voidedAt) throw fail(404, 'Active ticket not found');
  const lot = await Lot.findById(ticket.lot);
  if (!lot || lot.billId) throw fail(409, 'A ticket linked to a sale bill cannot be voided');
  ticket.voidedAt = new Date(); ticket.voidReason = reason; await ticket.save();
  lot.status = 'arrived'; lot.ticketId = null; lot.buyerId = null; lot.auctionRate = null; await lot.save();
  await audit(ctx, 'AUCTION_TICKET_VOIDED', 'AuctionTicket', ticket._id, { ticketNumber: ticket.ticketNumber }, null, reason);
  return ticket;
}
