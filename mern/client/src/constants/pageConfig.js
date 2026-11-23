import { roles } from './roles.js';
import { t } from '../i18n/index.js';

/**
 * Per-screen configuration for ModuleScreen. Text is stored as translation KEYS (titleKey, subtitleKey,
 * createLabelKey and the second item of each column) and resolved with t() at render time, so the language can
 * change at runtime. Use `columnsFor(page)` to get columns as [dataKey, translatedLabel] pairs.
 */
export const pageConfig = {
  gate: {
    titleKey: 'yard.page.gate.title', subtitleKey: 'yard.page.gate.subtitle',
    endpoint: '/yard/lots', createLabelKey: 'yard.page.gate.create', createRoles: ['admin','gate'],
    columns: [
      ['lotNumber','yard.col.lotId'],['farmerName','yard.col.seller'],['sellerType','yard.col.sellerType'],
      ['commodity','yard.col.commodity'],['bags','yard.col.bags'],['vehicle','yard.col.vehicleNo'],['village','yard.col.village'],['status','yard.col.stage'],['arrivalAt','yard.col.arrivalTime']
    ]
  },
  auction: {
    titleKey: 'yard.page.auction.title', subtitleKey: 'yard.page.auction.subtitle',
    endpoint: '/yard/tickets', createLabelKey: 'yard.page.auction.create', createRoles: ['admin','auction'],
    columns: [['ticketNumber','yard.col.ticketNo'],['lot.lotNumber','yard.col.lotId'],['lot.farmerName','yard.col.farmer'],['buyer.name','yard.col.buyer'],['quantity','yard.col.quantity'],['rate','yard.col.ratePerQ'],['createdAt','yard.col.ticketTime']]
  },
  weighment: {
    titleKey: 'yard.page.weighment.title', subtitleKey: 'yard.page.weighment.subtitle',
    endpoint: '/yard/weighments', createLabelKey: 'yard.page.weighment.create', createRoles: ['admin','weighment'],
    columns: [['lot.lotNumber','yard.col.lotId'],['lot.farmerName','yard.col.farmer'],['gross','yard.col.gross'],['tare','yard.col.tare'],['net','yard.col.net'],['scaleId','yard.col.scaleId'],['slipRef','yard.col.slipRef'],['createdAt','yard.col.time']]
  },
  sales: {
    titleKey: 'yard.page.sales.title', subtitleKey: 'yard.page.sales.subtitle',
    endpoint: '/yard/bills', columns: [
      ['billNumber','yard.col.billNo'],['lot.lotNumber','yard.col.lotId'],['farmerName','yard.col.farmer'],['buyer.name','yard.col.buyer'],
      ['netWeight','yard.col.net'],['rate','yard.col.ratePerQ'],['grossAmount','yard.col.grossAmount'],['farmerNetPayable','yard.col.farmerPayable'],['status','yard.col.status']
    ]
  },
  payments: {
    titleKey: 'yard.page.payments.title', subtitleKey: 'yard.page.payments.subtitle',
    endpoint: '/yard/payments', createLabelKey: 'yard.page.payments.create', createRoles: ['admin','accounts'],
    columns: [['receiptNumber','yard.col.receipt'],['bill.billNumber','yard.col.bill'],['type','yard.col.ledgerType'],['amount','yard.col.amount'],['mode','yard.col.mode'],['reference','yard.col.utrRef'],['receivedAt','yard.col.paymentTime']]
  },
  buyerledger: {
    titleKey: 'yard.page.buyerledger.title', subtitleKey: 'yard.page.buyerledger.subtitle',
    endpoint: '/yard/buyers', createLabelKey: 'yard.page.buyerledger.create', createRoles: ['admin','accounts'],
    columns: [['name','yard.col.trader'],['registrationNo','yard.col.licenceReg'],['creditDays','yard.col.creditDays'],['purchaseLimit','yard.col.purchaseLimit'],['ledger.gross','yard.col.purchaseValue'],['ledger.paid','yard.col.paid'],['ledger.outstanding','yard.col.outstanding'],['ledger.exposure','yard.col.exposure'],['creditStatus','yard.col.creditStatus'],['active','yard.col.active']]
  },
  gatepass: {
    titleKey: 'yard.page.gatepass.title', subtitleKey: 'yard.page.gatepass.subtitle',
    endpoint: '/yard/gate-passes', createLabelKey: 'yard.page.gatepass.create', createRoles: ['admin','gate'],
    columns: [['passNumber','yard.col.passNo'],['lot.lotNumber','yard.col.lotId'],['lot.farmerName','yard.col.farmer'],['buyer.name','yard.col.buyer'],['vehicle','yard.col.vehicle'],['status','yard.col.status'],['issuedAt','yard.col.issued'],['dispatchAt','yard.col.dispatch']]
  },
  disputes: {
    titleKey: 'yard.page.disputes.title', subtitleKey: 'yard.page.disputes.subtitle',
    endpoint: '/yard/complaints', createLabelKey: 'yard.page.disputes.create', createRoles: Object.keys(roles),
    columns: [['complaintNumber','yard.col.complaintId'],['complainant','yard.col.complainant'],['type','yard.col.type'],['lot.lotNumber','yard.col.lotId'],['status','yard.col.status'],['createdAt','yard.col.noted']]
  },
  audit: {
    titleKey: 'yard.page.audit.title', subtitleKey: 'yard.page.audit.subtitle',
    endpoint: '/yard/audit',
    columns: [['createdAt','yard.col.timestamp'],['actorName','yard.col.user'],['role','yard.col.role'],['action','yard.col.action'],['resource','yard.col.module'],['resourceId','yard.col.reference'],['reason','yard.col.reason']]
  },
  users: {
    titleKey: 'yard.page.users.title', subtitleKey: 'yard.page.users.subtitle',
    endpoint: '/yard/users', createLabelKey: 'yard.page.users.create', createRoles: ['admin'],
    columns: [['name','yard.col.name'],['email','yard.col.email'],['role','yard.col.role'],['active','yard.col.active'],['lastLoginAt','yard.col.lastLogin']]
  }
};

/** Columns of a screen as `[dataKey, translatedLabel]` pairs, in the currently selected language. */
export const columnsFor = page => pageConfig[page].columns.map(([key, labelKey]) => [key, t(labelKey)]);
