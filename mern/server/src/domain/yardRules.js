export const ROLE_PERMISSIONS = Object.freeze({
  admin: ['*'],
  gate: ['dashboard:read','lots:read','lots:create','complaints:create','gatepass:read','gatepass:issue','gatepass:dispatch','reports:read'],
  auction: ['dashboard:read','lots:read','tickets:read','tickets:create','complaints:create','reports:read'],
  weighment: ['dashboard:read','lots:read','weighments:read','weighments:create','complaints:create','reports:read'],
  accounts: ['dashboard:read','lots:read','tickets:read','bills:read','payments:read','payments:create','buyers:read','buyers:write','complaints:create','reports:read'],
  inspector: ['dashboard:read','lots:read','tickets:read','weighments:read','bills:read','gatepass:read','complaints:read','complaints:write','audit:read','reports:read']
});
export function hasPermission(role, permission) {
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.includes('*') || permissions.includes(permission);
}
export function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}
export function calculateWeighment(gross, tare) {
  const grossValue = Number(gross), tareValue = Number(tare);
  if (!Number.isFinite(grossValue) || !Number.isFinite(tareValue) || grossValue <= 0 || tareValue < 0) throw new Error('Gross and tare readings must be valid non-negative numbers');
  const net = roundMoney(grossValue - tareValue);
  if (net <= 0) throw new Error('Gross weight must be greater than tare weight');
  return { gross: grossValue, tare: tareValue, net };
}
export function calculateBill({ netWeight, rate, sellerDeduction = 0, buyerMarketFee = 0, buyerOtherDues = 0 }) {
  const weight = Number(netWeight), price = Number(rate);
  if (!Number.isFinite(weight) || weight <= 0 || !Number.isFinite(price) || price <= 0) throw new Error('Net weight and auction rate must be positive values');
  const grossAmount = roundMoney(weight * price);
  const deductions = [Number(sellerDeduction), Number(buyerMarketFee), Number(buyerOtherDues)];
  if (deductions.some(value => !Number.isFinite(value) || value < 0)) throw new Error('Deductions and dues must be non-negative valid amounts');
  const approvedSellerDeduction = Math.min(grossAmount, deductions[0]);
  return { grossAmount, sellerDeduction: approvedSellerDeduction, farmerNetPayable: roundMoney(grossAmount - approvedSellerDeduction), buyerMarketFee: roundMoney(deductions[1]), buyerOtherDues: roundMoney(deductions[2]) };
}
export function outstandingBalance(total, paid) {
  return roundMoney(Math.max(0, Number(total || 0) - Number(paid || 0)));
}
export function isOverdue(balance, dueAt, now = new Date()) {
  return Number(balance) > 0 && Boolean(dueAt) && new Date(dueAt).getTime() < new Date(now).getTime();
}
export function isGatePassEligible({ farmerPayable, farmerPaid, buyerDues, buyerDuesPaid, traderBalance, traderDueAt, now = new Date() }) {
  if (outstandingBalance(farmerPayable, farmerPaid) > 0) return { eligible: false, reason: 'Farmer settlement is pending' };
  if (outstandingBalance(buyerDues, buyerDuesPaid) > 0) return { eligible: false, reason: 'Buyer-side approved dues are pending' };
  if (isOverdue(traderBalance, traderDueAt, now)) return { eligible: false, reason: 'Trader purchase credit is overdue' };
  return { eligible: true, reason: '' };
}