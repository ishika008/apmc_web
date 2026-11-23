import { Activity, CheckCircle2, Clock, Receipt, Scale, Truck } from 'lucide-react';
import { StatCard } from '../../components/common/StatCard.jsx';
import { labelFor, money, number, dateTime, auditLabel } from '../../utils/format.js';
import { deadlineLabel, isOverdue } from '../../utils/time.js';
import { useI18n } from '../../i18n/index.js';

function MiniTable({ columns, rows, empty }) {
  if (!rows.length) return <div className="empty-state"><b>{empty}</b></div>;
  return <div className="table-wrap"><table className="compact-table"><thead><tr>{columns.map(([label]) => <th key={label}>{label}</th>)}</tr></thead>
    <tbody>{rows.map((row, i) => <tr key={row._id || row.reference || row.buyerId || i}>{columns.map(([label, render]) => <td key={label}>{render(row)}</td>)}</tr>)}</tbody></table></div>;
}

const Due = ({ value }) => <span className={'status-pill ' + (isOverdue(value) ? 'warn' : 'neutral')}>{deadlineLabel(value)}</span>;

/** Real arrivals-per-hour bars for today (replaces the prototype's static sample chart). */
function ArrivalsChart({ data }) {
  const { t } = useI18n();
  const hours = data.filter(h => h.hour >= 5 && h.hour <= 21);
  const max = Math.max(1, ...hours.map(h => h.lots));
  const w = 600, h = 170, bar = w / hours.length;
  return <svg className="arrivals-chart" viewBox={`0 0 ${w} ${h + 22}`} role="img" aria-label={t('dashboard.live.arrivals.aria')}>
    {hours.map((p, i) => { const bh = (p.lots / max) * h; return <g key={p.hour}>
      <rect x={i * bar + 6} y={h - bh} width={bar - 12} height={bh} rx="3" className="chart-bar"><title>{t('dashboard.live.arrivals.tip', { hour: p.hour, lots: p.lots })}</title></rect>
      {p.lots > 0 && <text x={i * bar + bar / 2} y={h - bh - 4} textAnchor="middle" className="chart-num">{p.lots}</text>}
      <text x={i * bar + bar / 2} y={h + 15} textAnchor="middle" className="chart-hour">{String(p.hour).padStart(2, '0')}</text></g>; })}
  </svg>;
}

