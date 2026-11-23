import { Lot, SaleBill, GatePass } from '../models/index.js';
import { isGatePassEligible } from '../domain/yardRules.js';
import { fail } from '../utils/httpError.js';
import { isId } from '../utils/validation.js';
import { nextNumber } from './counter.service.js';
import { getYardConfig } from './config.service.js';
import { sessionRun } from './transaction.js';
import { audit } from './audit.service.js';

export async function issueGatePass(ctx, lotId, body) {
  if (!isId(lotId)) throw fail(400, 'Invalid lot ID');
  const lot = await Lot.findById(lotId);
  if (!lot || lot.status !== 'paid' || !lot.billId) throw fail(409, 'Farmer settlement must be completed before issuing a gate pass');
  const bill = await SaleBill.findById(lot.billId).populate('buyer');
  if (!bill) throw fail(404, 'Sale bill not found');
  const eligibility = isGatePassEligible({
    farmerPayable: bill.farmerNetPayable,
    farmerPaid: bill.farmerPaid,
    buyerDues: bill.buyerMarketFee + bill.buyerOtherDues,
    buyerDuesPaid: bill.buyerDuesPaid,
    traderBalance: bill.grossAmount - bill.buyerPurchasePaid,
    traderDueAt: bill.buyerCreditDueAt
  });
  if (!eligibility.eligible) throw fail(409, eligibility.reason);
  const cfg = await getYardConfig();
  const overdueDispatch = bill.dispatchDueAt && bill.dispatchDueAt < new Date();
  const overrideReason = String(body.overrideReason || '').trim();
  if (overdueDispatch && (ctx.user.role !== 'admin' || overrideReason.length < 8)) throw fail(409, 'Dispatch deadline is overdue. Administrator must provide an override reason');
  const passNumber = `${cfg.passPrefix}-${new Date().getFullYear()}-${String(await nextNumber('pass-' + new Date().getFullYear())).padStart(6,'0')}`;
  const item = await sessionRun(async session => {
    const created = await GatePass.create([{
      passNumber, lot: lot._id, bill: bill._id, vehicle: lot.vehicle, buyer: bill.buyer._id,
      issuedBy: ctx.user._id, overrideReason
    }], { session });
    await Lot.updateOne({ _id: lot._id, status: 'paid' }, { $set: { passNumber } }, { session });
    return created[0];
  });
  await audit(ctx, 'GATE_PASS_ISSUED', 'GatePass', item._id, null, { passNumber, lotNumber: lot.lotNumber }, overrideReason);
  return item;
}

export async function dispatchGatePass(ctx, passId) {
  if (!isId(passId)) throw fail(400, 'Invalid gate pass ID');
  const item = await GatePass.findById(passId);
  if (!item || item.status !== 'issued') throw fail(404, 'Issued gate pass not found');
  const result = await sessionRun(async session => {
    item.status = 'dispatched'; item.dispatchAt = new Date(); item.dispatchedBy = ctx.user._id; await item.save({ session });
    await Lot.updateOne({ _id: item.lot, status: 'paid', passNumber: item.passNumber }, { $set: { status: 'dispatched', dispatchAt: item.dispatchAt } }, { session });
    return item;
  });
  await audit(ctx, 'VEHICLE_EXIT_CONFIRMED', 'GatePass', item._id, { status: 'issued' }, { status: 'dispatched', dispatchAt: item.dispatchAt });
  return result;
}
