import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, ArrowRight, RefreshCw, Settings, ShieldCheck } from 'lucide-react';
import { api } from '../../services/api.js';
import { money } from '../../utils/format.js';
import { field } from '../yard/FormFields.jsx';
import { useI18n } from '../../i18n/index.js';

export function SettingsScreen({notify,onNavigate}) {
  const {t}=useI18n();
  const [buyers,setBuyers]=useState([]);
  useEffect(()=>{api('/yard/buyers?limit=100').then(d=>setBuyers(d.items||[])).catch(()=>{})},[]);
  const [value,setValue]=useState(null);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  const load=useCallback(async()=>{setError('');try{const data=await api('/yard/settings');setValue({...data.item,commodities:(data.item.commodities||[]).join('\n')})}catch(e){setError(e.message)}},[]);
  useEffect(()=>{load()},[load]);
  const set=(key,v)=>setValue(old=>({...old,[key]:v}));
  const save=async e=>{e.preventDefault();setBusy(true);setError('');try{
    const body={...value,commodities:value.commodities.split(/\r?\n|,/).map(x=>x.trim()).filter(Boolean)};
    for(const k of ['farmerPaymentDays','dispatchDays','defaultBuyerCreditDays','sellerApprovedDeduction','buyerMarketFee','buyerOtherDues'])body[k]=Number(body[k]);
    await api('/yard/settings',{method:'PATCH',body});notify(t('settings.saved'));await load();
  }catch(e){setError(e.message)}finally{setBusy(false)}};
  if(!value&&!error)return <div className="loading-panel">{t('settings.loading')}</div>;
  return <div className="page-stack"><div className="page-head"><div><span className="eyebrow">{t('settings.eyebrow')}</span><h1>{t('settings.title')}</h1><p>{t('settings.intro')}</p></div><button className="btn ghost" onClick={load}><RefreshCw size={15}/> {t('common.refresh')}</button></div>
    {error&&<div className="inline-error"><AlertCircle size={15}/>{error}</div>}
    {value&&<form className="surface-card settings-form" onSubmit={save}>
      <h2>{t('settings.identity')}</h2><div className="form-grid">
        {field('committeeName',t('settings.committeeName'))&&<label className="field"><span>{t('settings.committeeName')}</span><input value={value.committeeName||''} onChange={e=>set('committeeName',e.target.value)}/></label>}
        <label className="field"><span>{t('settings.yardCode')}</span><input value={value.yardCode||''} onChange={e=>set('yardCode',e.target.value)}/></label>
        <label className="field"><span>{t('settings.timezone')}</span><input value={value.timezone||'Asia/Kolkata'} onChange={e=>set('timezone',e.target.value)}/></label>
        <label className="field"><span>{t('settings.ticketPrefix')}</span><input value={value.ticketPrefix||''} onChange={e=>set('ticketPrefix',e.target.value)}/></label>
        <label className="field"><span>{t('settings.billPrefix')}</span><input value={value.billPrefix||''} onChange={e=>set('billPrefix',e.target.value)}/></label>
        <label className="field"><span>{t('settings.passPrefix')}</span><input value={value.passPrefix||''} onChange={e=>set('passPrefix',e.target.value)}/></label>
        <label className="field"><span>{t('settings.complaintPrefix')}</span><input value={value.complaintPrefix||''} onChange={e=>set('complaintPrefix',e.target.value)}/></label>
      </div><hr/>
      <h2>{t('settings.rules')}</h2><p className="form-description">{t('settings.rulesNote')}</p><div className="form-grid">
        {[
          ['farmerPaymentDays'],['dispatchDays'],['defaultBuyerCreditDays'],['sellerApprovedDeduction'],['buyerMarketFee'],['buyerOtherDues']
        ].map(([key])=><label className="field" key={key}><span>{t('settings.'+key)}</span><input type="number" min="0" step={key.toLowerCase().includes('days')?'1':'0.01'} value={value[key]??0} onChange={e=>set(key,e.target.value)}/></label>)}
      </div><hr/><h2>{t('settings.commodities')}</h2><label className="field"><span>{t('settings.commoditiesHint')}</span><textarea rows={6} value={value.commodities||''} onChange={e=>set('commodities',e.target.value)}/></label>
      <div className="notice-panel"><ShieldCheck size={17}/> {t('settings.notice')}</div>
      <hr/><h2>{t('settings.buyers')}</h2><p className="form-description">{t('settings.buyersNote')}</p>
      <div className="table-wrap"><table className="compact-table"><thead><tr><th>{t('settings.col.trader')}</th><th>{t('settings.col.registration')}</th><th>{t('settings.col.creditDays')}</th><th>{t('settings.col.limit')}</th><th>{t('settings.col.active')}</th></tr></thead><tbody>{buyers.length?buyers.map(b=><tr key={b._id}><td>{b.name}</td><td>{b.registrationNo||'—'}</td><td>{t('settings.days',{n:b.creditDays})}</td><td>{b.purchaseLimit?money(b.purchaseLimit):t('settings.limitOpen')}</td><td>{b.active?t('common.yes'):t('common.no')}</td></tr>):<tr><td colSpan={5}>{t('settings.noBuyers')}</td></tr>}</tbody></table></div>
      {onNavigate&&<button type="button" className="btn ghost" onClick={()=>onNavigate('buyerledger')}>{t('settings.manageBuyers')} <ArrowRight size={14}/></button>}
      <div className="form-actions"><button className="btn primary" disabled={busy}>{busy?t('settings.saving'):t('settings.saveConfig')} <ArrowRight size={15}/></button></div>
    </form>}</div>;
}
