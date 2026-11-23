// Merges the per-feature translation files into one lookup table per language.
// To add a namespace: create locales/<name>.js exporting { gu, en, hi } and list it below.
import common from './common.js';
import nav from './nav.js';
import auth from './auth.js';
import dashboard from './dashboard.js';
import yard from './yard.js';
import forms from './forms.js';
import reports from './reports.js';
import settings from './settings.js';
import print from './print.js';
import server from './server.js';
import audit from './audit.js';
import status from './status.js';

export const NAMESPACES = { common, nav, auth, dashboard, yard, forms, reports, settings, print, server, status, audit };
export const LANGUAGE_CODES = ['gu', 'en', 'hi'];

export const messages = Object.fromEntries(LANGUAGE_CODES.map(code => [
  code, Object.assign({}, ...Object.values(NAMESPACES).map(ns => ns[code] || {}))
]));
