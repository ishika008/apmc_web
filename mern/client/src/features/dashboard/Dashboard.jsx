import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, ArrowRight, DoorOpen, Gavel, Package, RefreshCw, ShieldCheck, Users, Wallet, Truck } from 'lucide-react';
import { roleLabel } from '../../constants/roles.js';
import { navigation } from '../../constants/navigation.js';
import { columnsFor } from '../../constants/pageConfig.js';
import { money, number } from '../../utils/format.js';
import { api } from '../../services/api.js';
import { StatCard } from '../../components/common/StatCard.jsx';
import { DataTable } from '../../components/common/DataTable.jsx';
import { YardLive } from './YardLive.jsx';
import { useI18n } from '../../i18n/index.js';

export function Dashboard({user,onNavigate}) {
  const {t}=useI18n();
  const [stats,setStats]=useState(null);const [lots,setLots]=useState([]);const [error,setError]=useState('');const [loading,setLoading]=useState(true);const [live,setLive]=useState(null);
  const load=useCallback(async()=>{setLoading(true);setError('');try{const [summary,latest,liveData]=await Promise.all([api('/yard/overview'),api('/yard/lots?limit=6'),api('/yard/dashboard')]);setStats(summary.stats);setLots(latest.items);setLive(liveData)}catch(e){setError(e.message)}finally{setLoading(false)}},[]);
  useEffect(()=>{load()},[load]);
  const values=stats||{};
  return <div className="page-stack">
    <div className="welcome-row"><div><span className="eyebrow">{t('dashboard.eyebrow')}</span><h1>{t('dashboard.greeting',{name:user.name.split(' ')[0]})}</h1><p>{t('dashboard.intro')}</p></div><div className="welcome-actions"><span className="role-pill"><ShieldCheck size={13}/>{roleLabel(user.role)}</span><button className="btn ghost" onClick={load}><RefreshCw size={15}/> {t('common.refresh')}</button></div></div>
    {error&&<div className="inline-error"><AlertCircle size={16}/>{error}</div>}
    {loading&&!stats?<div className="loading-panel">{t('dashboard.loading')}</div>:<>
      <div className="metrics-grid">
        <StatCard label={t('dashboard.stat.totalLots')} value={number(values.totalLots)} note={t('dashboard.stat.totalLots.note')} icon={Package}/>
        <StatCard label={t('dashboard.stat.awaiting')} value={number(values.arrived)} note={t('dashboard.stat.awaiting.note')} icon={DoorOpen} tone="amber"/>
        <StatCard label={t('dashboard.stat.auctionDone')} value={number(values.totalTickets)} note={t('dashboard.stat.auctionDone.note')} icon={Gavel} tone="blue"/>
        <StatCard label={t('dashboard.stat.dispatchDone')} value={number(values.dispatched)} note={t('dashboard.stat.dispatchDone.note')} icon={Truck}/>
        <StatCard label={t('dashboard.stat.farmerDue')} value={money(values.farmerDue)} note={t('dashboard.stat.farmerDue.note')} icon={Wallet} tone="amber"/>
        <StatCard label={t('dashboard.stat.traderDue')} value={money(values.traderDue)} note={t('dashboard.stat.traderDue.note')} icon={Users} tone="blue"/>
        <StatCard label={t('dashboard.stat.complaints')} value={number(values.openComplaints)} note={t('dashboard.stat.complaints.note')} icon={AlertCircle} tone="red"/>
        <StatCard label={t('dashboard.stat.buyers')} value={number(values.activeBuyers)} note={t('dashboard.stat.buyers.note')} icon={Users}/>
      </div>
      <div className="dashboard-grid">
        <section className="surface-card">
          <div className="section-title"><div><h2>{t('dashboard.recent.title')}</h2><p>{t('dashboard.recent.sub')}</p></div><button className="text-btn" onClick={()=>onNavigate('gate')}>{t('dashboard.recent.viewAll')} <ArrowRight size={14}/></button></div>
          <DataTable columns={columnsFor('gate').slice(0,6)} rows={lots} compact empty={t('dashboard.recent.empty')}/>
        </section>
        <section className="surface-card finance-card"><div className="section-title"><div><h2>{t('dashboard.fin.title')}</h2><p>{t('dashboard.fin.sub')}</p></div><Wallet size={19}/></div>
          <div className="finance-row"><span>{t('dashboard.fin.payable')}</span><b>{money(values.farmerPayable)}</b></div>
          <div className="finance-row"><span>{t('dashboard.fin.paid')}</span><b className="positive">{money(values.farmerPaid)}</b></div>
          <div className="finance-row"><span>{t('dashboard.fin.outstanding')}</span><b className="attention">{money(values.farmerDue)}</b></div>
          <div className="finance-row"><span>{t('dashboard.fin.traderDue')}</span><b>{money(values.traderDue)}</b></div>
          <div className="finance-row"><span>{t('dashboard.fin.buyerDues')}</span><b>{money(Math.max(0,(values.buyerDues||0)-(values.buyerDuesPaid||0)))}</b></div>
          <button className="btn secondary full-width" onClick={()=>onNavigate('payments')}>{t('dashboard.fin.open')} <ArrowRight size={15}/></button>
        </section>
      </div>
      {live&&<YardLive live={live} onNavigate={onNavigate}/>}
      <section className="surface-card"><div className="section-title"><div><h2>{t('dashboard.quick.title')}</h2><p>{t('dashboard.quick.sub')}</p></div></div><div className="quick-actions">
        {navigation.filter(n=>n.id!=='dashboard'&&n.roles.includes(user.role)).slice(0,6).map(n=><button key={n.id} onClick={()=>onNavigate(n.id)}><n.icon size={19}/><span>{n.sub}</span><ArrowRight size={14}/></button>)}
      </div></section>
    </>}
  </div>;
}
