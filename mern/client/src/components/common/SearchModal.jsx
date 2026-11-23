import { useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { api } from '../../services/api.js';
import { labelFor, money } from '../../utils/format.js';
import { Modal } from './Modal.jsx';
import { useI18n } from '../../i18n/index.js';

export function SearchModal({ query, onClose, onOpenLot, onOpenTicket }) {
  const { t } = useI18n();
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    setResult(null); setError('');
    api('/yard/search?q=' + encodeURIComponent(query)).then(r => live && setResult(r)).catch(e => live && setError(e.message));
    return () => { live = false; };
  }, [query]);
  const empty = result && !result.lots.length && !result.tickets.length;
  return <Modal title={t('common.search.title', { query })} onClose={onClose} wide>
    {error && <div className="inline-error"><AlertCircle size={15}/>{error}</div>}
    {!result && !error && <div className="loading-panel">{t('common.search.loading')}</div>}
    {empty && <div className="empty-state"><b>{t('common.search.empty')}</b><span>{t('common.search.emptyHint')}</span></div>}
    {result && !empty && <div className="table-wrap"><table><thead><tr><th>{t('common.search.recordId')}</th><th>{t('common.search.farmer')}</th><th>{t('common.search.crop')}</th><th>{t('common.search.statusRate')}</th><th></th></tr></thead><tbody>
      {result.lots.map(l => <tr key={l._id}><td>{l.lotNumber}</td><td>{l.farmerName}</td><td>{l.commodity}</td><td>{labelFor(l.status)}</td><td><button className="row-action" onClick={() => onOpenLot(l._id)}>{t('common.open')}</button></td></tr>)}
      {result.tickets.map(tk => <tr key={tk._id}><td>{tk.ticketNumber}</td><td>{tk.lot?.farmerName}</td><td>{tk.lot?.commodity}</td><td>{money(tk.rate)}</td><td><button className="row-action" onClick={() => onOpenTicket(tk)}>{t('common.search.slip')}</button></td></tr>)}
    </tbody></table></div>}
  </Modal>;
}
