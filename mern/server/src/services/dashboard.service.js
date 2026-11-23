import { Lot, AuctionTicket, SaleBill, GatePass, Complaint, AuditLog } from '../models/index.js';
import { roundMoney } from '../domain/yardRules.js';

const IST_OFFSET_MS = 5.5 * 3600 * 1000;
const startOfTodayIST = () => new Date(Math.floor((Date.now() + IST_OFFSET_MS) / 86400000) * 86400000 - IST_OFFSET_MS);
const provisional = t => roundMoney((t.quantity || 0) * (t.rate || 0));

/** Live yard snapshot for the dashboard. Everything is computed from the database. */
export async function buildDashboard(user) {
  const now = new Date();
  const [stockLots, activeTickets, openBills, passesIssued, dispatched, hourly, recentLots, activity] = await Promise.all([
    Lot.find({ status: { $ne: 'dispatched' } }).sort({ arrivalAt: -1 }).limit(200)
      .select('lotNumber farmerName sellerType village commodity bags vehicle status estimated netWeight buyerId arrivalAt')
      .populate('buyerId', 'name').lean(),
    AuctionTicket.find({ voidedAt: null }).sort({ createdAt: -1 }).limit(500)
      .select('ticketNumber lot buyer quantity rate farmerPaymentDueAt dispatchDueAt buyerCreditDueAt')
      .populate('lot', 'lotNumber farmerName sellerType billId status').populate('buyer', 'name registrationNo creditDays').lean(),
    SaleBill.find({ status: { $ne: 'cancelled' } }).sort({ createdAt: -1 }).limit(500)
      .select('billNumber farmerName farmerNetPayable farmerPaid grossAmount buyerPurchasePaid farmerPaymentDueAt buyerCreditDueAt buyer')
      .populate('buyer', 'name registrationNo creditDays').lean(),
    GatePass.countDocuments(),
    Lot.countDocuments({ status: 'dispatched' }),
    Lot.aggregate([
      { $match: { arrivalAt: { $gte: startOfTodayIST() } } },
      { $group: { _id: { $hour: { date: '$arrivalAt', timezone: 'Asia/Kolkata' } }, lots: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]),
    Lot.find().sort({ arrivalAt: -1 }).limit(5).select('lotNumber farmerName village commodity bags arrivalAt status').lean(),
    // Audit data is restricted to admin/inspector on /yard/audit; keep the same rule here.
    ['admin', 'inspector'].includes(user.role)
      ? AuditLog.find().sort({ createdAt: -1 }).limit(5).select('action actorName resource resourceId createdAt').lean()
      : Promise.resolve([])
  ]);

  const dueByLot = new Map(activeTickets.filter(t => t.lot).map(t => [String(t.lot._id), t]));
  const stock = stockLots.map(l => {
    const t = dueByLot.get(String(l._id));
    return { ...l, dispatchDueAt: t?.dispatchDueAt || null };
  });
  const quintalsInside = roundMoney(stockLots.reduce((s, l) => s + Number(l.netWeight || l.estimated || 0), 0));

  const unbilled = activeTickets.filter(t => t.lot && !t.lot.billId && t.lot.status !== 'dispatched');
  const farmerDues = [
    ...openBills.filter(b => b.farmerNetPayable > b.farmerPaid).slice(0, 50).map(b => ({
      kind: 'bill', farmer: b.farmerName, reference: b.billNumber, payable: b.farmerNetPayable, paid: b.farmerPaid,
      balance: roundMoney(b.farmerNetPayable - b.farmerPaid), dueAt: b.farmerPaymentDueAt
    })),
    ...unbilled.filter(t => t.lot.sellerType !== 'trader').slice(0, 50).map(t => ({
      kind: 'provisional', farmer: t.lot.farmerName, reference: t.ticketNumber, lotNumber: t.lot.lotNumber,
      payable: provisional(t), paid: 0, balance: provisional(t), dueAt: t.farmerPaymentDueAt
    }))
  ];
  const farmerTotals = openBills.reduce((a, b) => ({ payable: a.payable + b.farmerNetPayable, paid: a.paid + b.farmerPaid }), { payable: 0, paid: 0 });

  const traders = new Map();
  const slot = buyer => {
    const key = String(buyer._id);
    if (!traders.has(key)) traders.set(key, { buyerId: key, name: buyer.name, registrationNo: buyer.registrationNo, creditDays: buyer.creditDays, paid: 0, due: 0, overdue: false });
    return traders.get(key);
  };
  for (const b of openBills) {
    if (!b.buyer) continue;
    const row = slot(b.buyer);
    const unpaid = Math.max(0, b.grossAmount - b.buyerPurchasePaid);
    row.paid += b.buyerPurchasePaid; row.due += unpaid;
    if (unpaid > 0 && b.buyerCreditDueAt && b.buyerCreditDueAt < now) row.overdue = true;
  }
  for (const t of unbilled) {
    if (!t.buyer) continue;
    const row = slot(t.buyer);
    row.due += provisional(t);
    if (t.buyerCreditDueAt && t.buyerCreditDueAt < now) row.overdue = true;
  }
  const traderDues = [...traders.values()].filter(r => r.due > 0).map(r => ({ ...r, paid: roundMoney(r.paid), due: roundMoney(r.due) }));

  const byHour = new Map(hourly.map(h => [h._id, h.lots]));
  return {
    status: { auctionPending: stockLots.filter(l => l.status === 'arrived').length, passesIssued, dispatched, inYard: stockLots.length, quintalsInside },
    stock, farmerDues, traderDues, recentLots, activity,
    farmerTotals: { payable: roundMoney(farmerTotals.payable), paid: roundMoney(farmerTotals.paid), due: roundMoney(farmerTotals.payable - farmerTotals.paid),
      provisional: roundMoney(unbilled.filter(t => t.lot.sellerType !== 'trader').reduce((s, t) => s + provisional(t), 0)) },
    arrivalsByHour: Array.from({ length: 24 }, (_, hour) => ({ hour, lots: byHour.get(hour) || 0 })),
    generatedAt: now.toISOString()
  };
}

/** Lightweight counters for sidebar badges and the notification bell. */
export async function buildNavCounts() {
  const now = new Date();
  const [openComplaints, auctionQueue, farmerOverdue, buyerOverdue, dispatchOverdue] = await Promise.all([
    Complaint.countDocuments({ status: { $in: ['open', 'investigating'] } }),
    Lot.countDocuments({ status: 'arrived' }),
    SaleBill.countDocuments({ status: { $in: ['payment_pending', 'part_paid'] }, farmerPaymentDueAt: { $lt: now }, $expr: { $gt: ['$farmerNetPayable', '$farmerPaid'] } }),
    SaleBill.countDocuments({ status: { $ne: 'cancelled' }, buyerCreditDueAt: { $lt: now }, $expr: { $gt: ['$grossAmount', '$buyerPurchasePaid'] } }),
    AuctionTicket.aggregate([
      { $match: { voidedAt: null, dispatchDueAt: { $lt: now } } },
      { $lookup: { from: 'lots', localField: 'lot', foreignField: '_id', as: 'l' } },
      { $match: { 'l.status': { $nin: ['dispatched'] } } },
      { $count: 'n' }
    ]).then(r => r[0]?.n || 0)
  ]);
  return { openComplaints, auctionQueue, farmerOverdue, buyerOverdue, dispatchOverdue };
}
