import { env } from '../../config/env';
import { getRedis } from '../../database/redis';
import { logger } from '../../config/logger';

/**
 * ETA OAuth client-credentials token cache (per company).
 * Tokens are cached in Redis and refreshed when expired.
 *
 * In tests / when credentials are missing, this returns a sentinel "mock-token".
 */
const TOKEN_PREFIX = 'eta:token:';

interface EtaCredentials {
  clientId: string;
  clientSecret: string;
  environment: 'preprod' | 'production';
}

const idBaseUrl = (envName: 'preprod' | 'production') =>
  envName === 'production'
    ? 'https://id.eta.gov.eg'
    : env.ETA_ID_BASE_URL;

export const etaTokenService = {
  async getToken(companyId: string, creds: EtaCredentials): Promise<string> {
    if (!creds.clientId || !creds.clientSecret) {
      logger.warn({ companyId }, 'ETA credentials missing; returning mock token');
      return 'mock-token';
    }

    const redis = getRedis();
    const cacheKey = `${TOKEN_PREFIX}${companyId}:${creds.environment}`;
    const cached = await redis.get(cacheKey);
    if (cached) return cached;

    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      scope: 'InvoicingAPI',
    });

    const res = await fetch(`${idBaseUrl(creds.environment)}/connect/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`ETA token request failed: ${res.status} ${text}`);
    }

    const json = (await res.json()) as { access_token: string; expires_in: number };
    // expire 60s before actual expiry as a safety margin
    const ttl = Math.max(60, (json.expires_in ?? 3600) - 60);
    await redis.set(cacheKey, json.access_token, 'EX', ttl);
    return json.access_token;
  },
};
