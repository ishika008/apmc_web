# APMC Yard Management – Test Report

Date: 2026-11-22 · Scope: `mern/server` (Express + Mongoose), `mern/client` (React + Vite), legacy static app `public/`
Nothing has been committed or pushed.

## 1. Summary

| Area | Tests | Passed | Failed | Skipped | Pass % |
|---|---:|---:|---:|---:|---:|
| Server (real MongoDB replica set) | 216 | 216 | 0 | 0 | 100% |
| Client + legacy app (vitest/jsdom) | 235 | 235 | 0 | 0 | 100% |
| **Total** | **451** | **451** | **0** | **0** | **100%** |

Before this work: 14 server tests (4 of them integration, which are skipped unless `TEST_MONGODB_URI` is set) and 0 client tests.

**Important caveat – skipped tests without a database.** The server integration tests need a MongoDB *replica set* (the services use transactions). Without `TEST_MONGODB_URI`, `npm test -w server` runs 216 tests with **60 passing and 156 skipped**. The existing CI workflow has no MongoDB service, so CI currently skips those 156 (see §6).

**Server coverage** (`node --test --experimental-test-coverage`, loaded files only, measured at 215 tests before the audit-log test was added): 99.85% lines, 96.23% branches, 97.62% functions. The only uncovered lines are the missing-`JWT_SECRET` branches in `auth.controller.js` and `middleware/auth.js`; they *are* tested, but in child processes that the coverage tool cannot see. `src/index.js`, `routes/gate.routes.js` and `routes/lots.routes.js` do not appear in the report because they are never loaded in-process (the last two are dead code, §6).
**Client coverage** (reported by the client sub-agent, *not independently reproduced*): 100% statements/lines, 95.4% branches, 87.5% functions.

## 2. How the tests are built

* **No mocks of application behaviour.** Server integration tests boot the real Express app (`createApp()`) against a real MongoDB replica set and call it over HTTP. Users, JWTs and data are real; each test file gets its own throwaway database that is dropped afterwards. The only browser-side stub is `fetch` at the network boundary in client tests.
* **Existing conventions kept:** `node:test` on the server (as already used), same `TEST_MONGODB_URI` switch, tests under `server/test/`. The shared helper lives in `server/test-support/` (outside `test/` so it is not run as a test).
* **Client:** vitest + jsdom + Testing Library (new dev-dependencies).
* **"End-to-end" here means** full API workflows (gate → auction → weighment → bill → payment → gate pass → dispatch), the real server process (`src/index.js`), the seed script, and jsdom UI flows. **There is no real-browser E2E (Playwright/Cypress) suite.**

## 3. Module-wise results

### Server (216)

| Module | Test file | Tests | Pass | Fail |
|---|---|---:|---:|---:|
| Domain rules (existing) | `yardRules.test.js` | 6 | 6 | 0 |
| Domain rules – boundaries, ordering, rounding | `yardRules.edge.test.js` | 13 | 13 | 0 |
| Utils (existing) | `utils.test.js` | 4 | 4 | 0 |
| Utils – dates, ids, regex, pagination, logger | `utils.edge.test.js` | 9 | 9 | 0 |
| Mongoose schemas (all 13 models), audit-log immutability | `models.schema.test.js` | 16 | 16 | 0 |
| Env config, DB connect (child processes) | `config.env.test.js` | 5 | 5 | 0 |
| Error handler, role guard | `errorHandler.test.js` | 7 | 7 | 0 |
| App: health, headers, CORS, 404, body limits | `app.integration.test.js` | 8 | 8 | 0 |
| Auth: login, `/me`, JWT attacks, deactivation | `auth.integration.test.js` | 12 | 12 | 0 |
| Rate limiters (login 8/15min, global 300) | `limiter.integration.test.js` | 3 | 3 | 0 |
| RBAC: every route × every role | `rbac.integration.test.js` | 8 | 8 | 0 |
| Gate entry / lots | `lots.integration.test.js` | 14 | 14 | 0 |
| Buyers, credit limit/hold, auction tickets, void | `buyers.tickets.integration.test.js` | 21 | 21 | 0 |
| Weighment, bills, payments, gate pass, dispatch | `billing.workflow.integration.test.js` | 31 | 31 | 0 |
| Complaints, settings, users, audit log | `admin.modules.integration.test.js` | 24 | 24 | 0 |
| Overview, dashboard, nav counts, search, reports, CSV | `reporting.integration.test.js` | 19 | 19 | 0 |
| Races (parallel payments, passes, tickets, numbering) | `concurrency.integration.test.js` | 7 | 7 | 0 |
| `seedAdmin` script + real server entrypoint | `scripts.integration.test.js` | 5 | 5 | 0 |
| Original full workflow (existing) | `integration.test.js` | 4 | 4 | 0 |

