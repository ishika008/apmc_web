import { SaleBill, AuctionTicket } from '../models/index.js';
import { roundMoney } from '../domain/yardRules.js';

/**
 * Per-buyer purchase ledger used by the buyer ledger screen.
 * `outstanding` = unpaid on sale bills; `exposure` additionally counts auctioned
 * lots that are not billed yet (same rule the ticket credit check uses).
 */
export async function computeBuyerLedgers(buyers) {
  const ids = buyers.map(b => b._id);
  const now = new Date();
  const [bills, tickets] = await Promise.all([
    SaleBill.find({ buyer: { $in: ids }, status: { $ne: 'cancelled' } })
      .select('buyer grossAmount buyerPurchasePaid buyerMarketFee buyerOtherDues buyerDuesPaid buyerCreditDueAt').lean(),
    AuctionTicket.find({ buyer: { $in: ids }, voidedAt: null }).select('buyer lot quantity rate buyerCreditDueAt')
      .populate('lot', 'billId status').lean()
  ]);
  const ledger = new Map(ids.map(id => [String(id), { gross: 0, paid: 0, dueFees: 0, outstanding: 0, pendingExposure: 0, overdueCount: 0 }]));
  for (const b of bills) {
    const row = ledger.get(String(b.buyer));
    const unpaid = Math.max(0, (b.grossAmount || 0) - (b.buyerPurchasePaid || 0));
    row.gross += b.grossAmount || 0;
    row.paid += b.buyerPurchasePaid || 0;
    row.dueFees += (b.buyerMarketFee || 0) + (b.buyerOtherDues || 0) - (b.buyerDuesPaid || 0);
    row.outstanding += unpaid;
    if (unpaid > 0 && b.buyerCreditDueAt && b.buyerCreditDueAt < now) row.overdueCount += 1;
  }
  for (const t of tickets) {
    if (!t.lot || t.lot.billId || t.lot.status === 'dispatched') continue;
    const row = ledger.get(String(t.buyer));
    row.pendingExposure += t.quantity * t.rate;
    if (t.buyerCreditDueAt && t.buyerCreditDueAt < now) row.overdueCount += 1;
  }
  return new Map(buyers.map(b => {
    const row = ledger.get(String(b._id));
    const exposure = roundMoney(row.outstanding + row.pendingExposure);
    return [String(b._id), {
      gross: row.gross, paid: row.paid, dueFees: row.dueFees,
      outstanding: roundMoney(row.outstanding), exposure, overdueCount: row.overdueCount,
      limitFull: b.purchaseLimit > 0 && exposure >= b.purchaseLimit
    }];
  }));
}
