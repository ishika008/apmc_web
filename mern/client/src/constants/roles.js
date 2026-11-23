import { t } from '../i18n/index.js';

const ROLE_IDS = ['admin', 'gate', 'auction', 'weighment', 'accounts', 'inspector'];

/**
 * Role id → display label. Each label is a getter, so `roles[x]` always returns the text for the CURRENT language
 * (nothing is translated at import time) while `Object.keys(roles)` stays the list of role ids.
 */
export const roles = {};
for (const id of ROLE_IDS) Object.defineProperty(roles, id, { enumerable: true, get: () => t('nav.role.' + id) });

/** Translated label for a role id; unknown roles are shown as-is. */
export const roleLabel = role => (ROLE_IDS.includes(role) ? t('nav.role.' + role) : String(role ?? ''));
