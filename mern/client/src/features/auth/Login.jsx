import { useState } from 'react';
import { AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';
import { api, setSession } from '../../services/api.js';
import { useI18n } from '../../i18n/index.js';
import { LanguageSelect } from '../../i18n/LanguageSelect.jsx';

export function Login({onLogin}) {
  const {t}=useI18n();
  const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  const submit=async e=>{e.preventDefault();setBusy(true);setError('');try{const data=await api('/auth/login',{method:'POST',body:{email,password}});setSession(data);onLogin(data.user)}catch(err){setError(err.message)}finally{setBusy(false)}};
  return <main className="login-page">
    <div className="login-art"><div className="login-brand"><span className="brand-logo">{t('nav.brandMark')}</span><div><b>{t('nav.brandName')}</b><small>{t('auth.brandSub')}</small></div></div><div className="login-message"><span className="eyebrow">{t('auth.eyebrow')}</span><h1>{t('auth.heroLine1')}<br/>{t('auth.heroLine2')}<br/><i>{t('auth.heroLine3')}</i></h1><p>{t('auth.heroText')}</p></div><div className="login-foot">{t('auth.foot')}</div></div>
    <div className="login-panel"><div className="login-lang"><LanguageSelect/></div><form className="login-form" onSubmit={submit}><span className="eyebrow">{t('auth.portal')}</span><h2>{t('auth.welcome')}</h2><p>{t('auth.intro')}</p>
      <label className="field"><span>{t('auth.email')}</span><input type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)} placeholder={t('auth.emailPlaceholder')}/></label>
      <label className="field"><span>{t('auth.password')}</span><input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder={t('auth.passwordPlaceholder')}/></label>
      {error&&<div className="inline-error"><AlertCircle size={15}/>{error}</div>}
      <button className="btn primary login-submit" disabled={busy}>{busy?t('auth.signingIn'):t('auth.signIn')}<ArrowRight size={16}/></button>
      <small className="login-help"><ShieldCheck size={14}/> {t('auth.help')}</small>
    </form></div>
  </main>;
}
