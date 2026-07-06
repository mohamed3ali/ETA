import cors from 'cors';
import express, { Request, Response } from 'express';
import { canonicalizeEtaDocument, sha256Hex } from './canonicalizer.js';

const PORT = Number(process.env.AGENT_PORT ?? 8765);
const HOST = process.env.AGENT_HOST ?? '127.0.0.1';
const AGENT_VERSION = '0.1.0-dev';
const MOCK_MODE = process.env.AGENT_MOCK !== 'false';

/** Simulated certificate RIN when running in dev mock mode. */
const MOCK_RIN = process.env.AGENT_MOCK_RIN ?? '123456789';

const app = express();
app.use(express.json({ limit: '2mb' }));

const allowedOrigins = new Set(
  (process.env.AGENT_CORS_ORIGINS ??
    'http://localhost:3000,http://127.0.0.1:3000,http://localhost,http://127.0.0.1')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`CORS blocked for origin: ${origin}`));
    },
  }),
);

interface SignBody {
  document?: Record<string, unknown>;
  canonical?: string;
  hashHex?: string;
  issuerRin?: string;
  pin?: string;
}

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    tokenConnected: MOCK_MODE,
    certificateRin: MOCK_MODE ? MOCK_RIN : undefined,
    certificateExpiry: MOCK_MODE ? '2099-12-31' : undefined,
    agentVersion: AGENT_VERSION,
    mode: MOCK_MODE ? 'mock' : 'production',
  });
});

app.post('/sign', (req: Request, res: Response) => {
  const body = req.body as SignBody;

  if (!body.document || typeof body.document !== 'object') {
    res.status(400).json({ error: { message: 'Missing document' } });
    return;
  }
  if (!body.hashHex || !body.canonical) {
    res.status(400).json({ error: { message: 'Missing canonical or hashHex' } });
    return;
  }

  const localCanonical = canonicalizeEtaDocument(body.document, ['signatures']);
  const localHash = sha256Hex(localCanonical);

  if (localCanonical !== body.canonical || localHash !== body.hashHex.toLowerCase()) {
    res.status(409).json({
      error: {
        message: 'Canonical/hash mismatch — document was modified after the server built the payload',
        expectedHash: localHash,
        receivedHash: body.hashHex,
      },
    });
    return;
  }

  if (body.issuerRin && MOCK_MODE && body.issuerRin !== MOCK_RIN) {
    console.warn(
      `[agent] issuer RIN ${body.issuerRin} differs from mock certificate ${MOCK_RIN} — signing anyway in mock mode`,
    );
  }

  /**
   * Production: replace with CAdES-BES via PKCS#11 (ePass2003 / WatchData).
   * Mock: deterministic pseudo-signature tied to the document hash.
   */
  const mockCades = Buffer.from(`MOCK-CADES-BES:${localHash}`, 'utf8').toString('base64');

  res.json({
    signatures: [{ signatureType: 'I', value: mockCades }],
    signedAt: new Date().toISOString(),
    mode: MOCK_MODE ? 'mock' : 'production',
  });
});

app.listen(PORT, HOST, () => {
  console.log(`ETA Desktop Agent listening on http://${HOST}:${PORT}`);
  console.log(`  mode=${MOCK_MODE ? 'mock (no USB token)' : 'production'}`);
  console.log(`  CORS origins: ${[...allowedOrigins].join(', ')}`);
});
