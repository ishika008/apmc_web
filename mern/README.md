# APMC Yard Digital — MERN workspace

The previous HTML/CSS/JavaScript demo remains in the repository root. This folder contains the MERN migration workspace.

## Stack
- React + Vite frontend
- Express + Node.js API
- MongoDB + Mongoose
- JWT session authentication, bcrypt password hashing, and role-based API access

## Run locally
Requirements: Node.js 20+ and MongoDB Atlas (recommended) or a MongoDB replica set.

1. Copy `.env.example` to `server/.env` and fill in database credentials, a long random JWT secret, and the first admin details.
2. From `mern/`, run `npm install`.
3. Create the first administrator once: `npm run seed:admin -w server`.
4. Remove `ADMIN_PASSWORD` from the environment file after provisioning (never commit `.env`).
5. Run `npm run dev`.
6. Frontend: http://localhost:5173. API health: http://localhost:5000/api/health.

## Roles
- admin: all modules, staff administration, configuration and approval overrides
- gate: gate entry, gate pass and physical dispatch
- auction: auction ticket issue / cancellation is admin-only
- weighment: weighbridge readings
- accounts: sale settlement, payments, buyers and credit
- inspector: complaints and audit review

## Implemented API foundation
- Authentication: `POST /api/auth/login`, `GET /api/auth/me`
- Dashboard: `GET /api/yard/overview`
- Gate / lots: `GET/POST /api/yard/lots`, `GET /api/yard/lots/:id`
- Buyers / credit: `GET/POST /api/yard/buyers`, `PATCH /api/yard/buyers/:id`
- Auction: `GET/POST /api/yard/tickets`, admin ticket void with reason
- Weighment and automatic sale bill: `GET/POST /api/yard/weighments`
- Bills and separate payment ledgers: `GET /api/yard/bills`, `GET/POST /api/yard/payments`
- Dispatch: `GET /api/yard/gate-passes`, issue and confirm dispatch endpoints
- Complaints: `GET/POST /api/yard/complaints`, status and resolution update
- Reports, settings, user administration and append-only audit log

## Important operational controls
- Auction ticket and serial references are generated server-side.
- Trader credit days, purchase exposure and overdue checks are applied before auction issue.
- Gross/tare/net are validated; weighment corrections require admin role, reason, and no prior settlement.
- Farmer settlements, trader purchase collections, and buyer-side dues are recorded in separate ledgers.
- Gate pass requires full farmer settlement and settled buyer-side dues. Dispatch deadline overrides require admin approval and a reason.
- Audit events are written server-side. Do not expose audit logs to non-admin/non-inspector roles.
- Payment entries only record a verified external transaction reference. This app does not itself transfer money.
- Weighbridge hardware, official e-auction, statutory permit, SMS/WhatsApp, bank APIs, legal rules, and production backups need real provider/committee credentials and operational verification.

## Deployment note
Multi-document operations use MongoDB transactions; use MongoDB Atlas or another replica-set deployment. Do not use a standalone MongoDB server for production. Configure HTTPS, backups, monitoring, secrets, data retention, and an approved APMC legal/accounting policy before live operation.

## Migration status
This is an actively built migration workspace, not yet a certified production release. Every workflow must be tested against the APMC's actual forms, approved bye-laws, fee rules, statutory processes, and hardware. The source of truth for current workflows is being migrated from the legacy demo; demo records are not imported automatically.

## Project structure

```
server/src
  index.js              process entry: env, DB connect, listen, crash handlers
  app.js                Express app factory (middleware + route mounting)
  config/               env.js (single source of env vars), db.js
  routes/               URL + role-guard wiring only (auth, health, yard)
  controllers/          HTTP layer: parse request, call service/model, send response
  services/             business flows and shared infra (tickets, weighment, payments,
                        gate passes, audit, counters, yard config, transactions)
  domain/               pure business rules (yardRules.js, unit tested)
  models/               one Mongoose model per file, models/index.js re-exports
  middleware/           auth (JWT + allowRoles), errorHandler/notFound
  utils/                logger (structured, redacting), httpError, asyncHandler, pagination, dates, validation
  scripts/              seedAdmin.js
client/src
  main.jsx, App.jsx     bootstrap + session gate
  layouts/              Workspace (shell, navigation)
  features/             auth, dashboard, yard (module screens), settings, reports
  components/common/    reusable UI (Modal, FormDialog, DataTable, StatCard, ErrorBoundary)
  constants/            roles, navigation, pageConfig
  services/api.js       fetch wrapper + session storage
  utils/                format, csv, logger
```

Logging: server logs are JSON lines in production (`LOG_LEVEL` controls verbosity) and
passwords, tokens and authorization headers are redacted. Request bodies are never logged.
