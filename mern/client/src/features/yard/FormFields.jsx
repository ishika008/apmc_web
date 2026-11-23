import { roles } from '../../constants/roles.js';
import { labelFor } from '../../utils/format.js';
import { t } from '../../i18n/index.js';

export const field = (key,label,type='text',extra={}) => ({key,label,type,...extra});

// Option VALUES are what the API stores and must never be translated; only the labels are.
const roleOptions = () => Object.keys(roles).map(value=>({value,label:labelFor(value)}));
const plain = list => list.map(x=>({value:x,label:x}));
const QUALITY_PENDING = 'તપાસ બાકી';
const COMPLAINT_TYPES = [['હરાજી દર અંગે','auctionRate'],['વજનમાં તફાવત','weight'],['ગુણવત્તા અંગે','quality'],['ચુકવણી વિલંબ','paymentDelay'],['Gate / dispatch','gateDispatch'],['અન્ય','other']];

/** Fields of the "edit staff user" dialog (role, account status, optional password reset). */
export const userEditFields = () => [
  field('role',t('forms.users.role'),'select',{required:true,options:roleOptions()}),
  field('active',t('forms.users.active'),'select',{required:true,options:[{value:'true',label:t('forms.users.active.true')},{value:'false',label:t('forms.users.active.false')}]}),
  field('password',t('forms.users.resetPassword'),'password',{required:false,hint:t('forms.users.resetPassword.hint')})
];

