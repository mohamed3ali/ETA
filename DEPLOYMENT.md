# VPS Deployment Guide

This guide walks through deploying the ETA SaaS to a fresh Linux VPS (Ubuntu 22.04 LTS) using Docker Compose behind Nginx.

## 1. Prerequisites

```bash
# install Docker & Compose
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```

Log out / log in to refresh group membership.

## 2. Clone & configure

```bash
git clone <your-repo-url> eta-saas && cd eta-saas
cp .env.example .env
nano .env   # set strong JWT_SECRET, ETA creds, DB passwords, domain
```

Recommended production values:

- `NODE_ENV=production`
- `JWT_SECRET` / `JWT_REFRESH_SECRET` → 64+ random chars (`openssl rand -hex 64`)
- `MYSQL_PASSWORD` / `MYSQL_ROOT_PASSWORD` → strong unique values
- `CORS_ORIGIN=https://app.yourdomain.com`
- `NEXT_PUBLIC_API_URL=https://app.yourdomain.com/api`

## 3. Boot the stack

```bash
docker compose pull
docker compose up -d --build
docker compose ps
docker compose logs -f api worker
```

## 4. TLS with Let's Encrypt (strongly recommended in production)

The base `docker-compose.yml` only listens on port 80. The repository ships a
ready-to-use overlay at [`docker-compose.tls.yml`](docker-compose.tls.yml).

```bash
# 1. Issue a certificate (stop the stack briefly so port 80 is free).
sudo apt install -y certbot
docker compose down nginx
sudo certbot certonly --standalone -d app.yourdomain.com

# 2. Edit nginx/nginx.conf:
#    - Uncomment the `return 301 https://...` line in the port 80 server block.
#    - Uncomment the entire HTTPS server block at the bottom.
#    - Replace `app.example.com` with your domain in BOTH paths.

# 3. Boot with the TLS overlay merged in.
docker compose -f docker-compose.yml -f docker-compose.tls.yml up -d
```

Renewal (run from cron, e.g. weekly):

```bash
sudo certbot renew --webroot -w ./nginx/certbot-webroot \
  --deploy-hook "docker compose exec nginx nginx -s reload"
```

## 4b. Paymob production setup

Paymob is the gateway used both for **payment links to your customers** and for
**SaaS subscription checkout**. Without keys the system falls back to a mock
mode that is fine for demos but never charges anyone.

```bash
# In .env (or your secret store):
PAYMOB_BASE_URL=https://accept.paymob.com/api
PAYMOB_CHECKOUT_URL=https://accept.paymob.com/unifiedcheckout/
PAYMOB_API_KEY=...        # from Paymob dashboard → Settings → Account info
PAYMOB_PUBLIC_KEY=...
PAYMOB_INTEGRATION_ID=... # one integration per payment method (card, wallet)
PAYMOB_HMAC_SECRET=...    # used to verify webhook signatures
PUBLIC_APP_URL=https://app.yourdomain.com
PUBLIC_API_URL=https://app.yourdomain.com/api
```

In the Paymob dashboard, set the **transaction processed callback** and
**transaction response callback** to:

```
https://app.yourdomain.com/api/public/pay/{token}/webhook
https://app.yourdomain.com/api/public/subscription/{token}/webhook
```

The `{token}` is filled in per session by the platform — Paymob will substitute
it from the `extras.merchant_extra` payload we send when creating intentions.

## 4c. WhatsApp Cloud API setup

Used for invoice reminders, ETA-accepted notifications, and payment receipts.
Without keys the worker logs the message body and returns success (mock mode).

1. Create a Meta Business app and add the **WhatsApp** product.
2. Add a phone number, verify it, generate a permanent access token.
3. Submit the message templates listed in
   `backend/src/modules/notifications/notification.templates.ts` for review.
4. Configure `.env`:

   ```bash
   WHATSAPP_PROVIDER=meta
   WHATSAPP_TOKEN=...               # permanent access token
   WHATSAPP_PHONE_NUMBER_ID=...     # from the WhatsApp → API setup screen
   ```

5. Restart the worker container:

   ```bash
   docker compose restart worker
   ```

Templates are sent in Arabic (`ar`). Approval can take a few business days.

## 5. Database migrations

The production database uses `DB_SYNCHRONIZE=false`. See
[`backend/src/database/migrations/README.md`](backend/src/database/migrations/README.md)
for the full migration workflow.

```bash
# inside the api container
docker compose exec api npm run migration:run     # apply pending migrations
docker compose exec api npm run migration:show    # status
docker compose exec api npm run migration:revert  # undo the last one
```

First-time setup on a fresh database:

```bash
# Option A — let TypeORM create the schema once, then turn synchronize off.
DB_SYNCHRONIZE=true docker compose up -d api
# Then edit .env back to DB_SYNCHRONIZE=false and restart.

# Option B — generate a baseline migration against an empty database
# and run it like any other migration.
docker compose exec api npm run migration:generate -- \
  src/database/migrations/InitialSchema
docker compose exec api npm run migration:run
```

## 6. Backups

A simple nightly dump:

```bash
0 3 * * * docker compose exec -T mysql mysqldump -u root -p$MYSQL_ROOT_PASSWORD $MYSQL_DATABASE | gzip > /var/backups/eta-$(date +\%F).sql.gz
```

## 7. Upgrades

```bash
git pull
docker compose build
docker compose up -d
docker compose exec api npm run migration:run
```

## 8. Health checks

- API: `GET /api/health`
- Web: `GET /` returns Next.js page
- MySQL/Redis: built-in healthchecks in `docker-compose.yml`
