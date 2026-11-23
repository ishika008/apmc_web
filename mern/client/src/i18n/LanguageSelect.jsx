import { useEffect, useRef, useState } from 'react';
import { useI18n } from './index.js';

/** Topbar / login language switcher ("GU ⌄" in the reference design). Selection persists across reloads. */
export function LanguageSelect({ className = '' }) {
  const { t, lang, languages, setLanguage } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const current = languages.find(l => l.code === lang) || languages[0];
  useEffect(() => {
    if (!open) return undefined;
    const away = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const esc = e => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open]);
  return <div className={'lang-select ' + className} ref={ref}>
    <button type="button" className="language-btn" aria-haspopup="listbox" aria-expanded={open} aria-label={t('common.language')} onClick={() => setOpen(v => !v)}>{current.short} <span>⌄</span></button>
    {open && <ul className="lang-menu" role="listbox" aria-label={t('common.language')}>
      {languages.map(l => <li key={l.code} role="option" aria-selected={l.code === lang}>
        <button type="button" className={l.code === lang ? 'active' : ''} onClick={() => { setLanguage(l.code); setOpen(false); }}><b>{l.short}</b> {l.label}</button>
      </li>)}
    </ul>}
  </div>;
}
