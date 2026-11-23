import { Lot, AuctionTicket, Weighment, SaleBill, Payment, Complaint, AuditLog } from '../models/index.js';
import { roundMoney } from '../domain/yardRules.js';

// Prefixing risky leading characters stops spreadsheet formula injection from user-entered text.
const cell = v => {
  let s = v instanceof Date ? v.toISOString() : String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
};
const name = v => v?.name || '';

export const DATASETS = {
  lots: {
    file: 'apmc-lot-register.csv', model: Lot, populate: [['createdBy', 'name']], sort: { arrivalAt: -1 },
    headers: ['Lot ID', 'Seller type', 'Seller', 'Mobile', 'Village', 'Commodity', 'Bags', 'Vehicle', 'Arrival', 'Status', 'Net Q'],
    row: l => [l.lotNumber, l.sellerType, l.farmerName, l.mobile, l.village, l.commodity, l.bags, l.vehicle, l.arrivalAt, l.status, l.netWeight]
  },
  tickets: {
    file: 'apmc-auction-tickets.csv', model: AuctionTicket, populate: [['lot', 'lotNumber farmerName commodity'], ['buyer', 'name']], sort: { createdAt: -1 }, filter: { voidedAt: null },
    headers: ['Ticket', 'Lot ID', 'Farmer', 'Buyer', 'Commodity', 'Quantity Q', 'Rate per Q', 'Method', 'Issued at'],
    row: t => [t.ticketNumber, t.lot?.lotNumber, t.lot?.farmerName, name(t.buyer), t.lot?.commodity, t.quantity, t.rate, t.method, t.createdAt]
  },
  weighments: {
    file: 'apmc-weighments.csv', model: Weighment, populate: [['lot', 'lotNumber farmerName'], ['recordedBy', 'name']], sort: { createdAt: -1 },
    headers: ['Lot ID', 'Farmer', 'Gross Q', 'Tare Q', 'Net Q', 'Scale', 'Slip', 'Correction reason', 'Recorded by', 'Time'],
    row: w => [w.lot?.lotNumber, w.lot?.farmerName, w.gross, w.tare, w.net, w.scaleId, w.slipRef, w.correctionReason, name(w.recordedBy), w.createdAt]
  },
  bills: {
    file: 'apmc-sale-bills.csv', model: SaleBill, populate: [['buyer', 'name'], ['lot', 'lotNumber']], sort: { createdAt: -1 },
    headers: ['Bill', 'Lot ID', 'Farmer', 'Buyer', 'Net Q', 'Rate', 'Gross', 'Seller deductions', 'Farmer net payable', 'Farmer paid', 'Status', 'Buyer purchase paid', 'Buyer market fee', 'Buyer other dues', 'Buyer dues paid'],
    row: b => [b.billNumber, b.lot?.lotNumber, b.farmerName, name(b.buyer), b.netWeight, b.rate, b.grossAmount, b.sellerDeduction, b.farmerNetPayable, b.farmerPaid, b.status, b.buyerPurchasePaid, b.buyerMarketFee, b.buyerOtherDues, b.buyerDuesPaid]
  },
  payments: {
    file: 'apmc-payments.csv', model: Payment, populate: [['bill', 'billNumber farmerName'], ['lot', 'lotNumber'], ['recordedBy', 'name']], sort: { receivedAt: -1 },
    headers: ['Receipt', 'Bill', 'Lot ID', 'Ledger', 'Amount', 'Mode', 'Reference', 'Recorded by', 'Received at'],
    row: p => [p.receiptNumber, p.bill?.billNumber, p.lot?.lotNumber, p.type, p.amount, p.mode, p.reference, name(p.recordedBy), p.receivedAt]
  },
  complaints: {
    file: 'apmc-complaints.csv', model: Complaint, populate: [['lot', 'lotNumber']], sort: { createdAt: -1 },
    headers: ['Complaint', 'Complainant', 'Type', 'Lot ID', 'Status', 'Details', 'Resolution', 'Opened at'],
    row: c => [c.complaintNumber, c.complainant, c.type, c.lot?.lotNumber, c.status, c.details, c.resolution, c.createdAt]
  },
  audit: {
    file: 'apmc-audit-log.csv', model: AuditLog, populate: [], sort: { createdAt: -1 },
    headers: ['Time', 'Actor', 'Role', 'Action', 'Resource', 'Reference', 'Reason'],
    row: a => [a.createdAt, a.actorName, a.role, a.action, a.resource, a.resourceId, a.reason]
  }
};

export const EXPORT_ROW_LIMIT = 50000;

/** Streams a dataset as UTF-8 (BOM) CSV to `res`. */
export async function streamCsv(key, res) {
  const d = DATASETS[key];
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${d.file}"`);
  res.write('﻿' + d.headers.map(cell).join(',') + '\r\n');
  let query = d.model.find(d.filter || {}).sort(d.sort).limit(EXPORT_ROW_LIMIT);
  for (const [path, select] of d.populate) query = query.populate(path, select);
  for await (const doc of query.lean().cursor()) res.write(d.row(doc).map(cell).join(',') + '\r\n');
  res.end();
}

export async function buildCatalog() {
  const [lots, tickets, weighments, bills, payments, complaints, audit, rate, sales, paidBills] = await Promise.all([
    Lot.countDocuments(), AuctionTicket.countDocuments({ voidedAt: null }), Weighment.countDocuments(),
    SaleBill.countDocuments({ status: { $ne: 'cancelled' } }), Payment.countDocuments(), Complaint.countDocuments(), AuditLog.countDocuments(),
    AuctionTicket.aggregate([{ $match: { voidedAt: null } }, { $group: { _id: null, avg: { $avg: '$rate' } } }]),
    SaleBill.aggregate([{ $match: { status: { $ne: 'cancelled' } } }, { $group: { _id: null, gross: { $sum: '$grossAmount' }, payable: { $sum: '$farmerNetPayable' }, paid: { $sum: '$farmerPaid' } } }]),
    SaleBill.countDocuments({ status: 'paid' })
  ]);
  const s = sales[0] || {};
  return {
    counts: { lots, tickets, weighments, bills, payments, complaints, audit, paidBills },
    kpis: { averageRate: roundMoney(rate[0]?.avg || 0), grossSales: roundMoney(s.gross || 0), pendingPayable: roundMoney((s.payable || 0) - (s.paid || 0)) }
  };
}
