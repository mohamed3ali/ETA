# Smart E-Invoicing & ETA Reader SaaS

A modern, AI-first SaaS platform for Egyptian electronic invoicing (ETA) and tax automation. It acts as a smart layer on top of the Egyptian Tax Authority systems — businesses and accountants can manage invoices, sync tax documents, automate reminders, export reports, and analyze financial data without ever touching the ETA portal directly.

> **Product vision:** Not just an invoicing app — a **Smart Tax Assistant**, an **ETA Reader**, and an **AI-powered business operating layer**.

---

## Highlights

- **Multi-tenant SaaS** — every company is isolated; every query is scoped via `companyId` on the JWT.
- **Full invoice engine** — drafts, line items, VAT, discounts, statuses (`draft → submitted → accepted/rejected → paid/overdue`), PDF + QR, Excel exports.
- **ETA integration layer** — OAuth client-credentials, document mapper, submission, status fetch, sync logs, automatic retries via BullMQ.
- **Mock-friendly** — without ETA credentials, submissions run in **mock mode** so the entire flow (queue → status → UI) works end-to-end.
- **Queues + workers** — BullMQ on Redis: invoice submission, ETA sync, WhatsApp delivery.
- **Dashboard + analytics** — KPIs, monthly revenue/VAT trends, top customers, recent invoices.
- **AI assistant scaffold** — deterministic intent router with hooks for OpenAI; designed for "How many overdue invoices?" style questions.
- **Modern UI** — Next.js App Router, Tailwind, shadcn/ui, dark mode, mobile-first, ready for RTL/Arabic.
- **Production-ready ops** — Docker, Nginx reverse proxy, healthchecks, rate limiting, helmet, audit logs.

---

## Monorepo Layout

```
ETA/
├── backend/                      # Express + TypeScript + TypeORM + BullMQ
│   ├── src/
│   │   ├── app.ts                # Express bootstrap (middleware, swagger, routes)
│   │   ├── server.ts             # API entrypoint
│   │   ├── worker.ts             # BullMQ worker entrypoint
│   │   ├── config/               # env, logger, swagger
│   │   ├── common/               # base entity, middleware, errors, utils
│   │   ├── database/             # TypeORM data-source + Redis client
│   │   ├── queues/ & workers/    # BullMQ producers + consumers
│   │   ├── routes/               # composed routers
│   │   └── modules/
│   │       ├── auth/             # JWT auth + RBAC + register/login/refresh
│   │       ├── companies/        # tenant entity + settings
│   │       ├── branches/
│   │       ├── users/
│   │       ├── customers/
│   │       ├── products/
│   │       ├── invoices/         # CRUD + calculator + numbering + PDF + Excel
│   │       ├── payments/
│   │       ├── eta/              # ETA token, mapper, submit, fetch, logs
│   │       ├── dashboard/        # metrics & analytics
│   │       ├── subscriptions/
│   │       ├── ai/               # conversational layer
│   │       └── audit/
│   ├── Dockerfile
│   └── README.md
├── desktop-agent/                # Local eSeal signing helper (dev mock → .NET prod)
│   ├── src/server.ts             # localhost :8765 — /health, /sign
│   └── README.md
├── frontend/                     # Next.js App Router + Tailwind + shadcn/ui
│   ├── src/
│   │   ├── app/
│   │   │   ├── (auth)/           # /login, /register
│   │   │   ├── (dashboard)/      # protected app pages
│   │   │   └── page.tsx          # landing
│   │   ├── components/
│   │   │   ├── ui/               # shadcn primitives
│   │   │   ├── dashboard/        # Sidebar, Topbar, AuthGate
│   │   │   └── providers.tsx
│   │   ├── lib/                  # api client, utils, status badge map
│   │   └── store/                # Zustand auth store
│   ├── Dockerfile
│   └── README.md
├── nginx/nginx.conf
├── docker-compose.yml            # mysql + redis + api + worker + web + nginx
├── DEPLOYMENT.md                 # VPS deployment guide
└── README.md
```

## Tech Stack

| Layer          | Tech                                                                                  |
| -------------- | ------------------------------------------------------------------------------------- |
| Backend        | Node.js 20, Express 4, TypeScript 5, TypeORM 0.3, MySQL 8, Redis 7, BullMQ 5, JWT, Zod |
| Frontend       | Next.js 14, TypeScript 5, TailwindCSS 3, shadcn/ui (Radix), React Query 5, Zustand 4  |
| Infrastructure | Docker, Docker Compose, Nginx 1.25                                                    |
| Tooling        | Swagger UI, Pino logging, Helmet, CORS, rate limiting, bcrypt, ExcelJS, PDFKit, QRCode|

