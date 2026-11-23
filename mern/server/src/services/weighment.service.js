import { Lot, AuctionTicket, Weighment, SaleBill } from '../models/index.js';
import { calculateWeighment, calculateBill } from '../domain/yardRules.js';
import { fail } from '../utils/httpError.js';
import { isId } from '../utils/validation.js';
import { nextNumber } from './counter.service.js';
import { getYardConfig } from './config.service.js';
import { sessionRun } from './transaction.js';
import { audit } from './audit.service.js';

/** Returns `{ weighment, bill, corrected }`. */
export async function recordWeighment(ctx, body) {
  const { lotId, gross, tare, scaleId, slipRef, notes, correctionReason } = body || {};
  if (!isId(lotId)) throw fail(400, 'Select a valid lot');
  let weight;
  try { weight = calculateWeighment(gross, tare); }
  catch (error) { throw fail(400, error.message); }
  const { gross: grossValue, tare: tareValue, net } = weight;
  const lot = await Lot.findById(lotId);
  if (!lot || !['auctioned','weighed'].includes(lot.status)) throw fail(409, 'Only an auctioned lot can be weighed');
  const prior = await Weighment.findOne({ lot: lot._id }).sort({ createdAt: -1 });
  const oldBill = lot.billId ? await SaleBill.findById(lot.billId) : null;
  if (prior) {
    if (ctx.user.role !== 'admin' || String(correctionReason || '').trim().length < 8) throw fail(409, 'A prior weighment exists. Only an administrator can record a correction with a reason');
    if (oldBill && (oldBill.farmerPaid > 0 || oldBill.buyerPurchasePaid > 0 || oldBill.buyerDuesPaid > 0)) throw fail(409, 'Payment has been recorded; bill correction requires an approved accounting adjustment workflow');
  }
  const ticket = await AuctionTicket.findOne({ _id: lot.ticketId, voidedAt: null }).populate('buyer');
  if (!ticket) throw fail(409, 'Active auction ticket not found');
  const cfg = await getYardConfig();
  const weightRecord = await sessionRun(async session => {
    const created = await Weighment.create([{
      lot: lot._id, gross: grossValue, tare: tareValue, net, scaleId, slipRef, notes,
      recordedBy: ctx.user._id, correctionOf: prior?._id || null, correctionReason: String(correctionReason || '')
    }], { session });
    const billAmounts = calculateBill({
      netWeight: net, rate: ticket.rate,
      sellerDeduction: cfg.sellerApprovedDeduction || 0,
      buyerMarketFee: cfg.buyerMarketFee || 0,
      buyerOtherDues: cfg.buyerOtherDues || 0
    });
    const billData = {
      lot: lot._id, ticket: ticket._id, buyer: ticket.buyer._id, farmerName: lot.farmerName,
      commodity: lot.commodity, netWeight: net, rate: ticket.rate, ...billAmounts,
      farmerPaymentDueAt: ticket.farmerPaymentDueAt, dispatchDueAt: ticket.dispatchDueAt, buyerCreditDueAt: ticket.buyerCreditDueAt
    };
    let bill;
    if (oldBill) {
      oldBill.set(billData); await oldBill.save({ session }); bill = oldBill;
    } else {
      const billNumber = `${cfg.billPrefix}-${new Date().getFullYear()}-${String(await nextNumber('bill-' + new Date().getFullYear())).padStart(6,'0')}`;
      const createdBill = await SaleBill.create([{ ...billData, billNumber, status: billData.farmerNetPayable <= 0 ? 'paid' : 'payment_pending' }], { session }); bill = createdBill[0];
    }
    await Lot.updateOne({ _id: lot._id }, { $set: {
      status: (Number(oldBill?.farmerPaid || 0) >= Number(billData.farmerNetPayable || 0)) ? 'paid' : 'weighed',
      grossWeight: grossValue, tareWeight: tareValue, netWeight: net,
      scaleId, slipRef, billId: bill._id
    } }, { session });
    return { weighment: created[0], bill };
  });
  await audit(ctx, prior ? 'WEIGHMENT_CORRECTED' : 'WEIGHMENT_RECORDED', 'Weighment', weightRecord.weighment._id, prior ? { gross: prior.gross, tare: prior.tare, net: prior.net } : null, { gross: grossValue, tare: tareValue, net }, String(correctionReason || ''));
  return { ...weightRecord, corrected: Boolean(prior) };
}
