# APMC Yard — SaaS Architecture Implementation Checklist

Single source of truth for the restructuring effort. Tick items as they are completed and verified.

- **Branch:** `refactor/saas-architecture` (branched from `mern-migration`)
- **Status key:** `[x]` done and verified · `[ ]` not done · `[~]` partially done · `[!]` blocked / needs a decision
- **Rule:** nothing is committed or pushed without explicit approval.

---

## 0. Ground rules (apply to every task)

| # | Rule | Verification |
|---|------|--------------|
| G1 | All work is done on a new branch, never directly on the current branch | `git branch --show-current` |
| G2 | No change to UI/UX, CSS, fonts, layouts or screen appearance | CSS bundle hash identical to baseline (`index-BdIdFqZL.css`) |
| G3 | No change to functionality, business logic, workflows or API behaviour | Route table + role-guard diff vs baseline; unit tests |
| G4 | No feature removed or modified | Manual review of moved code; routes identical |
| G5 | Backward compatible (URLs, payloads, response shapes, DB collection/model names, env var names) | Route diff; model names unchanged |
| G6 | No unrelated changes | Diff review before commit |
| G7 | No commit or push without approval | Git history unchanged |

- [x] G1 branch `refactor/saas-architecture` created
- [x] G2 CSS unchanged (hash identical)
- [x] G3 30/30 routes and all role guards identical to baseline
- [x] G5 model names, env var names, response shapes preserved
- [x] G7 nothing committed or pushed

---

## 1. Baseline and review

- [x] **1.1 Review frontend and backend architecture** — Outcome: one 593-line routes file, one 529-line `App.jsx`, two unmounted route files, single-tenant schema identified.
- [x] **1.2 Capture baseline** — server tests (6/6) and client build green before changes.
- [x] **1.3 Snapshot API surface** — method + path + role list for all 30 routes saved for before/after diff.
- [ ] **1.4 Re-run baseline `npm audit`** and record findings (not yet done).

---

## 2. Backend architecture restructuring

Target layout (`mern/server/src`):

```
index.js  app.js
config/       env.js  db.js
routes/       auth, health, yard
controllers/  overview, lots, buyers, tickets, weighments, billing,
              gatePasses, complaints, reports, settings, users, audit, auth
services/     ticket, weighment, payment, gatePass, audit, counter, config, transaction
domain/       yardRules.js (pure rules)
models/       one file per model + index.js
middleware/   auth.js, errorHandler.js
utils/        logger, httpError, asyncHandler, pagination, dates, validation
scripts/      seedAdmin.js
```

| Done | Task | Implementation detail | Expected outcome |
|------|------|-----------------------|------------------|
| [x] | 2.1 Split entry point | `index.js` = bootstrap only; `app.js` = `createApp()` factory with no side effects | App testable without a network or DB |
| [x] | 2.2 Central config | `config/env.js` reads env once; same defaults and names as before; JWT issuer/audience/expiry constants | No scattered `process.env` |
| [x] | 2.3 DB module | `config/db.js` with same 10 s timeout and exit-on-failure behaviour | Unchanged startup behaviour |
| [x] | 2.4 Split models | `Operations.js` → 10 model files, schemas copied verbatim; `models/index.js` barrel | Same collections and indexes |
| [x] | 2.5 Thin routes | Routes only wire URL + `allowRoles` + controller | Authorization visible in one file |
| [x] | 2.6 Controllers | One file per module; HTTP concerns only; `asyncHandler` replaces repeated try/catch | Consistent error forwarding |
| [x] | 2.7 Services | Ticket issue/void, weighment + bill, payment, gate pass issue/dispatch moved verbatim; shared audit/counter/config/transaction helpers | Business logic separated from HTTP |
| [x] | 2.8 Remove monolith | `operations.routes.js` and `Operations.js` deleted | No dead monolith |
| [x] | 2.9 Consistent error handling | `fail(status,message)`, central `errorHandler` + `notFound`; response bodies unchanged (`{ message }`) | One error path |
| [~] | 2.10 Consistent API response structure | Existing shapes (`{ item }`, `{ items,total,page,limit }`) **kept** for compatibility | Standardising would break clients — see §9 |
| [ ] | 2.11 Request validation layer | Hand-written inline checks remain; introduce a schema library (e.g. zod) with per-route schemas | Declarative validation, uniform 400s |
| [ ] | 2.12 Remove unreachable code | `routes/gate.routes.js`, `routes/lots.routes.js`, `models/GateEntry.js` are never mounted (and `gate.routes.js` reads undefined `req.user.sub`) | Needs approval to delete |
| [ ] | 2.13 Move remaining business rules | Lot creation, complaint and settings logic still live in controllers; extract to services | Thin controllers everywhere |
| [ ] | 2.14 Backend tests for services | Integration tests with `mongodb-memory-server` (replica set for transactions) | Regression safety for money flows |

