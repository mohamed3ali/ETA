import { createHmac, timingSafeEqual } from 'crypto';
import { env } from '../../config/env';
import { logger } from '../../config/logger';

/**
 * Paymob's published HMAC concatenation order for the
 * "Transaction processed" callback (both classic + Intention API):
 *   https://developers.paymob.com/egypt/api-reference-guide/accept-callback/hmac-calculation
 * Values are stringified (booleans become "true"/"false", null becomes ""),
 * concatenated in order with no separator, then HMAC-SHA512(secret) hex.
 */
const TRANSACTION_HMAC_FIELDS: string[] = [
  'amount_cents',
  'created_at',
  'currency',
  'error_occured',
  'has_parent_transaction',
  'id',
  'integration_id',
  'is_3d_secure',
  'is_auth',
  'is_capture',
  'is_refunded',
  'is_standalone_payment',
  'is_voided',
  'order.id',
  'owner',
  'pending',
  'source_data.pan',
  'source_data.sub_type',
  'source_data.type',
  'success',
];

function readPath(obj: Record<string, unknown>, dotted: string): unknown {
  return dotted.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

function stringifyValue(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return String(v);
}

/**
 * Thin adapter for Paymob's "Intention" API (the modern hosted-checkout flow).
 * Falls back to a mock URL if credentials are missing — this preserves the
 * mock-by-default ergonomic of the rest of the platform.
 *
 * Real flow (when both PAYMOB_API_KEY and PAYMOB_INTEGRATION_ID are set):
 *   1. POST {PAYMOB_BASE}/v1/intention with amount + billing data.
 *   2. Use the returned `client_secret` to build the hosted-checkout URL.
 *   3. Customer pays → Paymob calls our webhook → we mark the link paid.
 */
export interface PaymobIntentionInput {
  amountMinor: number; // EGP cents — Paymob expects integer minor units
  currency: string;
  redirectionUrl: string;
  webhookUrl: string;
  reference: string;
  billing: {
    name: string;
    email?: string;
    phone?: string;
  };
}

export interface PaymobIntentionResult {
  mock: boolean;
  checkoutUrl: string;
  providerRef: string;
}

export const paymobAdapter = {
  isConfigured(): boolean {
    return !!(env.PAYMOB_API_KEY && env.PAYMOB_INTEGRATION_ID);
  },

  async createIntention(input: PaymobIntentionInput): Promise<PaymobIntentionResult> {
    if (!this.isConfigured()) {
      logger.warn(
        { reference: input.reference },
        'Paymob not configured — generating mock checkout URL',
      );
      return {
        mock: true,
        // Mock URLs point at our own self-hosted public payment page.
        checkoutUrl: input.redirectionUrl,
        providerRef: `MOCK-${input.reference}`,
      };
    }

    const integrationId = Number(env.PAYMOB_INTEGRATION_ID);
    const res = await fetch(`${env.PAYMOB_BASE_URL}/v1/intention/`, {
      method: 'POST',
      headers: {
        Authorization: `Token ${env.PAYMOB_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: input.amountMinor,
        currency: input.currency,
        payment_methods: [integrationId],
        billing_data: {
          first_name: input.billing.name.split(' ')[0] ?? input.billing.name,
          last_name: input.billing.name.split(' ').slice(1).join(' ') || '.',
          email: input.billing.email ?? 'noreply@example.com',
          phone_number: input.billing.phone ?? '+200000000000',
        },
        extras: { reference: input.reference },
        notification_url: input.webhookUrl,
        redirection_url: input.redirectionUrl,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Paymob intention failed: ${res.status} ${text}`);
    }
    const body = (await res.json()) as {
      id: string;
      client_secret: string;
      payment_keys?: Array<{ iframe_id?: number }>;
    };

    // Paymob's hosted checkout URL format:
    //   https://accept.paymob.com/unifiedcheckout/?publicKey=PK&clientSecret=CS
    const publicKey = env.PAYMOB_PUBLIC_KEY || '';
    const checkoutUrl = `${env.PAYMOB_CHECKOUT_URL}?publicKey=${encodeURIComponent(
      publicKey,
    )}&clientSecret=${encodeURIComponent(body.client_secret)}`;

    return { mock: false, checkoutUrl, providerRef: body.id };
  },

  /**
   * Verifies a Paymob HMAC-signed webhook callback.
   *
   * Paymob can deliver the HMAC in three places (we accept all):
   *   1. `hmac` query string param (their default for redirection callbacks)
   *   2. `x-paymob-signature` header (some setups)
   *   3. Embedded inside the JSON payload as `hmac`
   *
   * The signing algorithm is HMAC-SHA512 over the concatenated values of
   * `TRANSACTION_HMAC_FIELDS` (in order, no separator), keyed with the
   * integration's HMAC secret. Result is lowercase hex.
   *
   * For mock mode (no credentials configured) we accept everything to keep
   * local dev frictionless.
   */
  verifyWebhook(
    payload: Record<string, unknown>,
    hmacHeader: string | undefined,
  ): boolean {
    if (!this.isConfigured()) return true;
    if (!env.PAYMOB_HMAC_SECRET) return false;

    const provided = (hmacHeader || (payload.hmac as string | undefined) || '').trim();
    if (!provided) return false;

    // Paymob nests the transaction inside `obj` for the modern Intention API
    // but sends it flat for some legacy callbacks. Probe both.
    const root = (payload.obj && typeof payload.obj === 'object'
      ? (payload.obj as Record<string, unknown>)
      : payload) as Record<string, unknown>;

    const concatenated = TRANSACTION_HMAC_FIELDS.map((f) =>
      stringifyValue(readPath(root, f)),
    ).join('');

    const expected = createHmac('sha512', env.PAYMOB_HMAC_SECRET)
      .update(concatenated, 'utf8')
      .digest('hex');

    try {
      const a = Buffer.from(expected, 'utf8');
      const b = Buffer.from(provided.toLowerCase(), 'utf8');
      if (a.length !== b.length) {
        logger.warn(
          { expectedLen: a.length, providedLen: b.length },
          'Paymob HMAC length mismatch',
        );
        return false;
      }
      return timingSafeEqual(a, b);
    } catch (err) {
      logger.warn({ err }, 'Paymob HMAC compare failed');
      return false;
    }
  },
};
