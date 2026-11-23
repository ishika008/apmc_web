import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { api, getSession, clearSession } from './services/api.js';
import { Login } from './features/auth/Login.jsx';
import { Workspace } from './layouts/Workspace.jsx';
import { useI18n } from './i18n/index.js';

export default function App() {
  const {t}=useI18n();
  const [session,setSessionState]=useState(()=>getSession());
  const [user,setUser]=useState(()=>getSession()?.user||null);
  const [checking,setChecking]=useState(Boolean(getSession()?.token));
  const [toast,setToast]=useState(null);
  useEffect(()=>{
    const expired=()=>{setSessionState(null);setUser(null);setChecking(false);setToast({message:t('auth.sessionExpired'),type:'error'});};
    window.addEventListener('apmc:auth-expired',expired);
    return()=>window.removeEventListener('apmc:auth-expired',expired);
  },[]);
  useEffect(()=>{
    if(!session?.token){setChecking(false);return;}
    let active=true;
    api('/auth/me').then(data=>{if(active)setUser(data.user)}).catch(()=>{if(active){setUser(null);setSessionState(null)}}).finally(()=>{if(active)setChecking(false)});
    return()=>{active=false};
  },[]);
  const notify=(message,type='success')=>{setToast({message,type});window.setTimeout(()=>setToast(null),3500)};
  const login=userData=>{setUser(userData);setSessionState(getSession());notify(t('auth.signedIn'))};
  const logout=()=>{clearSession();setSessionState(null);setUser(null);notify(t('auth.signedOut'))};
  if(checking)return <div className="boot-screen"><span className="brand-logo">A</span><b>{t('nav.brand')}</b><small>{t('auth.bootLoading')}</small></div>;
  return <>{user?<Workspace user={user} onLogout={logout} notify={notify}/>:<Login onLogin={login}/>}
    {toast&&<div className={'toast-message '+(toast.type==='error'?'toast-error':'')}><span>{toast.type==='error'?<AlertCircle size={16}/>:<CheckCircle2 size={16}/>}</span>{toast.message}</div>}
  </>;
}