---

## 3. Frontend architecture restructuring

Target layout (`mern/client/src`):

```
main.jsx  App.jsx
layouts/            Workspace.jsx
features/           auth/Login · dashboard/Dashboard · yard/{ModuleScreen,DetailModal,FormFields}
                    settings/SettingsScreen · reports/ReportsScreen
components/common/  Modal · FormDialog · DataTable · StatCard · ErrorBoundary
constants/          roles · navigation · pageConfig
services/           api.js
utils/              format · csv · logger
```

| Done | Task | Implementation detail | Expected outcome |
|------|------|-----------------------|------------------|
| [x] | 3.1 Split `App.jsx` | Components moved byte-for-byte by line range; imports generated | `App.jsx` is a small session gate |
| [x] | 3.2 Reusable vs feature components | Generic UI in `components/common`, screens in `features/*` | Clear reuse boundary |
| [x] | 3.3 Constants | roles, navigation, page config extracted | No inline config in components |
| [x] | 3.4 Services | `api.js` → `services/api.js`; formatters → `utils/format.js` | One place for HTTP and session |
| [x] | 3.5 Import audit | ESLint `no-undef` run; caught and fixed a missed `field` export | 0 undefined identifiers |
| [ ] | 3.6 Break up `ModuleScreen` | ~105-line dense component handles 9 modules; split per module with a `useModuleData` hook | Maintainable screens |
| [ ] | 3.7 Routing | `react-router-dom` is installed and wrapped but unused; screens switch via local state. Moving to URL routes changes navigation/deep-link behaviour | Needs approval (behaviour change) |
| [ ] | 3.8 Client state | Evaluate context for session/user instead of prop drilling | Optional |
| [ ] | 3.9 Remove duplication | Repeated list/load/paginate patterns in screens | Shared hook/component |
| [ ] | 3.10 Prettier-style formatting | Code is dense one-liners; formatting pass would produce a large diff | Do as a separate commit |
| [ ] | 3.11 Frontend tests | Vitest + Testing Library for format utils, DataTable, Login | Regression safety |
| [~] | 3.12 Unused dependencies | `react-router-dom` unused at runtime; remove only after 3.7 decision | Safe removal |

---

## 4. Security