## Quick Start (Docker — recommended)

```bash
cp .env.example .env
docker compose up --build
```

Then open:

| URL                                | What                                |
| ---------------------------------- | ----------------------------------- |
| <http://localhost>                 | Web app (via Nginx)                 |
| <http://localhost:3000>            | Web app (direct)                    |
| <http://localhost/api>             | API (via Nginx)                     |
| <http://localhost:4000/api>        | API (direct)                        |
| <http://localhost:4000/api/docs>   | Swagger UI                          |
| <http://localhost:4000/api/health> | Health check                        |

In dev mode (`NODE_ENV=development`) the API container also runs the BullMQ workers in-process, so you don't need to bring up the `worker` service unless you want the production split.

## Local Development (no Docker)

You'll need MySQL and Redis available locally.

### Backend

```bash
cd backend
cp .env.example .env
npm install
npm run dev            # API on :4000 (workers in-process)
# (optional) npm run worker:dev   # separate worker process
```

### Frontend

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev            # :3000
```

### Desktop Agent (optional — signed submission path)

```bash
cd desktop-agent
npm install
npm run dev            # http://127.0.0.1:8765
```

With the agent running, draft invoices show **Sign & submit to ETA** and exercise the full eSeal flow locally. See [`desktop-agent/README.md`](desktop-agent/README.md).

## Try the MVP flow

1. Open <http://localhost:3000/register> and create a company (e.g. `Test Co`, tax registration `123456789`).
2. You're auto-signed-in and redirected to the dashboard.
3. Go to **Customers → New customer**, then **Products → New product**.
4. Go to **Invoices → New invoice**, pick the customer, add a line, save the draft.
5. Open the draft and click **Submit to ETA** (or **Sign & submit** if the Desktop Agent is running — see below). Since no ETA credentials are set, the queue runs in **mock mode** — within a couple of seconds the invoice flips to **Accepted** with a synthetic UUID.
6. Click **PDF** to render the invoice (with the ETA QR code).
7. Click **Mark paid** to record a full payment.
8. The **Dashboard** and **Reports** pages now reflect the activity, and **ETA Reader** shows the sync log.

## Multi-tenancy

Every domain entity carries `companyId`. The auth middleware extracts it from the JWT and the service layer uses it on every query. There is no "select all" path that bypasses tenant scope.

## ETA integration

`backend/src/modules/eta`:

- **`eta-token.service.ts`** — OAuth client-credentials with Redis-cached tokens (per-tenant).
- **`eta-mapper.ts`** — Maps our domain invoice into the official ETA JSON document shape.
- **`eta.service.ts`** — Submits, persists `etaUuid`/`etaLongId`, writes to `eta_sync_logs`, handles failures.
- **Mock mode** — When ETA credentials are absent, returns a synthetic accepted document so the full flow works.

## Queues & workers

| Queue              | Producer                              | Worker                            |
| ------------------ | ------------------------------------- | --------------------------------- |
| `invoice-submit`   | When a user clicks **Submit to ETA**  | `workers/invoice.worker.ts`       |
| `invoice-sync`     | Manual / scheduled status pull        | `workers/sync.worker.ts`          |
| `whatsapp-send`    | Phase 2 reminders                     | `workers/whatsapp.worker.ts`      |

Default policy: 5 attempts with exponential backoff; failed jobs are kept for inspection.

## Security

- Bcrypt password hashing (`BCRYPT_ROUNDS=10`)
- JWT access (15 min) + refresh (7 days), rotated on refresh
- Express `helmet`, CORS allowlist, gzip compression
- Global + auth-route rate limiting
- All input validated with Zod
- Tenant scoping on every query
- `audit_logs` entity ready for actions logging

## Phase Roadmap

- **Phase 1 (MVP — included):** Auth, multi-tenant, customers, products, invoice CRUD, PDF invoices, ETA integration (mock + real), dashboard, Excel export.
- **Phase 2:** WhatsApp reminders, payment links, smart alerts, multi-branch.
- **Phase 3:** Inventory, AI forecasting, conversational assistant, autonomous workflows.
- **Phase 4 — Digital Signature (eSeal):** Backend + frontend flow, Node mock agent, .NET tray with PKCS#11 signing path, official ETA QR URLs, Inno Setup installer scaffold. Remaining: **ETA preprod certification** of CAdES-BES CMS output.

See [`backend/README.md`](backend/README.md), [`frontend/README.md`](frontend/README.md), and [`DEPLOYMENT.md`](DEPLOYMENT.md) for module-level and ops details.

## License

Proprietary — all rights reserved.
