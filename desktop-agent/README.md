# ETA Desktop Agent

Small **localhost helper** that signs ETA invoice documents with the issuer's **eSeal certificate** (USB Token). Web browsers cannot speak PKCS#11, so this agent runs on the user's Windows machine and exposes a loopback HTTP API the SaaS frontend calls during submission.

> **Production target:** a .NET tray app using the official ETA Toolkit + ePass2003 / WatchData drivers.  
> **This package:** a **dev mock** that implements the same HTTP contract so you can test the full sign → submit flow without a physical token.

---

## Why it exists

| Step | Who |
|------|-----|
| Build unsigned ETA JSON | Backend (`GET /invoices/:id/eta-payload`) |
| Canonicalize + SHA-256 | Backend + Agent (cross-check) |
| CAdES-BES sign with USB Token | **Desktop Agent** |
| Attach `signatures[]` + submit | Backend (`POST /invoices/:id/submit-signed`) |

See also [`backend/README.md`](../backend/README.md) — *Signed-submission flow*.

---

## HTTP API

Default base URL: `http://127.0.0.1:8765`

### `GET /health`

```json
{
  "status": "ok",
  "tokenConnected": true,
  "certificateRin": "123456789",
  "certificateExpiry": "2099-12-31",
  "agentVersion": "0.1.0-dev",
  "mode": "mock"
}
```

### `POST /sign`

**Request**

```json
{
  "document": { "...": "unsigned ETA document JSON" },
  "canonical": "\"DOCUMENTTYPE\"\"i\"...",
  "hashHex": "abc123...",
  "issuerRin": "123456789",
  "pin": "optional — used by production agent only"
}
```

**Response**

```json
{
  "signatures": [
    { "signatureType": "I", "value": "<base64 CAdES-BES>" }
  ],
  "signedAt": "2026-06-08T09:00:00.000Z",
  "mode": "mock"
}
```

The agent **re-canonicalizes** the document locally and returns `409` if `hashHex` does not match — this prevents signing a tampered payload.

---

## Run (dev mock)

```bash
cd desktop-agent
npm install
npm run dev
```

Environment variables:

| Variable | Default | Purpose |
|----------|---------|---------|
| `AGENT_PORT` | `8765` | Listen port |
| `AGENT_HOST` | `127.0.0.1` | Bind address (keep on loopback) |
| `AGENT_MOCK` | `true` | Set to `false` when wiring real PKCS#11 |
| `AGENT_MOCK_RIN` | `123456789` | Simulated certificate RIN |
| `AGENT_CORS_ORIGINS` | localhost:3000, … | Allowed browser origins |

Then in the SaaS app, open a **draft invoice** and click **Sign & submit to ETA**. The UI probes `/health` and uses the signed path when the token appears connected.

---

## End-to-end test flow

1. Start backend + frontend (+ Redis/MySQL as usual).
2. Start the agent: `cd desktop-agent && npm run dev`.
3. Create a draft invoice in the UI.
4. Confirm the green **eSeal token connected** badge on the invoice page.
5. Click **Sign & submit to ETA** — the browser calls `/sign` locally, then posts signatures to the API.
6. Without ETA credentials the backend still runs in **mock mode** and accepts the invoice.

---

## Production roadmap

Full guide: [`dotnet/PRODUCTION.md`](dotnet/PRODUCTION.md)

| Item | Status |
|------|--------|
| Backend + Frontend signed flow | ✅ |
| Node mock agent | ✅ |
| .NET tray app (mock + production code path) | ✅ |
| Official ETA QR URL (`uuid` + `longId`) | ✅ |
| PKCS#11 token probe + RSA sign | ✅ (needs hardware test) |
| CAdES-BES CMS (production-certified) | ⏳ validate with ETA preprod |
| MSI installer (Inno Setup script) | ✅ scaffold |

```powershell
# .NET tray app (requires .NET 8 SDK on Windows)
cd desktop-agent/dotnet
dotnet run --project src/EtaSigner.Tray
```

The production checklist above replaces the earlier bullet list — see `PRODUCTION.md` for driver install, PKCS#11 env vars, and MSI packaging steps.

---

## Security notes

- Listen on **127.0.0.1 only** — never expose the agent to the public internet.
- Restrict CORS to your SaaS domain(s).
- PIN and private keys never leave the local machine.
- Verify `issuerRin` matches the certificate before signing in production.