| Done | Task | Detail | Outcome |
|------|------|--------|---------|
| [x] | 4.1 Review authN/authZ | JWT (HS256, issuer/audience, 8 h), bcrypt cost 12, active-user check per request, `allowRoles` per route | Documented; behaviour unchanged |
| [x] | 4.2 Preserve authorization | Role lists diffed against baseline: identical | No privilege change |
| [x] | 4.3 Secrets handling | `server/.env` git-ignored; `.env.example` has placeholders only; logger redacts password/token/authorization | No secret leakage in logs |
| [x] | 4.4 Existing hardening retained | helmet, CORS allow-list, body size 1 MB, global + login rate limits, regex escaping on searches | Unchanged |
| [ ] | 4.5 **Multi-tenant isolation** | Schema is single-tenant: no `tenantId` on any model, one global `YardConfig`. Requires: tenant model, `tenantId` on every collection and unique index, tenant from JWT, mandatory tenant filter (e.g. Mongoose plugin), per-tenant counters/config, data migration, tests | **Behaviour/schema change — needs a decision and a migration plan** |
| [ ] | 4.6 Token storage | JWT in `localStorage` is XSS-exposed; consider httpOnly cookie + CSRF protection, refresh tokens, revocation | Changes auth flow |
| [ ] | 4.7 Fail fast on missing `JWT_SECRET` in production | Currently server starts and returns 500 on auth | Startup behaviour change |
| [ ] | 4.8 Proxy-aware rate limiting | Set `trust proxy` when deployed behind a load balancer; use shared store (Redis) for multi-instance | Correct client IPs and limits |
| [ ] | 4.9 Input validation/sanitisation | Schema validation (see 2.11); reject unknown fields; date-parameter validation on `/lots` (invalid `from`/`to` currently surface as 500) | Uniform 400s |
| [ ] | 4.10 Password policy / lockout | Min 12 chars exists; add per-account lockout and audit of failed logins | Optional |
| [ ] | 4.11 Dependency audit | `npm audit`, pin and update vulnerable packages | Clean report |
| [ ] | 4.12 Security headers for the client host | CSP, HSTS at the web server / CDN | Deployment task |

---

## 5. Logging and monitoring

| Done | Task | Detail | Outcome |
|------|------|--------|---------|
| [x] | 5.1 Server structured logger | `utils/logger.js`: JSON lines in production, readable text in dev, `LOG_LEVEL`, deep redaction of sensitive keys | Machine-parsable logs |
| [x] | 5.2 Log events | info: startup, DB connected, login success, HTTP access (morgan → logger in prod); warn: failed login, permission denied, rejected 4xx; error: 5xx with stack, DB failure, missing `JWT_SECRET` | Useful signals, no PII |
| [x] | 5.3 Process-level handlers | `unhandledRejection` logged; `uncaughtException` logged and exit | No silent crashes |
| [x] | 5.4 Never log sensitive data | No request bodies, passwords, tokens or emails in logs (login failure logs IP only) | Compliance |
| [x] | 5.5 Client logger | `utils/logger.js`: redaction, debug suppressed in production; API failures logged at warn | Central hook for a monitor |
| [x] | 5.6 Error boundary | Logs render errors; fallback only shown after a crash | Visible failures |
| [ ] | 5.7 Request correlation IDs | Add `x-request-id` middleware and include in every log line and error response header | Traceability |
| [ ] | 5.8 Readiness vs liveness | `/api/health` reports DB state but always returns 200; add `/ready` returning 503 when DB is down | Orchestrator-friendly |
| [ ] | 5.9 Metrics and alerting | Prometheus/CloudWatch metrics, error-rate alerts, uptime check | Production monitoring |
| [ ] | 5.10 Client error reporting | Wire logger to Sentry/RUM | Frontend visibility |
| [ ] | 5.11 Audit-log review | Business audit log (`AuditLog`) is separate and unchanged; confirm retention policy | Governance |

---

## 6. Production readiness

| Done | Task | Detail | Outcome |
|------|------|--------|---------|
| [x] | 6.1 Env/config review | Central `config/env.js`; `.env.example` gains `NODE_ENV`, `LOG_LEVEL` | Documented configuration |
| [x] | 6.2 Error/exception handling | `asyncHandler`, central error middleware, process handlers | No unhandled rejections |
| [x] | 6.3 Docs | `mern/README.md` structure section | Onboarding |
| [x] | 6.4 CI compatibility | Existing workflow (`npm test`, `build`, `node --check`) still valid | Green pipeline |
| [ ] | 6.5 Add lint to repo | ESLint was run ad hoc outside the repo; add config + `npm run lint` + CI step | Enforced standards |
| [ ] | 6.6 Graceful shutdown | Handle `SIGTERM`: stop accepting requests, close Mongo | Zero-downtime deploys |
| [ ] | 6.7 Dockerfile / deployment config | Multi-stage build, non-root user, health check | Reproducible deploys |
| [ ] | 6.8 DB readiness | Transactions need a replica set; document and verify; index review; backups | Reliability |
| [ ] | 6.9 Scalability | Stateless API (shared rate-limit store), pagination caps already in place, avoid N+1 in ticket credit check | Horizontal scale |
| [ ] | 6.10 Legacy folder cleanup | `public/`, `hatchable.toml` belong to the earlier prototype; decide keep or archive | Repo clarity |
| [ ] | 6.11 Fix npm cache ownership | `~/.npm` has root-owned files, which breaks installs | Developer environment |

