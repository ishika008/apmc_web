import { t } from '../i18n/index.js';
export const isOverdue = value => !!value && new Date(value).getTime() < Date.now();
/** Translated countdown label used by the yard deadlines (payment / dispatch / credit). */
export const deadlineLabel = value => {
  if (!value) return '—';
  const ms = new Date(value).getTime() - Date.now();
  if (ms < 0) return t('status.deadline.overdue');
  const hours = Math.ceil(ms / 3600000);
  return hours < 24 ? t('status.deadline.hours', { n: hours }) : (days => t(days === 1 ? 'status.deadline.day' : 'status.deadline.days', { n: days }))(Math.ceil(hours / 24));
};
