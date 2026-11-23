import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { Bell, LogOut, Menu, Search, X } from 'lucide-react';
import { roleLabel } from '../constants/roles.js';
import { navigation } from '../constants/navigation.js';
import { api } from '../services/api.js';
import { Dashboard } from '../features/dashboard/Dashboard.jsx';
import { ModuleScreen } from '../features/yard/ModuleScreen.jsx';
import { DetailModal } from '../features/yard/DetailModal.jsx';
import { SettingsScreen } from '../features/settings/SettingsScreen.jsx';
import { ReportsScreen } from '../features/reports/ReportsScreen.jsx';
import { SearchModal } from '../components/common/SearchModal.jsx';
import { useI18n } from '../i18n/index.js';
import { LanguageSelect } from '../i18n/LanguageSelect.jsx';

// Sidebar sections as in the reference design: day-to-day operations, then control & reporting.
const CONTROL_IDS=['disputes','reports','audit','users','settings'];

export function Workspace({user,onLogout,notify}) {
  const {t}=useI18n();
  const [page,setPage]=useState('dashboard');const [mobileMenu,setMobileMenu]=useState(false);
  const [searchText,setSearchText]=useState('');const [searchQuery,setSearchQuery]=useState('');const [detail,setDetail]=useState(null);
  const [counts,setCounts]=useState(null);const [bellOpen,setBellOpen]=useState(false);const [yardName,setYardName]=useState('');
  const searchRef=useRef(null);
  const accessible=navigation.filter(n=>n.roles.includes(user.role));
  const selected=navigation.find(n=>n.id===page)||navigation[0];
  const firstControl=accessible.find(n=>CONTROL_IDS.includes(n.id));
  const goto=id=>{setPage(id);setMobileMenu(false);setBellOpen(false)};

  const loadCounts=useCallback(()=>{api('/yard/nav-counts').then(setCounts).catch(()=>{})},[]);
  useEffect(()=>{loadCounts();const timer=setInterval(loadCounts,60000);return()=>clearInterval(timer)},[loadCounts,page]);
  useEffect(()=>{api('/yard/settings').then(d=>setYardName(d.item?.committeeName||'')).catch(()=>{})},[]);
  useEffect(()=>{const onKey=e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();searchRef.current?.focus()}};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey)},[]);

  const submitSearch=e=>{e.preventDefault();const q=searchText.trim();if(q.length>=2)setSearchQuery(q)};
  const openLot=async id=>{try{const data=await api('/yard/lots/'+id);setSearchQuery('');setDetail({kind:'lot',data})}catch(e){notify(e.message,'error')}};
  const openTicket=ticket=>{setSearchQuery('');setDetail({kind:'ticket',data:ticket})};
  const voidTicket=async(ticket,reason)=>{await api('/yard/tickets/'+ticket._id+'/void',{method:'POST',body:{reason}});notify(t('nav.ticketCancelled'));setDetail(null);loadCounts()};

  const badge={auction:counts?.auctionQueue,disputes:counts?.openComplaints};
  const reminders=counts?[
    [t('nav.reminder.complaints'),counts.openComplaints,'disputes'],[t('nav.reminder.farmer'),counts.farmerOverdue,'payments'],
    [t('nav.reminder.buyer'),counts.buyerOverdue,'buyerledger'],[t('nav.reminder.dispatch'),counts.dispatchOverdue,'gatepass']
  ].filter(([,n])=>n>0):[];
  return <div className="app-layout">
    {mobileMenu&&<button className="mobile-overlay" onClick={()=>setMobileMenu(false)} aria-label={t('nav.closeMenu')}/>}
    <aside className={'sidebar '+(mobileMenu?'sidebar-open':'')}>
      <div className="sidebar-brand"><span className="brand-logo">{t('nav.brandMark')}</span><div><b>{t('nav.brandName')}</b><small>{t('nav.brandTagline')}</small></div><button className="icon-btn sidebar-close" onClick={()=>setMobileMenu(false)}><X size={18}/></button></div>
      <div className="yard-select"><span className="yard-dot"/><div><small>{t('nav.yardLabel')}</small><strong>{yardName||t('nav.yardDefault')}</strong></div></div>
      <nav className="side-nav">{accessible.map((item,index)=><Fragment key={item.id}>
        {item.id===accessible[0].id&&<div className="nav-label">{t('nav.group.main')}</div>}
        {item.id===firstControl?.id&&<div className="nav-label">{t('nav.group.control')}</div>}
        <button className={page===item.id?'nav-link active':'nav-link'} onClick={()=>goto(item.id)} aria-current={page===item.id?'page':undefined}><item.icon size={17}/><span><b>{item.label}</b>{item.sub!==item.label&&<small>{item.sub}</small>}</span>{index<9&&!CONTROL_IDS.includes(item.id)&&<kbd>{String(index+1).padStart(2,'0')}</kbd>}{badge[item.id]>0&&<em className="nav-badge">{badge[item.id]}</em>}{page===item.id&&<i/>}</button>
      </Fragment>)}</nav>
      <div className="sidebar-bottom"><div className="user-mini"><span className="user-avatar">{user.name.slice(0,1).toUpperCase()}</span><div><b>{user.name}</b><small>{roleLabel(user.role)}</small></div></div><button onClick={onLogout} className="logout-btn"><LogOut size={16}/> {t('common.signOut')}</button></div>
    </aside>
    <main className="workspace-main">
      <header className="topbar"><button className="icon-btn mobile-trigger" onClick={()=>setMobileMenu(true)}><Menu size={20}/></button><div className="breadcrumb"><span>{t('nav.marketYard')}</span><i>/</i><b>{selected.label}</b></div>
        <div className="topbar-right">
        <form className="global-search" onSubmit={submitSearch} role="search"><Search size={15}/><input ref={searchRef} value={searchText} onChange={e=>setSearchText(e.target.value)} onKeyDown={e=>{if(e.key==='Escape'){setSearchText('');e.target.blur()}}} placeholder={t('nav.searchPlaceholder')} aria-label={t('nav.searchLabel')} autoComplete="off"/><kbd>⌘K</kbd></form>
        <span className="server-indicator"><i/> {t('nav.authenticated')}</span>
          <LanguageSelect/>
          <div className="bell-wrap"><button className="icon-btn" onClick={()=>{setBellOpen(v=>!v);loadCounts()}} aria-label={t('nav.reminders')} aria-expanded={bellOpen}><Bell size={18}/>{reminders.length>0&&<em className="bell-dot"/>}</button>
            {bellOpen&&<div className="bell-panel" role="menu"><b>{t('nav.reminders')}</b>{reminders.length?reminders.map(([label,n,target])=><button key={label} onClick={()=>goto(target)}><span>{label}</span><strong>{n}</strong></button>):<p>{t('nav.noReminders')}</p>}</div>}</div>
          <div className="top-user"><span className="user-avatar small">{user.name.slice(0,1).toUpperCase()}</span><div><strong>{user.name}</strong><small>{roleLabel(user.role)}</small></div></div><button onClick={onLogout} className="icon-btn desktop-logout" title={t('common.signOut')}><LogOut size={17}/></button></div></header>
      <div className="workspace-content">
        {page==='dashboard'?<Dashboard user={user} onNavigate={goto}/>
        :page==='settings'?<SettingsScreen notify={notify} onNavigate={goto}/>
        :page==='reports'?<ReportsScreen user={user} notify={notify}/>
        :<ModuleScreen page={page} user={user} notify={notify}/>}
        <footer className="app-footer"><span>{t('nav.footer')}</span><span>{t('nav.footerRight')}</span></footer>
      </div>
    </main>
    {searchQuery&&<SearchModal query={searchQuery} onClose={()=>setSearchQuery('')} onOpenLot={openLot} onOpenTicket={openTicket}/>}
    {detail&&<DetailModal detail={detail} user={user} onClose={()=>setDetail(null)} onVoidTicket={voidTicket} onPrint={t=>setDetail({kind:'ticketprint',data:t})}/>}
  </div>;
}
