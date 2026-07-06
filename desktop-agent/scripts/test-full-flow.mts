/**
 * Full stack smoke test: register/login → draft invoice → eta-payload → agent sign → submit-signed.
 * Run: npx tsx scripts/test-full-flow.mts
 */
const API = process.env.API_URL ?? 'http://127.0.0.1:4000/api';
const AGENT = process.env.AGENT_URL ?? 'http://127.0.0.1:8765';

const uniq = Date.now();
const email = `agent-test-${uniq}@example.com`;
const password = 'TestPass123!';

async function api(path: string, opts: RequestInit & { token?: string } = {}) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
  };
  const res = await fetch(`${API}${path}`, { ...opts, headers: { ...headers, ...opts.headers } });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${opts.method ?? 'GET'} ${path} → ${res.status}: ${JSON.stringify(json)}`);
  return json;
}

// 1. Health checks
const agentHealth = await fetch(`${AGENT}/health`).then((r) => r.json());
console.log('agent health:', agentHealth.status, agentHealth.mode);

// 2. Register
const reg = await api('/auth/register', {
  method: 'POST',
  body: JSON.stringify({
    email,
    password,
    firstName: 'Agent',
    lastName: 'Test',
    companyName: `Agent Test Co ${uniq}`,
    taxRegistrationNumber: String(100000000 + (uniq % 899999999)),
  }),
});
const token = reg.data.tokens.accessToken as string;
console.log('registered:', reg.data.company.name);

// 3. Customer + product
const customer = await api('/customers', {
  method: 'POST',
  token,
  body: JSON.stringify({
    name: 'Test Customer',
    type: 'B',
    taxRegistrationNumber: '987654321',
  }),
});
const product = await api('/products', {
  method: 'POST',
  token,
  body: JSON.stringify({
    name: 'Test Item',
    sku: `SKU-${uniq}`,
    unitPrice: 100,
    taxRate: 14,
    etaItemCode: 'EG-000000',
    etaCodeType: 'EGS',
  }),
});

// 4. Invoice draft
const today = new Date().toISOString().slice(0, 10);
const inv = await api('/invoices', {
  method: 'POST',
  token,
  body: JSON.stringify({
    customerId: customer.data.id,
    issueDate: today,
    currency: 'EGP',
    items: [{ productId: product.data.id, description: 'Test Item', quantity: 1, unitPrice: 100, taxRate: 14 }],
  }),
});
const invoiceId = inv.data.id as string;
console.log('invoice:', inv.data.invoiceNumber, invoiceId);

// 5. ETA payload
const payload = (await api(`/invoices/${invoiceId}/eta-payload`, { token })).data;
console.log('payload hash:', payload.hashHex.slice(0, 16) + '…');

// 6. Agent sign
const signed = await fetch(`${AGENT}/sign`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    document: payload.document,
    canonical: payload.canonical,
    hashHex: payload.hashHex,
    issuerRin: payload.issuer.rin,
  }),
}).then(async (r) => {
  const j = await r.json();
  if (!r.ok) throw new Error(`agent sign failed: ${JSON.stringify(j)}`);
  return j;
});
console.log('signed:', signed.signatures[0].signatureType, signed.mode);

// 7. Submit signed
const outcome = await api(`/invoices/${invoiceId}/submit-signed`, {
  method: 'POST',
  token,
  body: JSON.stringify({ signatures: signed.signatures }),
});
console.log('submit outcome:', outcome.data);
console.log('invoice status should be accepted:', outcome.data.success ? '✅ PASS' : '❌ FAIL');

if (!outcome.data.success) process.exit(1);

// 8. Verify invoice
const detail = await api(`/invoices/${invoiceId}`, { token });
console.log('final status:', detail.data.status, 'uuid:', detail.data.etaUuid ?? '—');
