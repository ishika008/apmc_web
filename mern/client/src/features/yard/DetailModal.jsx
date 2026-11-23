import { Printer } from 'lucide-react';
import { labelFor, money, number, dateTime } from '../../utils/format.js';
import { useI18n } from '../../i18n/index.js';
import { Modal } from '../../components/common/Modal.jsx';
import { TicketPrint } from '../../components/common/TicketPrint.jsx';
import { GatePassPrint } from '../../components/common/GatePassPrint.jsx';

export function DetailModal({detail,onClose,user,onVoidTicket,onPrint}) {
  const {t}=useI18n();
  const {kind,data}=detail;
  if(kind==='ticketprint')return <Modal title={t('yard.detail.titleTicketPrint',{ref:data.ticketNumber})} onClose={onClose} wide><TicketPrint ticket={data}/></Modal>;
  if(kind==='passprint')return <Modal title={t('yard.detail.titlePassPrint',{ref:data.passNumber})} onClose={onClose} wide><GatePassPrint pass={data}/></Modal>;
  let title=t('yard.detail.titleTransaction');
  if(kind==='lot')title=t('yard.detail.titleLot',{ref:data.item.lotNumber});
  if(kind==='ticket')title=t('yard.detail.titleTicket',{ref:data.ticketNumber});
  if(kind==='bill')title=t('yard.detail.titleBill',{ref:data.billNumber});
  if(kind==='complaint')title=t('yard.detail.titleComplaint',{ref:data.complaintNumber});
  const item=kind==='lot'?data.item:data;
  const rows=kind==='lot'?[
    [t('yard.detail.seller'),item.farmerName],[t('yard.detail.mobile'),item.mobile],[t('yard.detail.commodity'),item.commodity],[t('yard.detail.qtyBags'),item.bags],
    [t('yard.detail.vehicle'),item.vehicle],[t('yard.detail.arrival'),dateTime(item.arrivalAt)],[t('yard.detail.status'),labelFor(item.status)],
    [t('yard.detail.ticket'),data.ticket?.ticketNumber],[t('yard.detail.buyer'),data.ticket?.buyer?.name],[t('yard.detail.rate'),data.ticket?money(data.ticket.rate)+' / Q':null],
    [t('yard.detail.gtn'),data.weighments?.length?number(data.weighments.at(-1).gross)+' / '+number(data.weighments.at(-1).tare)+' / '+number(data.weighments.at(-1).net)+' Q':null],
    [t('yard.detail.bill'),data.bill?.billNumber],[t('yard.detail.farmerPayable'),data.bill?money(data.bill.farmerNetPayable):null],[t('yard.detail.gatePass'),data.pass?.passNumber]
  ]:kind==='ticket'?[
    [t('yard.detail.ticketNumber'),item.ticketNumber],[t('yard.detail.lot'),item.lot?.lotNumber],[t('yard.detail.farmer'),item.lot?.farmerName],[t('yard.detail.buyer'),item.buyer?.name],
    [t('yard.detail.quantity'),number(item.quantity)+' Q'],[t('yard.detail.rate'),money(item.rate)+' / Q'],[t('yard.detail.grossValue'),money(item.quantity*item.rate)],[t('yard.detail.issuedAt'),dateTime(item.createdAt)]
  ]:kind==='complaint' ? [
    [t('yard.detail.complaintNumber'),item.complaintNumber],[t('yard.detail.complainant'),item.complainant],[t('yard.detail.type'),item.type],[t('yard.detail.lot'),item.lot?.lotNumber],[t('yard.detail.status'),labelFor(item.status)],[t('yard.detail.details'),item.details],[t('yard.detail.openedAt'),dateTime(item.createdAt)],[t('yard.detail.resolution'),item.resolution]
  ]:[
    [t('yard.detail.billNumber'),item.billNumber],[t('yard.detail.lot'),item.lot?.lotNumber],[t('yard.detail.farmer'),item.farmerName],[t('yard.detail.buyer'),item.buyer?.name],
    [t('yard.detail.netWeight'),number(item.netWeight)+' Q'],[t('yard.detail.rate'),money(item.rate)+' / Q'],[t('yard.detail.grossAmount'),money(item.grossAmount)],
    [t('yard.detail.sellerDeduction'),money(item.sellerDeduction)],[t('yard.detail.farmerNetPayable'),money(item.farmerNetPayable)],
    [t('yard.detail.farmerPaid'),money(item.farmerPaid)],[t('yard.detail.farmerBalance'),money(item.farmerNetPayable-item.farmerPaid)],
    [t('yard.detail.traderPaid'),money(item.buyerPurchasePaid)],[t('yard.detail.buyerDues'),money(item.buyerMarketFee+item.buyerOtherDues)]
  ];
  const steps=[['gateEntry',true],['auctionTicket',!!data.ticket],['weighment',!!data.weighments?.length],['saleBill',!!data.bill],['farmerSettlement',data.bill?.status==='paid'],['gatePass',!!data.pass],['dispatch',data.pass?.status==='dispatched']];
  return <Modal title={title} onClose={onClose} wide><div className="detail-grid">{rows.filter(([,v])=>v!==undefined&&v!==null&&v!=='').map(([k,v])=><div className="detail-cell" key={k}><small>{k}</small><b>{v}</b></div>)}</div>
    {kind==='lot'&&<><h3 className="subsection-title">{t('yard.detail.timeline')}</h3><div className="timeline-list">{steps.map(([name,done])=><div key={name}><span className={done?'timeline-dot done':'timeline-dot'}/><b>{t('yard.detail.step.'+name)}</b><small>{done?t('yard.detail.completed'):t('yard.detail.pending')}</small></div>)}</div></>}
    <div className="form-actions">{kind==='ticket'&&onPrint&&<button className="btn secondary" onClick={()=>onPrint(data)}><Printer size={15}/> {t('yard.detail.printTicket')}</button>}{kind==='ticket'&&user?.role==='admin'&&<button className="btn danger" onClick={async()=>{const reason=window.prompt(t('yard.detail.cancelPrompt'));if(reason&&reason.trim().length>=8){try{await onVoidTicket(data,reason.trim())}catch(error){window.alert(error.message)}}}}>{t('yard.detail.cancelTicket')}</button>}<button className="btn ghost" onClick={onClose}>{t('yard.detail.close')}</button><button className="btn primary" onClick={()=>window.print()}><Printer size={15}/> {t('yard.detail.print')}</button></div>
  </Modal>;
}
