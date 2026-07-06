# Backend — ETA SaaS API

Express + TypeScript + TypeORM + MySQL + Redis + BullMQ.

## Layout

```
src/
├── app.ts                  # Express bootstrap (middleware, swagger, routes)
├── server.ts               # API entrypoint
├── worker.ts               # Worker entrypoint (BullMQ)
├── config/                 # env, logger, swagger
├── common/                 # base entities, middleware, errors, utils, types
├── database/               # TypeORM data-source + redis client
├── queues/                 # BullMQ queue producers
├── workers/                # BullMQ workers
├── routes/                 # composed routers
└── modules/
    ├── auth/               # register/login/refresh/me + JWT middleware
    ├── companies/          # tenant company entity + settings
    ├── branches/           # company branches
    ├── users/              # user entity (managed via auth)
    ├── customers/          # customer CRUD
    ├── products/           # product CRUD
    ├── invoices/           # invoice CRUD + status + PDF + Excel
    ├── payments/           # payments
    ├── eta/                # ETA integration: token, mapper, submit, fetch
    ├── dashboard/          # metrics + analytics
    ├── subscriptions/      # SaaS subscription entity
    ├── ai/                 # conversational layer (Phase 3 scaffold)
    └── audit/              # audit-log entity
```

## Running locally

```bash
cp .env.example .env
npm install
npm run dev          # API
# in another shell:
npm run worker:dev   # BullMQ worker (or rely on in-process worker in dev)
```

API: `http://localhost:4000/api`
Swagger: `http://localhost:4000/api/docs`

## Multi-tenant model

Every domain entity carries a `companyId`. All controllers extract it from the
authenticated user's JWT and pass it into the service layer, which uses it on
every query — there is no global "select all" path that escapes tenant scope.

## ETA integration

`modules/eta/eta.service.ts` handles:

- OAuth client-credentials with Redis token cache (`eta-token.service.ts`)
- Mapping our domain → ETA document JSON (`eta-mapper.ts`)
- Submitting, persisting `etaUuid`/`etaLongId`, logging to `eta_sync_logs`
- A **mock mode** when credentials are missing (so the queue+UI can be tested
  end-to-end without real ETA access).

### Signed-submission flow (eSeal via Desktop Agent)

For a real (non-mock) submission the document must carry a CAdES-BES
`signatures[]` element produced by the issuer's eSeal certificate. Since web
apps cannot reach a USB Token directly, the certificate lives in a small
**Desktop Agent** the user installs on Windows. The signing flow is:

1. Browser calls `GET /invoices/{id}/eta-payload`. The server returns the
   ETA document JSON, its canonical form (per
   [ETA Document Serialization Approach](https://sdk.invoicing.eta.gov.eg/document-serialization-approach/))
   and the SHA-256 hash.
2. Browser forwards that payload to the local agent over
   `http://127.0.0.1:8765/sign`. The agent re-canonicalizes the document,
   verifies the hash matches, prompts the user for the eSeal PIN, then
   produces a CAdES-BES signature using the USB Token.
3. Browser posts the result to `POST /invoices/{id}/submit-signed` with
   `{ signatures: [{ signatureType: 'I', value: '<base64>' }] }`. The server
   regenerates the document, attaches the signatures, and submits to ETA
   in a single round trip.

Relevant code: `eta-canonicalizer.ts`, `eta.service.ts` (`buildSignablePayload`,
`submitInvoice` with optional `signatures` parameter), invoice controller
routes `/:id/eta-payload` and `/:id/submit-signed`.

The legacy queued route `POST /invoices/{id}/submit` is still available and
still falls back to mock mode whenever ETA credentials are absent — useful
for local development without a token.

## Queues

Three BullMQ queues, each backed by Redis:

| Queue              | Purpose                                | Worker file              |
| ------------------ | -------------------------------------- | ------------------------ |
| `invoice-submit`   | Submit invoice → ETA, retry on failure | `workers/invoice.worker` |
| `invoice-sync`     | Poll ETA for status                    | `workers/sync.worker`    |
| `whatsapp-send`    | Send WhatsApp messages (Phase 2)       | `workers/whatsapp.worker`|

Producers live under `queues/`. Workers all start when `worker.ts` runs, and
also start in-process during `NODE_ENV=development` for convenience.

## Migrations

```bash
npm run build
npm run migration:generate -- src/database/migrations/InitSchema
npm run migration:run
```

In development, `synchronize: true` is enabled, so the schema is auto-created
on first boot — flip to migrations for production.
