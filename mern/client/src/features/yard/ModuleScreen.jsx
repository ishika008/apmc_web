import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowDownToLine, RefreshCw, Scale, Search, Wallet, Truck } from 'lucide-react';
import { pageConfig, columnsFor } from '../../constants/pageConfig.js';
import { useI18n } from '../../i18n/index.js';
import { labelFor, money, number } from '../../utils/format.js';
import { exportCsv } from '../../utils/csv.js';
import { api } from '../../services/api.js';
import { FormDialog } from '../../components/common/FormDialog.jsx';
import { DataTable } from '../../components/common/DataTable.jsx';
import { FormFieldsFor, userEditFields } from './FormFields.jsx';
import { DetailModal } from './DetailModal.jsx';

/** Builds select options from the raw API responses. Runs in render (memoised on language) so labels follow language changes. */
function buildOptions(page,extra,t) {
  if(!extra)return {};
  if(page==='auction')return {lots:extra[0].items.map(x=>({value:x._id,label:x.lotNumber+' · '+x.farmerName+' · '+x.commodity})),buyers:extra[1].items.filter(x=>x.active).map(x=>{const hold=x.ledger?.overdueCount>0,full=x.ledger?.limitFull;const v={name:x.name,reg:x.registrationNo};return {value:x._id,disabled:hold||full,label:hold?t('yard.opt.buyerHold',v):full?t('yard.opt.buyerFull',v):x.name+' · '+x.registrationNo}})};
  if(page==='weighment')return {lots:extra[0].items.filter(x=>['auctioned','weighed'].includes(x.status)).map(x=>({value:x._id,label:x.lotNumber+' · '+x.farmerName+' · '+labelFor(x.status)}))};
  if(page==='payments')return {bills:extra[0].items.filter(x=>x.status!=='cancelled').map(x=>({value:x._id,label:t('yard.opt.bill',{bill:x.billNumber,farmer:x.farmerName,amount:money(x.farmerNetPayable)})}))};
  if(page==='gatepass')return {lots:extra[0].items.map(x=>({value:x._id,label:t('yard.opt.passLot',{lot:x.lotNumber,farmer:x.farmerName,net:number(x.netWeight)})}))};
  if(page==='disputes')return {lots:extra[0].items.map(x=>({value:x._id,label:x.lotNumber+' · '+x.farmerName}))};
  if(page==='gate')return {commodities:(extra[0].item?.commodities||extra[0].commodities||[]).map(x=>({value:x,label:x}))};
  return {};
}

