/**
 * ETA document canonicalization — must stay in sync with
 * backend/src/modules/eta/eta-canonicalizer.ts
 *
 * @see https://sdk.invoicing.eta.gov.eg/document-serialization-approach/
 */

import { createHash } from 'node:crypto';

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
interface JsonObject {
  [key: string]: JsonValue | undefined;
}

const encodePrimitive = (value: JsonPrimitive): string => {
  if (value === null) return '""';
  return `"${String(value)}"`;
};

const serializeValue = (value: JsonValue | undefined): string => {
  if (value === undefined || value === null) return '""';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return encodePrimitive(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => serializeValue(item)).join('');
  }
  return serializeObject(value);
};

const serializeObject = (obj: JsonObject): string => {
  let out = '';
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    if (value === undefined || value === null) continue;

    const upperKey = `"${key.toUpperCase()}"`;

    if (Array.isArray(value)) {
      out += upperKey;
      for (const item of value) {
        out += upperKey;
        out += serializeValue(item);
      }
      continue;
    }

    out += upperKey;
    out += serializeValue(value as JsonValue);
  }
  return out;
};

export const canonicalizeEtaDocument = (
  document: Record<string, unknown>,
  excludeKeys: string[] = ['signatures'],
): string => {
  const exclude = new Set(excludeKeys);
  const filtered: JsonObject = {};
  for (const key of Object.keys(document)) {
    if (exclude.has(key)) continue;
    filtered[key] = document[key] as JsonValue;
  }
  return serializeObject(filtered);
};

export const sha256Hex = (input: string): string =>
  createHash('sha256').update(input, 'utf8').digest('hex');
