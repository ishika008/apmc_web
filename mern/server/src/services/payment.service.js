import { Lot, SaleBill, Payment } from '../models/index.js';
import { outstandingBalance, roundMoney } from '../domain/yardRules.js';
import { fail } from '../utils/httpError.js';
import { isId } from '../utils/validation.js';
import { nextNumber } from './counter.service.js';
import { sessionRun } from './transaction.js';
import { audit } from './audit.service.js';

export async function recordPayment(ctx, body) {
  const { billId, type, amount, mode, reference, notes } = body || {};
  if (!isId(billId)) throw fail(400, 'Select a valid sale bill');
  if (!['farmer_settlement','buyer_purchase','buyer_fee'].includes(type)) throw fail(400, 'Invalid payment ledger type');
  const value = outstandingBalance(Number(amount), 0);
  if (!(value > 0)) throw fail(400, 'Payment amount must be greater than zero');
  if (!['NEFT','RTGS','IMPS','UPI','BANK_TRANSFER','CASH_APPROVED'].includes(mode)) throw fail(400, 'Select a valid payment mode');
  if (mode === 'CASH_APPROVED' && ctx.user.role !== 'admin') throw fail(403, 'Cash receipt requires administrator approval');
  if (String(reference || '').trim().length < 4) throw fail(400, 'Bank UTR / receipt reference is required');
  const result = await sessionRun(async session => {
    const bill = await SaleBill.findById(billId).session(session);
    if (!bill || bill.status === 'cancelled') throw fail(404, 'Active sale bill not found');
    const field = type === 'farmer_settlement' ? 'farmerPaid' : type === 'buyer_purchase' ? 'buyerPurchasePaid' : 'buyerDuesPaid';
    const totalDue = type === 'farmer_settlement' ? bill.farmerNetPayable :
      type === 'buyer_purchase' ? bill.grossAmount : bill.buyerMarketFee + bill.buyerOtherDues;
    const outstanding = outstandingBalance(totalDue, bill[field]);
    if (value > outstanding + 0.001) throw fail(409, 'Payment exceeds outstanding balance of ₹' + outstanding);
    bill[field] = roundMoney(bill[field] + value);
    if (type === 'farmer_settlement') {
      bill.status = bill.farmerPaid >= bill.farmerNetPayable - 0.01 ? 'paid' : 'part_paid';
      if (bill.status === 'paid') await Lot.updateOne({ _id: bill.lot }, { $set: { status: 'paid' } }, { session });
    }
    await bill.save({ session });
    const receiptNumber = `RCPT-${new Date().getFullYear()}-${String(await nextNumber('receipt-' + new Date().getFullYear())).padStart(7,'0')}`;
    const records = await Payment.create([{
      receiptNumber, bill: bill._id, lot: bill.lot, type, amount: value, mode,
      reference: String(reference).trim(), notes, recordedBy: ctx.user._id
    }], { session });
    return { bill, payment: records[0], outstanding: outstandingBalance(outstanding, value) };
  });
  await audit(ctx, 'PAYMENT_RECORDED', 'Payment', result.payment._id, null, {
    receiptNumber: result.payment.receiptNumber, bill: result.bill.billNumber, type, amount: value, mode
  });
  return result;
}