export function FormFieldsFor(page,options) {
  if(page==='gate') return [
    field('sellerType',t('forms.gate.sellerType'),'select',{required:true,options:[{value:'farmer',label:t('forms.gate.sellerType.farmer')},{value:'trader',label:t('forms.gate.sellerType.trader')}],defaultValue:'farmer'}),
    field('farmerName',t('forms.gate.farmerName'),'text',{required:true}),
    field('mobile',t('forms.gate.mobile'),'text',{required:true,placeholder:t('forms.gate.mobile.ph')}),
    field('state',t('forms.gate.state'),'text',{required:true,defaultValue:'Gujarat'}),field('district',t('forms.gate.district')),field('taluka',t('forms.gate.taluka')),field('village',t('forms.gate.village'),'text',{required:true}),
    field('farmerRegistryId',t('forms.gate.farmerRegistryId')),field('landRecordType',t('forms.gate.landRecordType'),'select',{options:[{value:'7/12',label:'7/12'},{value:'8A',label:'8A'},{value:'Khasra / Khatauni',label:t('forms.gate.landRecord.khasra')},{value:'RTC / Pahani',label:t('forms.gate.landRecord.rtc')},{value:'Patta',label:t('forms.gate.landRecord.patta')},{value:'RoR / Survey',label:t('forms.gate.landRecord.ror')},{value:'Not available',label:t('forms.gate.landRecord.na')}]}),
    field('landRecordNo',t('forms.gate.landRecordNo')),field('traderRegistrationNo',t('forms.gate.traderRegistrationNo')),
    field('commodity',t('forms.gate.commodity'),'select',{required:true,options:options.commodities||[]}),
    field('bags',t('forms.gate.bags'),'number',{required:true,min:1,step:1,defaultValue:1}),field('vehicle',t('forms.gate.vehicle'),'text',{placeholder:'GJ-05-XX-0000'}),
    field('estimated',t('forms.gate.estimated'),'number',{min:0,step:0.01,defaultValue:0}),field('quality',t('forms.gate.quality'),'select',{options:[{value:'FAQ',label:'FAQ'},{value:'Grade A',label:t('forms.quality.gradeA')},{value:'Grade B',label:t('forms.quality.gradeB')},{value:QUALITY_PENDING,label:t('forms.quality.pending')}],defaultValue:'FAQ'}),
    field('notes',t('forms.gate.notes'),'textarea',{full:true})
  ];
  if(page==='auction') return [
    field('lotId',t('forms.auction.lotId'),'select',{required:true,options:options.lots||[]}),
    field('buyerId',t('forms.auction.buyerId'),'select',{required:true,options:options.buyers||[]}),
    field('rate',t('forms.auction.rate'),'number',{required:true,min:0.01,step:0.01}),
    field('quantity',t('forms.auction.quantity'),'number',{required:true,min:0.001,step:0.001}),
    field('quality',t('forms.auction.quality'),'text',{defaultValue:'FAQ'}),
    field('method',t('forms.auction.method'),'select',{options:['open_outcry','e_auction','approved_negotiated'].map(value=>({value,label:t('forms.auction.method.'+value)})),defaultValue:'open_outcry'}),
    field('notes',t('forms.auction.notes'),'textarea',{full:true})
  ];
  if(page==='weighment') return [
    field('lotId',t('forms.weighment.lotId'),'select',{required:true,options:options.lots||[]}),
    field('gross',t('forms.weighment.gross'),'number',{required:true,min:0.001,step:0.001}),
    field('tare',t('forms.weighment.tare'),'number',{required:true,min:0,step:0.001}),
    field('scaleId',t('forms.weighment.scaleId')),field('slipRef',t('forms.weighment.slipRef')),
    field('correctionReason',t('forms.weighment.correctionReason'),'textarea',{full:true,hint:t('forms.weighment.correctionReason.hint')}),
    field('notes',t('forms.weighment.notes'),'textarea',{full:true})
  ];
  if(page==='payments') return [
    field('billId',t('forms.payments.billId'),'select',{required:true,options:options.bills||[]}),
    field('type',t('forms.payments.type'),'select',{required:true,options:['farmer_settlement','buyer_purchase','buyer_fee'].map(value=>({value,label:t('forms.payments.type.'+value)}))}),
    field('amount',t('forms.payments.amount'),'number',{required:true,min:0.01,step:0.01}),
    field('mode',t('forms.payments.mode'),'select',{required:true,options:[...plain(['NEFT','RTGS','IMPS','UPI']),{value:'BANK_TRANSFER',label:t('forms.payments.mode.BANK_TRANSFER')},{value:'CASH_APPROVED',label:t('forms.payments.mode.CASH_APPROVED')}]}),
    field('reference',t('forms.payments.reference'),'text',{required:true}),field('notes',t('forms.notes'),'textarea',{full:true})
  ];
  if(page==='buyerledger') return [
    field('name',t('forms.buyerledger.name'),'text',{required:true}),field('registrationNo',t('forms.buyerledger.registrationNo'),'text',{required:true}),
    field('creditDays',t('forms.buyerledger.creditDays'),'number',{required:true,min:0,max:90,step:1,defaultValue:5}),
    field('purchaseLimit',t('forms.buyerledger.purchaseLimit'),'number',{min:0,step:1,defaultValue:0}),
    field('notes',t('forms.notes'),'textarea',{full:true})
  ];
  if(page==='gatepass') return [
    field('lotId',t('forms.gatepass.lotId'),'select',{required:true,options:options.lots||[]}),
    field('overrideReason',t('forms.gatepass.overrideReason'),'textarea',{full:true,hint:t('forms.gatepass.overrideReason.hint')})
  ];
  if(page==='disputes') return [
    field('complainant',t('forms.disputes.complainant'),'text',{required:true}),field('mobile',t('forms.disputes.mobile')),
    field('type',t('forms.disputes.type'),'select',{required:true,options:COMPLAINT_TYPES.map(([value,key])=>({value,label:t('forms.complaintType.'+key)}))}),
    field('lotId',t('forms.disputes.lotId'),'select',{options:[{value:'',label:t('forms.disputes.unlinked')},...(options.lots||[])]}),
    field('details',t('forms.disputes.details'),'textarea',{required:true,full:true}),field('evidenceReferences',t('forms.disputes.evidence'),'text',{full:true})
  ];
  if(page==='users') return [
    field('name',t('forms.users.name'),'text',{required:true}),field('email',t('forms.users.email'),'email',{required:true}),
    field('password',t('forms.users.password'),'password',{required:true,hint:t('forms.users.password.hint')}),
    field('role',t('forms.users.role'),'select',{required:true,options:roleOptions()})
  ];
  return [];
}