### Client + legacy (235)

| Module | Tests |
|---|---:|
| `utils/format` (incl. `textValue`) | 23 |
| `utils/time` · `utils/csv` · `utils/logger` | 6 · 7 · 4 |
| `constants` (roles, navigation, pageConfig) | 9 |
| `services/api` (session, auth header, 401 handling, downloads) | 17 |
| `components/common` (8 components) | 30 |
| `features/yard/FormFields` | 11 |
| `features/auth/Login` | 7 |
| `features/dashboard` (Dashboard, YardLive) | 9 |
| `features/reports/ReportsScreen` | 10 |
| `features/settings/SettingsScreen` | 8 |
| `features/yard/DetailModal` | 9 |
| `features/yard/ModuleScreen` (every page) | 28 |
| `layouts/Workspace` | 20 |
| `App` | 9 |
| Legacy `public/app.js` + `index.html` (jsdom) | 28 |

## 4. Failures found, root causes and fixes

Each test was first written to assert the *intended* behaviour; the failures below are real defects, not test adjustments. Every fix is minimal.

| # | Symptom (failing test) | Root cause | Fix |
|---|---|---|---|
| 1 | **Void a ticket, then re-auction the same lot → 500** (duplicate key). The UI tells the user the lot is "available in the auction queue again". | `AuctionTicket.lot` had a plain unique index, but a voided ticket keeps its `lot`. | `models/AuctionTicket.js`: dropped `unique` on `lot`; added unique index `{lot, voidedAt}` (one *active* ticket per lot, voided history allowed). **Needs an index migration on existing databases, §6.** |
| 2 | `POST /auth/login` with a numeric `password` → **500** with message `Illegal arguments: number, string` (internal detail leaked). | `bcrypt.compare` throws on non-strings; only truthiness was checked. | `auth.controller.js`: `email` and `password` must be strings → 400. Also blocks object-valued `email`. |
| 3 | `GET /lots?from=garbage` → **500**. | Invalid `Date` reached Mongoose as a CastError. | `lots.controller.js`: validate parsed dates → 400 (same convention as `getSummary`). |
| 4 | Buyer create/update with `creditDays: 91`, settings with negative fees, complaint resolution > 5000 chars → **500**. | Mongoose `ValidationError`/`CastError` have no `status`, so the handler defaulted to 500. | `middleware/errorHandler.js`: those two error names map to 400 (explicit `status` still wins). |
| 5 | Parallel auction of one lot: exactly one ticket is created (integrity OK) but the losers got **500 with a raw `E11000` message**. | `createTicket` did not map duplicate-key errors (payments and gate passes already do). | `tickets.controller.js`: code 11000 → 409 "Lot is not available for auction". |
| 6 | `/reports/summary` counted **voided** tickets; overview, catalog, dashboard and ticket register exclude them. | Missing `voidedAt: null` filter. | `reports.controller.js`: added the filter. |
| 7 | `isId(5)` → true, so `{ lotId: 5 }` skipped the 400 and surfaced as 409/404 later. | Mongoose treats numbers as castable ObjectIds. | `utils/validation.js`: numbers rejected. |
| 8 | **Audit log was not actually append-only.** `updateMany`, `replaceOne` and `findOneAndDelete` succeeded on `AuditLog` (a probe deleted an entry). Only `updateOne`, `findOneAndUpdate`, `deleteOne` and `deleteMany` were blocked. | The schema hooks covered only four operations. | `models/AuditLog.js`: same `append-only` error now also thrown for `updateMany`, `replaceOne`, `findOneAndReplace`, `findOneAndDelete`, `save()` on an existing entry and document `deleteOne()`. Creating entries is unaffected. |
| 9 | Client: status cells rendered **"Invalid Date"**, and registration numbers like `GJ-SRT-TR-041` rendered as dates. | `textValue` used `key.includes('at')`, which matches `status`, `creditStatus`, `registrationNo`, `village`, `vehicle`, `commodity`. | `client/src/utils/format.js`: match `/At$/`. Verified failing before the fix, passing after. |