---

## 7. Functionality preservation

| Done | Check | Method |
|------|-------|--------|
| [x] | 7.1 All 30 endpoints present with same method/path | Route-table diff |
| [x] | 7.2 Role guards identical | `allowRoles` list diff |
| [x] | 7.3 Domain rules unchanged and tested | `yardRules.test.js` 6/6 |
| [x] | 7.4 New utilities tested | `utils.test.js` 4/4 |
| [x] | 7.5 Client builds, CSS identical | `vite build` |
| [x] | 7.6 Server boots, health/401/404/400 respond correctly | Smoke test with DB disabled |
| [ ] | 7.7 End-to-end regression against a real (test) database | Login → lot → ticket → weighment → payment → gate pass → dispatch, plus correction and void flows |
| [ ] | 7.8 Browser walkthrough of every screen and role | Manual or Playwright; compare screenshots to baseline |
| [ ] | 7.9 Verify transactional flows | Needs a replica-set test DB |

---

## 8. UI/UX redesign based on a reference website — **[!] BLOCKED**

This section was requested but conflicts with, and is not covered by, the original instructions:

- The original instructions say **"Do NOT change the existing UI/UX design, CSS, styling, fonts, layouts, or screen appearance."**
- **No reference website has been provided**, so no design requirements can be written.

Decision needed before any work starts:

- [!] 8.1 Confirm the redesign is wanted and supersedes the "no UI change" rule.
- [!] 8.2 Provide the reference URL(s) and the scope (all screens or specific ones).
- [!] 8.3 Provide constraints: Gujarati-first typography (DM Sans + Noto Sans Gujarati today), mobile support, accessibility target (WCAG level), branding.

Proposed approach once unblocked (not started):

| Step | Detail |
|------|--------|
| 8.4 Audit reference | Capture layout, colour, type scale, spacing, components, states |
| 8.5 Design tokens | Move colours/spacing/typography into CSS variables (`styles.css` already uses `:root` vars) |
| 8.6 Component restyle | Restyle `components/common/*` first, then feature screens |
| 8.7 Do it as a separate branch/commit | Keeps the architecture refactor reviewable and revertible |
| 8.8 Verify | Screenshot comparison per role, responsive checks, accessibility audit |

---

## 9. Items that need your decision

| # | Decision | Recommendation |
|---|----------|----------------|
| D1 | Add multi-tenancy (§4.5)? | Yes if SaaS is the goal, but as its own project with a migration plan |
| D2 | Delete dead route/model files (§2.12)? | Yes — unreachable and one has a bug |
| D3 | Standardise API response envelope (§2.10)? | Only with API versioning (`/api/v2`) to stay backward compatible |
| D4 | Switch to URL-based routing (§3.7)? | Yes, but as a separate, tested change |
| D5 | Move JWT to httpOnly cookie (§4.6)? | Yes, together with CSRF protection |
| D6 | UI redesign (§8)? | Provide the reference and approve a separate branch |

---

## 10. Progress summary

| Area | Done | Open |
|------|------|------|
| Ground rules | 5/5 verified | — |
| Backend architecture | 9 | 5 |
| Frontend architecture | 5 | 7 |
| Security | 4 | 8 |
| Logging | 6 | 5 |
| Production readiness | 4 | 7 |
| Functionality preservation | 6 | 3 |
| UI/UX redesign | 0 | blocked |

**Last verified:** server tests 10/10, client build OK, ESLint 0 errors (1 pre-existing warning), routes and role guards identical to baseline.
