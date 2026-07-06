# Frontend — ETA SaaS Web

Next.js (App Router) + TypeScript + TailwindCSS + shadcn/ui + React Query + Zustand.

## Routes

| Path                  | Purpose                                                         |
| --------------------- | --------------------------------------------------------------- |
| `/`                   | Marketing landing page                                          |
| `/login`              | Sign in                                                         |
| `/register`           | Sign up (creates company + owner)                               |
| `/dashboard`          | KPIs, revenue chart, recent invoices                            |
| `/invoices`           | List + filter + export                                          |
| `/invoices/new`       | Create invoice wizard (line items, customer, totals)            |
| `/invoices/[id]`      | Detail + submit to ETA (signed via Desktop Agent when available) / record payment / PDF |
| `/customers`          | Customer CRUD                                                   |
| `/products`           | Product CRUD                                                    |
| `/eta-reader`         | ETA sync activity log                                           |
| `/reports`            | Charts + Excel export                                           |
| `/assistant`          | AI conversational layer (Phase 3 preview)                       |
| `/settings`           | Company profile + ETA credentials                               |

## Architecture

- `src/app` — App Router pages; the `(auth)` and `(dashboard)` route groups each have their own layout.
- `src/components/ui` — shadcn/ui primitives (button, card, table, dialog, …).
- `src/components/dashboard` — `Sidebar`, `Topbar`, `AuthGate`.
- `src/lib/api.ts` — Axios instance with JWT injection + auto refresh.
- `src/lib/eta-agent.ts` — probes the local Desktop Agent (`127.0.0.1:8765`) and requests CAdES-BES signatures before ETA submission.
- `src/store/auth-store.ts` — Zustand session store (persisted to localStorage).
- `src/lib/utils.ts` — `cn`, `formatCurrency`, `formatDate` helpers.

## Theming & i18n

- Dark mode via `next-themes` (toggle in the topbar).
- Localization-ready: `body[dir="rtl"]` rules in `globals.css`; user `locale` is part of the
  auth payload and ready to be wired to `next-intl` in Phase 2.

## Running

```bash
cp .env.example .env.local
npm install
npm run dev
```

Then point your browser at <http://localhost:3000>.

### Signed submission (eSeal)

For the full sign → submit flow in development, also start the mock Desktop Agent:

```bash
cd ../desktop-agent && npm install && npm run dev
```

When the agent is reachable and reports `tokenConnected: true`, the invoice detail page switches the primary action to **Sign & submit to ETA**. See [`../desktop-agent/README.md`](../desktop-agent/README.md).