**Test-side fix (not an app defect):** the pre-existing `integration.test.js` passed alone but failed in 3 of 3 full-suite runs ("second gate pass for same lot" returned 201). Cause: Mongoose builds unique indexes in the background and the test did not wait, so under parallel load the `GatePass.lot` unique index did not exist yet. Added `await Model.init()` for all models in its `before()`. After that, 3 of 3 full runs pass (215/215 at the time; 216/216 after the later audit-log test). The new tests use the same wait via the shared harness.

Also touched: `server/package.json` (added `test:coverage` script), client `package.json` / `vite.config.js` / `src/test/*` (test tooling), `.github/workflows/mern-ci.yml` (added a client test step).

## 5. Business-logic behaviour that was pinned, not changed

* **Weighment net is rounded to 2 decimals** (`calculateWeighment` reuses `roundMoney`) while the UI accepts 3-decimal readings (quintals). A net below 0.005 Q rounds to 0 and is rejected; 3-decimal gross/tare are not exactly reflected in the net. Pinned in `yardRules.edge.test.js`. **Needs a business decision** (the rule was left as is).
* A bill whose seller deduction equals the gross amount is created as `paid` and its lot as `paid`, so a gate pass can be issued. Tested and consistent.
* `PATCH /settings` with a bare string for `commodities` is cast by Mongoose to a one-item list and accepted.

## 6. Remaining issues and recommendations

