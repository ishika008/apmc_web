import { Printer } from 'lucide-react';
import { labelFor, number, dateTime } from '../../utils/format.js';
import { useI18n } from '../../i18n/index.js';

export function GatePassPrint({ pass }) {
  const { t } = useI18n();
  const lot = pass.lot || {};
  const fields = [
    [t('print.pass.number'), pass.passNumber], [t('print.pass.lotId'), lot.lotNumber], [t('print.pass.farmer'), lot.farmerName], [t('print.pass.buyer'), pass.buyer?.name],
    [t('print.pass.crop'), lot.commodity], [t('print.pass.net'), lot.netWeight != null ? number(lot.netWeight) + ' Q' : '—'], [t('print.pass.vehicle'), pass.vehicle || lot.vehicle],
    [t('print.pass.status'), labelFor(pass.status)], [t('print.pass.issued'), dateTime(pass.issuedAt)], [t('print.pass.dispatch'), pass.dispatchAt ? dateTime(pass.dispatchAt) : '—'],
    [t('print.pass.issuedBy'), pass.issuedBy?.name], [t('print.pass.override'), pass.overrideReason || '—']
  ];
  return <div>
    <div className="print-area"><div className="ticket"><div className="ticket-top"><div className="ticket-logo">{t('print.pass.logo')}</div><h3>{t('print.pass.title')}</h3><p>{t('print.pass.notice')}</p></div>
      <div className="ticket-grid">{fields.map(([k, v]) => <div className="ticket-field" key={k}><small>{k}</small><strong>{v || '—'}</strong></div>)}</div></div></div>
    <div className="form-actions"><button className="btn primary" onClick={() => window.print()}><Printer size={15}/> {t('print.print')}</button></div>
  </div>;
}