export function YardLive({ live, onNavigate }) {
  const { t } = useI18n();
  const { status, stock, farmerDues, traderDues, farmerTotals, arrivalsByHour, activity } = live;
  return <>
    <div className="section-title"><div><h2>{t('dashboard.live.title')}</h2><p>{t('dashboard.live.sub')}</p></div></div>
    <div className="metrics-grid">
      <StatCard label={t('dashboard.live.pending')} value={t('dashboard.live.lotCount', { n: number(status.auctionPending) })} note={t('dashboard.live.pending.note')} icon={Clock} tone="amber"/>
      <StatCard label={t('dashboard.live.passes')} value={t('dashboard.live.passCount', { n: number(status.passesIssued) })} note={t('dashboard.live.passes.note')} icon={Receipt} tone="blue"/>
      <StatCard label={t('dashboard.live.dispatched')} value={t('dashboard.live.lotCount', { n: number(status.dispatched) })} note={t('dashboard.live.dispatched.note')} icon={Truck} tone="blue"/>
      <StatCard label={t('dashboard.live.inYard')} value={t('dashboard.live.lotCount', { n: number(status.inYard) })} note={t('dashboard.live.quintalsInside', { q: number(status.quintalsInside) })} icon={Scale}/>
    </div>
    <div className="dashboard-grid">
      <section className="surface-card"><div className="section-title"><div><h2>{t('dashboard.live.arrivals.title')}</h2><p>{t('dashboard.live.arrivals.sub')}</p></div></div><ArrivalsChart data={arrivalsByHour}/></section>
      <section className="surface-card"><div className="section-title"><div><h2>{t('dashboard.live.activity.title')}</h2><p>{t('dashboard.live.activity.sub')}</p></div><Activity size={18}/></div>
        {activity.length ? <div className="activity-list">{activity.map(a => <div className="activity-item" key={a._id}><CheckCircle2 size={15}/><div><b>{auditLabel('action', a.action)}</b><small>{a.actorName} · {a.resourceId}</small></div><time>{dateTime(a.createdAt)}</time></div>)}</div>
          : <div className="empty-state"><b>{t('dashboard.live.activity.empty')}</b></div>}</section>
    </div>
    <section className="surface-card"><div className="section-title"><div><h2>{t('dashboard.live.stock.title')}</h2><p>{t('dashboard.live.stock.sub')}</p></div></div>
      <MiniTable empty={t('dashboard.live.stock.empty')} rows={stock} columns={[
        [t('dashboard.live.col.lotId'), r => r.lotNumber], [t('dashboard.live.col.owner'), r => <>{r.farmerName}<small className="cell-sub">{r.sellerType === 'trader' ? t('dashboard.live.sellerTrader') : t('dashboard.live.sellerFarmer')} · {r.village || '—'}</small></>],
        [t('dashboard.live.col.crop'), r => r.commodity], [t('dashboard.live.col.qty'), r => number(r.netWeight || r.estimated || 0) + ' Q'], [t('dashboard.live.col.vehicle'), r => r.vehicle || '—'],
        [t('dashboard.live.col.status'), r => labelFor(r.status)], [t('dashboard.live.col.buyer'), r => r.buyerId?.name || t('dashboard.live.noBuyer')], [t('dashboard.live.col.dispatchDeadline'), r => r.dispatchDueAt ? <Due value={r.dispatchDueAt}/> : '—']]}/></section>
    <div className="dashboard-grid">
      <section className="surface-card"><div className="section-title"><div><h2>{t('dashboard.live.farmerDues.title')}</h2><p>{t('dashboard.live.farmerDues.sub', { payable: money(farmerTotals.payable), paid: money(farmerTotals.paid), due: money(farmerTotals.due), provisional: money(farmerTotals.provisional) })}</p></div><button className="text-btn" onClick={() => onNavigate('payments')}>{t('dashboard.live.farmerDues.open')}</button></div>
        <MiniTable empty={t('dashboard.live.farmerDues.empty')} rows={farmerDues} columns={[
          [t('dashboard.live.col.farmer'), r => r.farmer], [t('dashboard.live.col.reference'), r => <>{r.reference}{r.kind === 'provisional' && <small className="cell-sub">{t('dashboard.live.provisional')}</small>}</>],
          [t('dashboard.live.col.payable'), r => money(r.payable)], [t('dashboard.live.col.paid'), r => money(r.paid)], [t('dashboard.live.col.balance'), r => <b>{money(r.balance)}</b>], [t('dashboard.live.col.due'), r => <Due value={r.dueAt}/>]]}/></section>
      <section className="surface-card"><div className="section-title"><div><h2>{t('dashboard.live.traderDues.title')}</h2><p>{t('dashboard.live.traderDues.sub')}</p></div><button className="text-btn" onClick={() => onNavigate('buyerledger')}>{t('dashboard.live.traderDues.open')}</button></div>
        <MiniTable empty={t('dashboard.live.traderDues.empty')} rows={traderDues} columns={[
          [t('dashboard.live.col.trader'), r => <>{r.name}<small className="cell-sub">{r.registrationNo || t('dashboard.live.regPending')}</small></>], [t('dashboard.live.col.credit'), r => t('dashboard.live.days', { n: r.creditDays })],
          [t('dashboard.live.col.paid'), r => money(r.paid)], [t('dashboard.live.col.balance'), r => <b>{money(r.due)}</b>], [t('dashboard.live.col.traderStatus'), r => <span className={'status-pill ' + (r.overdue ? 'warn' : 'neutral')}>{r.overdue ? t('dashboard.live.creditOverdue') : t('dashboard.live.collectionPending')}</span>]]}/></section>
    </div>
  </>;
}