1. **Index migration (needed for fix #1).** Existing databases still have the old unique index. Run once: `db.auctiontickets.dropIndex("lot_1")`. Mongoose will create the new `{lot, voidedAt}` index on start. Until then void → re-auction still fails on that database.
2. **CI does not run the integration tests.** `mern-ci.yml` has no MongoDB. 156 of 216 server tests are skipped there. Recommended: add a Mongo service started with `--replSet rs0` plus an `rs.initiate()` step, and set `TEST_MONGODB_URI`. I did not change deployment pipeline beyond adding the client test step.
3. **Client test dependencies are declared but not installed in the project.** `mern/node_modules` is owned by root, so `npm install` failed with EACCES for the sub-agent and `package-lock.json` was not updated. Fix: `sudo chown -R $(whoami) mern/node_modules ~/.npm`, then `cd mern && npm install`. **`npm run test -w client` has therefore never been run in the real project**; the 235 passes were obtained with an equivalent scratch harness that points at the real `src/`, `vite.config.js` and `public/`. A production `vite build` of the real sources succeeds.
4. **Dead code:** `server/src/routes/gate.routes.js` and `lots.routes.js` are not mounted. They use roles that do not exist (`clerk`, `gate_operator`), read `req.user.sub` (undefined on a Mongoose document) and write a `quantity` field the `Lot` schema lacks. The app test verifies they are unreachable. Not touched (out of scope); suggest deleting.
5. **ReportsScreen default dates** use UTC (`toISOString().slice(0,10)`), so before 05:30 IST the default range is yesterday. Behaviour decision left to you.
6. **No real-browser E2E.** UI flows are tested in jsdom only.
7. Observations, no change made: `cleanPage` accepts fractional page numbers (`page=2.7`). Audit-log immutability is enforced by Mongoose middleware only; direct driver access (`Model.collection`) or database-level writes bypass it, so database permissions (or a write-once collection) are still needed for a legal-grade audit trail.
8. The working tree already contained substantial uncommitted work before this task (dashboard, reports, search, print components and more); these tests cover it as it stands.

## 7. How to run

```bash
# one-time: local replica set for server integration tests
mongod --dbpath /tmp/apmc-test-db --port 27555 --replSet rs0 --bind_ip 127.0.0.1 --fork --logpath /tmp/apmc-test-db.log
mongosh --port 27555 --eval 'rs.initiate({_id:"rs0",members:[{_id:0,host:"127.0.0.1:27555"}]})'

cd mern
TEST_MONGODB_URI="mongodb://127.0.0.1:27555/?replicaSet=rs0" npm test -w server            # 216 tests
TEST_MONGODB_URI="mongodb://127.0.0.1:27555/?replicaSet=rs0" npm run test:coverage -w server
npm run test -w client            # after fixing node_modules ownership, §6.3
npm run test:coverage -w client
```

Tests never touch the database named in `server/.env`; they create and drop their own databases on the URI above. Script/entrypoint tests run in an empty working directory so `dotenv` cannot load `server/.env`.

## 8. Second pass: live-stack run and log review (2026-11-22)

* **Regression:** server 216/216 (real replica set), client + legacy 235/235 (scratch harness, see §6.3). No source changes were needed in this pass.
* **Live stack:** the real server process (`src/index.js`, debug logging on) plus Vite with its API proxy, on a throwaway database, ports 5002/5174 (your dev servers and data were not touched). A script drove login, user creation for all 5 roles, lot → ticket → weighment → bill → payment → gate pass → dispatch → complaint, then every GET module and all 7 CSV exports through the Vite proxy: **0 failures**.
* **Logs:** the real server log for that run contained **no WARN or ERROR lines**. Server and client suite output shows no Mongoose, deprecation or duplicate-index warnings. A source scan found **no stray debug logging**: the only `console.*` calls are the structured logger itself and two intentional `seedAdmin.js` messages.
* **Not done:** real-browser clicking. The Claude-in-Chrome extension was not connected (no browsers listed), so rendering, console errors and visual behaviour in a real browser were **not** tested; UI behaviour is covered by the jsdom tests only.
* The Vite warning `Cannot find package 'react-refresh'` seen in that run came from my temporary config file living outside the project; it is not an app issue.

## 9. UI alignment with the reference design + multilingual support (2026-11-22)

**Reference:** the supplied URL serves the legacy `public/` app; its `styles.css` and `app.js` are byte-identical to the local files (only a platform badge script is injected). Its language button is a placeholder (flips a label), so the translation system was built from scratch.

**Result:** client suite 397/397 (was 235; +162 tests: i18n core 13, yard i18n 34, shell/screens/common i18n 77, utils/api/server-message 29, shell layout 9). Production build succeeds. The server was not changed in this pass.

**What changed**
* New `src/i18n/` module: `t()`, `useI18n()`, persisted language (`localStorage`, mirrored to `<html lang>`), `LanguageSelect` (topbar and login), per-feature catalogues in `i18n/locales/*.js` for **Gujarati (default, original text kept verbatim), English and Hindi** (~560 keys each). A parity test fails if any key, placeholder or script is missing or mixed in any language. Server (API) messages are translated by exact or `{pattern}` match (86 messages); a test fails if the server gains an untranslated message. Dates follow the language locale; amounts keep Indian digit grouping.
* Shell restyled to the reference: white sidebar, "અ" brand mark + YardOS wordmark, yard card, sectioned and numbered navigation, breadcrumb, search · language · bell · user cluster, two-part footer bar, reference tokens (colours, 13px base, Noto Sans Gujarati/Devanagari + DM Sans), cards, tables with status dots, pills, modals, forms, toasts; responsive breakpoints 1150 / 820 / 560 as in the reference. Page headings, subtitles and kickers use the reference's Gujarati wording.
* Raw API path in the page kicker ("· /YARD/LOTS") removed.

**Verified in a real browser (headless Chrome against the running app)**: every screen at desktop/tablet/phone sizes compared with the reference; language switch on login and in-app; persistence across reload; Hindi and English across all 13 screens and the create form show no Gujarati UI text; no console errors.

**Not done / decisions for you**
* Not matched on purpose: demo banner, "DEMO DATA" notice and demo-reset (the reference is a prototype with sample data); the **help card** (it links nowhere in the reference, so it would be a dead control); the dashboard's demo line chart (this app shows real arrivals-per-hour bars). The "Authenticated" status pill was kept (existing UI), restyled.
* Only the default Gujarati headings were aligned to the reference wording; English/Hindi headings are natural translations.
* **Hindi was written by me and needs a native-speaker review.** Gujarati dashboard stat labels keep the app's existing mixed Gujarati/English wording.
* Commodity names are data (yard settings) and are displayed as stored in every language; the API matches them exactly.
* `npm run test -w client` still needs the `node_modules` ownership fix (§6.3); results above are from the equivalent scratch harness.
