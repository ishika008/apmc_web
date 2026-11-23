import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Gavel, Package, ReceiptText, Users, Wallet, FileBarChart } from 'lucide-react';
import { labelFor, money, number } from '../../utils/format.js';
import { api, downloadFile } from '../../services/api.js';
import { StatCard } from '../../components/common/StatCard.jsx';
import { DataTable } from '../../components/common/DataTable.jsx';
import { useI18n } from '../../i18n/index.js';

// [dataset key, count key]; the report name / detail come from the translation catalogue (reports.r.<key>[.detail]).
const REPORTS = ['lots','tickets','weighments','bills','payments','complaints','audit'].map(k => [k, k]);

export function ReportsScreen({user,notify}) {
  const {t}=useI18n();
  const [catalog,setCatalog]=useState(null);
  useEffect(()=>{api('/yard/reports/catalog').then(setCatalog).catch(()=>{})},[]);
  const reports=REPORTS.filter(r=>r[0]!=='audit'||['admin','inspector'].includes(user?.role));
  const exportOne=async key=>{try{await downloadFile('/yard/reports/export/'+key,key+'.csv');notify?.(t('reports.csvReady'))}catch(e){notify?.(e.message,'error')}};
  const exportAll=async()=>{for(const [key] of reports){await exportOne(key);await new Promise(r=>setTimeout(r,350))}};
  const [data,setData]=useState(null);const [from,setFrom]=useState(new Date().toISOString().slice(0,10));const [to,setTo]=useState(new Date().toISOString().slice(0,10));const [error,setError]=useState('');
  const run=useCallback(async()=>{setError('');try{setData(await api('/yard/reports/summary?from='+from+'&to='+to))}catch(e){setError(e.message)}},[from,to]);
  useEffect(()=>{run()},[run]);
  return <div className="page-stack"><div className="page-head"><div><span className="eyebrow">{t('reports.eyebrow')}</span><h1>{t('reports.title')}</h1><p>{t('reports.intro')}</p></div><div className="page-actions"><button className="btn primary" onClick={exportAll}>{t('reports.exportAll')}</button></div></div>
    {catalog&&<><div className="metrics-grid"><StatCard label={t('reports.kpi.lots')} value={number(catalog.counts.lots)} note={t('reports.kpi.lots.note')} icon={Package}/><StatCard label={t('reports.kpi.avgRate')} value={money(catalog.kpis.averageRate)} note={t('reports.kpi.avgRate.note')} icon={Gavel} tone="blue"/><StatCard label={t('reports.kpi.gross')} value={money(catalog.kpis.grossSales)} note={t('reports.kpi.gross.note')} icon={ReceiptText}/><StatCard label={t('reports.kpi.pending')} value={money(catalog.kpis.pendingPayable)} note={t('reports.kpi.pending.note')} icon={Wallet} tone="amber"/></div>
    <section className="surface-card"><div className="section-title"><div><h2>{t('reports.center.title')}</h2><p>{t('reports.center.sub')}</p></div></div><div className="table-wrap"><table><thead><tr><th>{t('reports.col.report')}</th><th>{t('reports.col.records')}</th><th>{t('reports.col.detail')}</th><th></th></tr></thead><tbody>{reports.map(([key,countKey])=><tr key={key}><td>{t('reports.r.'+key)}</td><td>{number(catalog.counts[countKey])}</td><td>{t('reports.r.'+key+'.detail')}</td><td><button className="row-action" onClick={()=>exportOne(key)}>{t('reports.csvExport')}</button></td></tr>)}</tbody></table></div></section></>}
    <section className="surface-card report-filter"><label className="field"><span>{t('reports.from')}</span><input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label className="field"><span>{t('reports.to')}</span><input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label><button className="btn primary" onClick={run}><FileBarChart size={15}/> {t('reports.generate')}</button></section>
    {error&&<div className="inline-error"><AlertCircle size={15}/>{error}</div>}
    {data&&<><div className="metrics-grid">
      <StatCard label={t('reports.s.arrivals')} value={number(data.lots)} note={t('reports.s.arrivals.note')} icon={Package}/>
      <StatCard label={t('reports.s.tickets')} value={number(data.tickets)} note={t('reports.s.tickets.note')} icon={Gavel}/>
      <StatCard label={t('reports.s.bills')} value={number(data.bills.bills)} note={t('reports.s.bills.note')} icon={ReceiptText}/>
      <StatCard label={t('reports.s.gross')} value={money(data.bills.gross)} note={t('reports.s.gross.note')} icon={Wallet}/>
      <StatCard label={t('reports.s.payable')} value={money(data.bills.farmerPayable)} note={t('reports.s.payable.note')} icon={Users}/>
      <StatCard label={t('reports.s.paid')} value={money(data.bills.farmerPaid)} note={t('reports.s.paid.note')} icon={CheckCircle2}/>
      <StatCard label={t('reports.s.complaints')} value={number(data.complaints)} note={t('reports.s.complaints.note')} icon={AlertCircle}/>
    </div><section className="surface-card"><div className="section-title"><div><h2>{t('reports.coll.title')}</h2><p>{t('reports.coll.sub')}</p></div></div><DataTable columns={ [[' _id',t('reports.coll.ledger')],['count',t('reports.coll.receipts')],['amount',t('reports.coll.amount')]] .map(([a,b])=>[a.trim(),b])} rows={data.payments.map(x=>({...x,_id:labelFor(x._id)}))} empty={t('reports.coll.empty')}/></section>
    <div className="notice-panel"><FileBarChart size={17}/> {t('reports.notice')}</div></>}
  </div>;
}
