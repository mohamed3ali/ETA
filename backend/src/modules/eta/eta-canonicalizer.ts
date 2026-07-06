import { createHash } from 'node:crypto';

/**
 * Implementation of the ETA document canonicalization algorithm.
 *
 * Reference:
 *   https://sdk.invoicing.eta.gov.eg/document-serialization-approach/
 *   https://sdk.invoicing.eta.gov.eg/signature-creation/
 *
 * The algorithm produces a deterministic, whitespace-free string used as
 * input to the SHA-256 hash that the issuer's eSeal certificate signs.
 * It is intentionally NOT plain `JSON.stringify` — every field name is
 * uppercased and re-emitted for array items because JSON array elements
 * do not carry their own name.
 *
 * Pseudo-code from the SDK:
 *
 *   function string Serialize(documentStructure)
 *     if documentStructure is simple value type
 *       return """ + documentStructure.value + """
 *     foreach element in the structure:
 *       if element is not array type
 *         out += "\"" + element.name.uppercase + "\""
 *         out += Serialize(element.value)
 *       if element is of array type
 *         out += "\"" + element.name.uppercase + "\""
 *         foreach array element in element:
 *           out += "\"" + element.name.uppercase + "\""
 *           out += Serialize(arrayElement.value)
 *     return out
 */

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
interface JsonObject {
  [key: string]: JsonValue | undefined;
}

const isPlainObject = (v: unknown): v is JsonObject =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Encodes a primitive value the way the ETA SDK expects: wrapped in double
 * quotes with no escaping (the SDK assumes domain values do not contain `"`).
 */
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
    // Arrays are emitted by their parent's serializer (which has the field
    // name) — reaching here directly means the array is the document root,
    // which the spec does not define. We stringify items individually as a
    // best-effort fallback.
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

export interface CanonicalizeOptions {
  /**
   * Top-level keys to drop before canonicalization.
   *
   * For an Issuer (`I`) signature this MUST be `['signatures']` — the issuer
   * signs the document as it was BEFORE any signature element was added.
   */
  excludeKeys?: string[];
}

/**
 * Returns the canonical string representation of an ETA document. Pass the
 * resulting string to `sha256Bytes()` to obtain the hash that the Desktop
 * Agent / HSM signs with the eSeal certificate.
 */
export const canonicalizeEtaDocument = (
  document: Record<string, unknown>,
  options: CanonicalizeOptions = {},
): string => {
  const exclude = new Set(options.excludeKeys ?? []);
  const filtered: JsonObject = {};
  for (const key of Object.keys(document)) {
    if (exclude.has(key)) continue;
    filtered[key] = document[key] as JsonValue;
  }
  return serializeObject(filtered);
};

/**
 * SHA-256 hash of an arbitrary string, returned as a lowercase hex digest.
 * The Desktop Agent receives this value alongside the canonical string so it
 * can verify both ends produced identical bytes before signing.
 */
export const sha256Hex = (input: string): string =>
  createHash('sha256').update(input, 'utf8').digest('hex');

/**
 * SHA-256 hash of an arbitrary string, returned as a raw Buffer. This is the
 * payload the CAdES-BES signer actually signs.
 */
export const sha256Bytes = (input: string): Buffer =>
  createHash('sha256').update(input, 'utf8').digest();
