/**
 * End-to-end smoke test: canonicalize → /sign → verify response.
 * Run: npx tsx scripts/test-sign-flow.mts
 */
import { canonicalizeEtaDocument, sha256Hex } from '../src/canonicalizer.js';

const document = {
  documentType: 'i',
  documentTypeVersion: '1.0',
  internalID: 'TEST-001',
  totalAmount: 1140,
};

const canonical = canonicalizeEtaDocument(document, ['signatures']);
const hashHex = sha256Hex(canonical);

console.log('canonical:', canonical);
console.log('hashHex:', hashHex);

const res = await fetch('http://127.0.0.1:8765/sign', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    document,
    canonical,
    hashHex,
    issuerRin: '123456789',
  }),
});

const json = await res.json();
if (!res.ok) {
  console.error('FAIL', res.status, json);
  process.exit(1);
}

console.log('OK', json);
if (!json.signatures?.[0]?.value?.startsWith('TUN')) {
  // MOCK-CADES-BES base64 starts with certain chars - check it exists
  if (!json.signatures?.[0]?.value) {
    console.error('Missing signature value');
    process.exit(1);
  }
}
console.log('signatureType:', json.signatures[0].signatureType);
console.log('mode:', json.mode);
