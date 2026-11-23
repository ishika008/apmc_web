import { Activity, CircleHelp, DoorOpen, Gavel, LayoutDashboard, ReceiptText, Scale, Settings, Users, Wallet, FileBarChart, Truck, UserCog } from 'lucide-react';
import { roles } from './roles.js';
import { t } from '../i18n/index.js';

const ALL = Object.keys(roles);
// `label` / `sub` are getters resolved through the translation catalogue at access time (never at import time).
const item = (id, icon, itemRoles) => ({
  id, icon, roles: itemRoles,
  get label() { return t('nav.item.' + id); },
  get sub() { return t('nav.item.' + id + '.sub'); }
});

export const navigation = [
  item('dashboard', LayoutDashboard, ALL),
  item('gate', DoorOpen, ['admin','gate','auction','weighment','accounts','inspector']),
  item('auction', Gavel, ['admin','auction','accounts','inspector']),
  item('weighment', Scale, ['admin','weighment','accounts','inspector']),
  item('sales', ReceiptText, ['admin','accounts','inspector']),
  item('payments', Wallet, ['admin','accounts']),
  item('buyerledger', Users, ['admin','accounts']),
  item('gatepass', Truck, ['admin','gate','inspector']),
  item('disputes', CircleHelp, ALL),
  item('reports', FileBarChart, ALL),
  item('audit', Activity, ['admin','inspector']),
  item('users', UserCog, ['admin']),
  item('settings', Settings, ['admin'])
];