export function ModuleScreen({page,user,notify}) {
  const {t,lang}=useI18n();
  const cfg=pageConfig[page];const [rows,setRows]=useState([]);const [optionData,setOptionData]=useState(null);const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');const [query,setQuery]=useState('');const [formOpen,setFormOpen]=useState(false);const [busy,setBusy]=useState(false);const [pageNum,setPageNum]=useState(1);const [total,setTotal]=useState(0);
  const [detail,setDetail]=useState(null);const [editRow,setEditRow]=useState(null);
  const load=useCallback(async()=>{
    setLoading(true);setError('');
    try{
      const paged = cfg.endpoint + '?page=' + pageNum + '&limit=25' + (query && ['gate','sales','buyerledger'].includes(page) ? '&search=' + encodeURIComponent(query) : '');
      const [data,...extra]=await (async()=>{
        if(page==='auction')return Promise.all([api('/yard/tickets?page='+pageNum+'&limit=25'),api('/yard/lots?status=arrived&limit=100'),api('/yard/buyers?active=true&limit=100')]);
        if(page==='weighment')return Promise.all([api('/yard/weighments?page='+pageNum+'&limit=25'),api('/yard/lots?limit=100')]);
        if(page==='payments')return Promise.all([api('/yard/payments?page='+pageNum+'&limit=25'),api('/yard/bills?limit=100')]);
        if(page==='gatepass')return Promise.all([api('/yard/gate-passes?page='+pageNum+'&limit=25'),api('/yard/lots?status=paid&limit=100')]);
        if(page==='disputes')return Promise.all([api('/yard/complaints?page='+pageNum+'&limit=25'),api('/yard/lots?limit=100')]);
        if(page==='gate')return Promise.all([api(paged),api('/yard/settings')]);
        return [await api(paged)];
      })();
      const source=data.items||[];
      setRows(source);setTotal(Number(data.total ?? source.length));
      if(['auction','weighment','payments','gatepass','disputes','gate'].includes(page))setOptionData({page,extra});
    }catch(e){setError(e.message)}finally{setLoading(false)}
  },[page,cfg.endpoint,pageNum,query]);
  useEffect(()=>{load()},[load]);
  const options=useMemo(()=>optionData&&optionData.page===page?buildOptions(page,optionData.extra,t):{},[optionData,page,lang]);
  const filtered=useMemo(()=>{const base=query && !['gate','sales','buyerledger'].includes(page) ? rows.filter(item=>JSON.stringify(item).toLowerCase().includes(query.toLowerCase())) : rows;
    return page==='buyerledger'?base.map(b=>({...b,creditStatus:b.ledger?.overdueCount?t('yard.credit.overdue',{count:b.ledger.overdueCount}):b.ledger?.limitFull?t('yard.credit.full'):t('yard.credit.within')})):base;},[rows,query,page,lang]);
  const fields = page==='users' && editRow ? userEditFields() : FormFieldsFor(page,options);
  const create=async values=>{
    setBusy(true);
    try{
      if(page==='gatepass')await api('/yard/gate-passes/'+values.lotId+'/issue',{method:'POST',body:{overrideReason:values.overrideReason}});
      else if(page==='buyerledger' && editRow) await api('/yard/buyers/'+editRow._id,{method:'PATCH',body:values});
      else if(page==='users' && editRow) await api('/yard/users/'+editRow._id,{method:'PATCH',body:values});
      else await api(cfg.endpoint,{method:'POST',body:values});
      notify(editRow?t('yard.toast.buyerUpdated'):t('yard.toast.saved'));
      setEditRow(null); await load();
    }finally{setBusy(false)}
  };
  const rowAction=async item=>{
    try{
      if(page==='gate'){const detailData=await api('/yard/lots/'+item._id);setDetail({kind:'lot',data:detailData});return;}
      if(page==='auction'){setDetail({kind:'ticket',data:item});return;}
      if(page==='sales'){setDetail({kind:'bill',data:item});return;}
      if(page==='gatepass'&&item.status==='issued'){
        if(!window.confirm(t('yard.confirm.exit')))return;
        await api('/yard/gate-passes/'+item._id+'/dispatch',{method:'POST',body:{}});
        notify(t('yard.toast.exitRecorded'));await load();return;
      }
      if(page==='disputes'){
        if(!['admin','inspector'].includes(user.role)){setDetail({kind:'complaint',data:item});return;}
        const nextStatus=item.status==='open'?'investigating':'resolved';
        let resolution='';
        if(nextStatus==='resolved'){resolution=window.prompt(t('yard.prompt.resolution'))||'';if(resolution.trim().length<3)return;}
        await api('/yard/complaints/'+item._id,{method:'PATCH',body:{status:nextStatus,...(resolution?{resolution}: {})}});
        notify(t('yard.toast.complaintUpdated'));await load();return;
      }
      if(page==='buyerledger'){setEditRow(item);setFormOpen(true);return;}
      if(page==='users'){
        if(String(item._id)===String(user.id)){notify(t('yard.toast.ownAccount'),'error');return;}
        setEditRow(item);setFormOpen(true);return;
      }
    }catch(e){notify(e.message,'error')}
  };
  const onExport=async()=>{
    try {
      const all=[];
      let current=1, pageTotal=1;
      do {
        const url=cfg.endpoint+'?page='+current+'&limit=100'+(query&&['gate','sales','buyerledger'].includes(page)?'&search='+encodeURIComponent(query):'');
        const response=await api(url);
        all.push(...(response.items||[]));
        pageTotal=Math.max(1,Math.ceil(Number(response.total??all.length)/100));
        current++;
      } while(current<=pageTotal && current<=100);
      exportCsv(all,columnsFor(page),(page==='gate'?'apmc-lot-register':page)+'-export.csv');
      notify(t('yard.toast.csvReady',{count:all.length}));
    } catch(error) { notify(error.message,'error'); }
  };
  return <div className="page-stack">
    <div className="page-head"><div><span className="eyebrow">{t('yard.page.'+page+'.eyebrow')}</span><h1>{t(cfg.titleKey)}</h1><p>{t(cfg.subtitleKey)}</p></div><div className="page-actions">
      {cfg.createLabelKey&&cfg.createRoles.includes(user.role)&&<button className="btn primary" onClick={()=>setFormOpen(true)}>＋ {t(cfg.createLabelKey)}</button>}
      <button className="btn ghost" onClick={load}><RefreshCw size={15}/> {t('yard.refresh')}</button>
      <button className="btn ghost" onClick={onExport} disabled={!rows.length}><ArrowDownToLine size={15}/> {t('yard.csv')}</button>
    </div></div>
    <section className="surface-card">
      <div className="table-toolbar"><div className="table-info"><b>{t(cfg.titleKey)}</b><span>{t('yard.recordsInfo',{count:filtered.length})}</span></div><label className="search-box"><Search size={15}/><input placeholder={t('yard.search.ph')} value={query} onChange={e=>{setQuery(e.target.value);setPageNum(1)}}/></label></div>
      {error&&<div className="inline-error"><AlertCircle size={15}/>{error}</div>}
      {loading?<div className="loading-panel"><RefreshCw className="spin" size={17}/> {t('yard.loadingRecords')}</div>
      :<><DataTable columns={columnsFor(page)} rows={filtered} onRowAction={['gate','auction','sales','gatepass','disputes','users','buyerledger'].includes(page)?rowAction:null} secondaryAction={page==='auction'?{label:t('yard.action.print'),onClick:tk=>setDetail({kind:'ticketprint',data:tk})}:page==='gatepass'?{label:t('yard.action.pass'),onClick:p=>setDetail({kind:'passprint',data:p})}:null} actionLabel={t(['gatepass','disputes','users','buyerledger'].includes(page)?'yard.action.'+page:'yard.action.default')}/>
        {total>25&&<div className="pagination"><span>{t('yard.pagination.info',{from:(pageNum-1)*25+1,to:Math.min(pageNum*25,total),total})}</span><div><button className="btn ghost" disabled={pageNum<=1} onClick={()=>setPageNum(v=>Math.max(1,v-1))}>{t('yard.pagination.prev')}</button><button className="btn ghost" disabled={pageNum>=Math.ceil(total/25)} onClick={()=>setPageNum(v=>v+1)}>{t('yard.pagination.next')}</button></div></div>}
      </>}
    </section>
    {page==='weighment'&&<div className="notice-panel"><Scale size={17}/> {t('yard.notice.weighment')}</div>}
    {page==='payments'&&<div className="notice-panel"><Wallet size={17}/> {t('yard.notice.payments')}</div>}
    {page==='gatepass'&&<div className="notice-panel"><Truck size={17}/> {t('yard.notice.gatepass')}</div>}
    {formOpen&&<FormDialog title={editRow?(page==='users'?t('yard.dialog.editStaff'):t('yard.dialog.editBuyer')):t(cfg.createLabelKey)} fields={fields} initialValues={editRow||{}} onClose={()=>{setFormOpen(false);setEditRow(null)}} onSubmit={create} busy={busy} submitLabel={t('common.save')}/>}
    {detail&&<DetailModal detail={detail} user={user} onPrint={t=>setDetail({kind:'ticketprint',data:t})} onClose={()=>setDetail(null)} onVoidTicket={async(ticket,reason)=>{await api('/yard/tickets/'+ticket._id+'/void',{method:'POST',body:{reason}});notify(t('yard.toast.ticketCancelled'));setDetail(null);await load();}}/>}
  </div>;
}
