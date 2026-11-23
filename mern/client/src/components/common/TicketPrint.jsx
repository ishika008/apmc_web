import { useEffect, useState } from 'react';
import { Printer } from 'lucide-react';
import { api } from '../../services/api.js';
import { labelFor, money, number, dateTime } from '../../utils/format.js';
import { useI18n } from '../../i18n/index.js';

// Same QR library the reference prototype uses; falls back to a text placeholder when unavailable/offline.
const QR_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
const loadQr = () => window.QRCode ? Promise.resolve(window.QRCode) : new Promise(resolve => {
  const script = document.createElement('script');
  script.src = QR_SRC; script.async = true;
  script.onload = () => resolve(window.QRCode || null); script.onerror = () => resolve(null);
  document.head.appendChild(script);
});

const COPIES = ['farmer', 'buyer', 'yard'];

function Ticket({ ticket, copy, yardName }) {
  const { t } = useI18n();
  const lot = ticket.lot || {};
  const identity = lot.sellerType === 'trader'
    ? t('print.ticket.identityTrader', { id: lot.traderRegistrationNo || '—' })
    : t('print.ticket.identityFarmer', { id: lot.farmerRegistryId || '—', type: lot.landRecordType || t('print.ticket.landRecord'), no: lot.landRecordNo || '—' });
  const qrText = [ticket.ticketNumber, lot.lotNumber, ticket.rate].join('|');
  const fields = [
    [t('print.ticket.lotId'), lot.lotNumber], [t('print.ticket.sellerType'), lot.sellerType === 'trader' ? t('print.ticket.trader') : t('print.ticket.farmer')],
    [t('print.ticket.sellerName'), lot.farmerName], [t('print.ticket.sellerIdentity'), identity],
    [t('print.ticket.cropGrade'), (lot.commodity || '—') + ' / ' + (ticket.quality || '—')], [t('print.ticket.buyer'), ticket.buyer?.name],
    [t('print.ticket.buyerReg'), ticket.buyer?.registrationNo || '—'], [t('print.ticket.bags'), lot.bags],
    [t('print.ticket.quantity'), number(ticket.quantity) + ' Q'], [t('print.ticket.rate'), money(ticket.rate) + ' / Q'],
    [t('print.ticket.method'), labelFor(ticket.method)], [t('print.ticket.value'), money(ticket.quantity * ticket.rate)],
    [t('print.ticket.farmerDeadline'), dateTime(ticket.farmerPaymentDueAt)], [t('print.ticket.dispatchDeadline'), dateTime(ticket.dispatchDueAt)],
    [t('print.ticket.creditDue'), dateTime(ticket.buyerCreditDueAt)]
  ];
  return <div className="ticket-copy"><div className="ticket-copy-label">{t('print.copyLine', { copy: t('print.copy.' + copy), label: t('print.copyLabel.' + copy) })}</div>
    <div className="ticket">
      <div className="ticket-top"><div className="ticket-logo">{t('print.ticket.logo')}</div><h3>{t('print.ticket.title')}</h3><p>{yardName} · {dateTime(ticket.createdAt)}</p></div>
      <div className="ticket-no"><div><small>{t('print.ticket.number')}</small><strong>{ticket.ticketNumber}</strong></div><div className="qr-wrap" data-qr={qrText}><span>{t('print.ticket.qr')}</span></div></div>
      <div className="ticket-grid">{fields.map(([k, v]) => <div className="ticket-field" key={k}><small>{k}</small><strong>{v ?? '—'}</strong></div>)}</div>
    </div></div>;
}

export function TicketPrint({ ticket }) {
  const { t } = useI18n();
  const [yardName, setYardName] = useState(null);
  useEffect(() => { api('/yard/settings').then(d => d.item?.committeeName && setYardName(d.item.committeeName)).catch(() => {}); }, []);
  useEffect(() => {
    let live = true;
    loadQr().then(QRCode => {
      if (!live || !QRCode) return;
      document.querySelectorAll('.qr-wrap[data-qr]').forEach(el => {
        el.innerHTML = '';
        try { new QRCode(el, { text: el.dataset.qr, width: 60, height: 60, colorDark: '#173d2d', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M }); }
        catch { el.textContent = 'QR'; }
      });
    });
    return () => { live = false; };
  }, [ticket]);
  return <div>
    <div className="print-area">{COPIES.map(copy => <Ticket key={copy} ticket={ticket} copy={copy} yardName={yardName ?? t('print.yardDefault')}/>)}</div>
    <div className="form-actions"><button className="btn primary" onClick={() => window.print()}><Printer size={15}/> {t('print.printAll')}</button></div>
  </div>;
}
