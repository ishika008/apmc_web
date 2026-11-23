import { Lot, Buyer, AuctionTicket, SaleBill, Complaint } from '../models/index.js';
import { roundMoney } from '../domain/yardRules.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getOverview = asyncHandler(async (req, res) => {
  const [totalLots, arrived, auctioned, weighed, dispatched, totalTickets, totalBills, totalComplaints, openComplaints, farmerRows, buyers] = await Promise.all([
    Lot.countDocuments(), Lot.countDocuments({ status: 'arrived' }), Lot.countDocuments({ status: 'auctioned' }),
    Lot.countDocuments({ status: 'weighed' }), Lot.countDocuments({ status: 'dispatched' }),
    AuctionTicket.countDocuments({ voidedAt: null }), SaleBill.countDocuments({ status: { $ne: 'cancelled' } }),
    Complaint.countDocuments(), Complaint.countDocuments({ status: { $in: ['open','investigating'] } }),
    SaleBill.aggregate([{ $match: { status: { $ne: 'cancelled' } } }, { $group: {
      _id: null, payable: { $sum: '$farmerNetPayable' }, paid: { $sum: '$farmerPaid' },
      traderGross: { $sum: '$grossAmount' }, traderPaid: { $sum: '$buyerPurchasePaid' },
      buyerDues: { $sum: { $add: ['$buyerMarketFee', '$buyerOtherDues'] } }, buyerDuesPaid: { $sum: '$buyerDuesPaid' }
    } }]),
    Buyer.countDocuments({ active: true })
  ]);
  const totals = farmerRows[0] || {};
  res.json({ stats: {
    totalLots, arrived, auctioned, weighed, dispatched, totalTickets, totalBills,
    totalComplaints, openComplaints, activeBuyers: buyers,
    farmerPayable: roundMoney(totals.payable || 0), farmerPaid: roundMoney(totals.paid || 0),
    farmerDue: roundMoney((totals.payable || 0) - (totals.paid || 0)),
    traderPurchase: roundMoney(totals.traderGross || 0), traderCollected: roundMoney(totals.traderPaid || 0),
    traderDue: roundMoney((totals.traderGross || 0) - (totals.traderPaid || 0)),
    buyerDues: roundMoney(totals.buyerDues || 0), buyerDuesPaid: roundMoney(totals.buyerDuesPaid || 0)
  }, role: req.user.role });
});
