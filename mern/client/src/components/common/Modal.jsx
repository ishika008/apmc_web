import { useEffect } from 'react';
import { X } from 'lucide-react';
import { useI18n } from '../../i18n/index.js';

export function Modal({title,children,onClose,wide=false}) {
  const {t}=useI18n();
  useEffect(()=>{const onKey=e=>e.key==='Escape'&&onClose();window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey)},[onClose]);
  return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}>
    <section className={wide?'modal-card wide':'modal-card'} role="dialog" aria-modal="true">
      <header className="modal-heading"><div><span className="eyebrow">{t('common.modalEyebrow')}</span><h2>{title}</h2></div><button className="icon-btn" onClick={onClose} aria-label={t('common.close')}><X size={19}/></button></header>
      {children}
    </section>
  </div>;
}
