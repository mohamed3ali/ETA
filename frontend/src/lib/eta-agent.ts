'use client';

import { useEffect, useState } from 'react';

import {
  ETA_AGENT_DOWNLOAD_FILENAME,
  ETA_AGENT_DOWNLOAD_URL,
  ETA_AGENT_URL,
} from '@/lib/eta-agent-config';

export {
  ETA_AGENT_DOWNLOAD_FILENAME,
  ETA_AGENT_DOWNLOAD_URL,
  ETA_AGENT_URL,
} from '@/lib/eta-agent-config';
export interface EtaAgentHealth {
  status: 'ok';
  tokenConnected: boolean;
  certificateRin?: string;
  certificateExpiry?: string;
  agentVersion: string;
}

export interface EtaAgentSignature {
  signatureType: 'I' | 'S';
  value: string;
}

export interface EtaAgentSignRequest {
  /** The raw ETA document JSON returned by GET /invoices/:id/eta-payload */
  document: Record<string, unknown>;
  /** Pre-computed canonical form (sanity check on the agent side). */
  canonical: string;
  /** Lowercase hex SHA-256 of the canonical form. */
  hashHex: string;
  /** Issuer RIN — the agent verifies the certificate is bound to this RIN. */
  issuerRin: string;
}

export interface EtaAgentSignResponse {
  signatures: EtaAgentSignature[];
  signedAt: string;
}

/**
 * Probes the agent for a `/health` response. Resolves to `null` when the
 * agent is unreachable or returns an error — callers fall back to the
 * unsigned/queued submission path in that case.
 */
export const fetchAgentHealth = async (
  timeoutMs = 1500,
): Promise<EtaAgentHealth | null> => {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${ETA_AGENT_URL}/health`, {
      method: 'GET',
      signal: ctrl.signal,
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as EtaAgentHealth;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
};

/**
 * Asks the agent to sign an ETA document. The agent re-canonicalizes the
 * payload locally to ensure the bytes it signs really match what the server
 * provided, prompts the user for their eSeal PIN, then returns the CAdES-BES
 * signature(s).
 */
export const requestAgentSignature = async (
  payload: EtaAgentSignRequest,
  timeoutMs = 90_000,
): Promise<EtaAgentSignResponse> => {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${ETA_AGENT_URL}/sign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      let detail = `${res.status}`;
      try {
        detail = (await res.json()).error?.message ?? detail;
      } catch {
        /* ignore */
      }
      throw new Error(`Agent rejected sign request: ${detail}`);
    }
    return (await res.json()) as EtaAgentSignResponse;
  } finally {
    clearTimeout(timer);
  }
};

/**
 * React hook that polls the local agent for a health response on mount and
 * exposes the live status to the calling component. The polling is light
 * (every 30 s) so we notice when a user plugs in or unplugs the token while
 * staying on the page.
 */
export const useEtaAgent = (pollIntervalMs = 30_000) => {
  const [health, setHealth] = useState<EtaAgentHealth | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      const h = await fetchAgentHealth();
      if (!cancelled) {
        setHealth(h);
        setChecked(true);
      }
    };
    void tick();
    const id = window.setInterval(tick, pollIntervalMs);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [pollIntervalMs]);

  return {
    health,
    available: !!health,
    tokenConnected: !!health?.tokenConnected,
    checked,
  };
};
