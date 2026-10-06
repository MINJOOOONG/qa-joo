import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * HMAC request signing shared by QA JOO and its runners (local CLI, GitHub Actions).
 *
 *   x-qajoo-timestamp: unix seconds
 *   x-qajoo-signature: v1=hex(HMAC_SHA256(secret, `${timestamp}.${METHOD}.${path}.${sha256(body)}`))
 *
 * Signing method + path + body hash prevents replaying a signature against another endpoint,
 * and the timestamp window limits replay of the same request.
 */
export const TIMESTAMP_HEADER = "x-qajoo-timestamp";
export const SIGNATURE_HEADER = "x-qajoo-signature";
export const MAX_SKEW_SECONDS = 300;

export function bodyHash(body: string | Uint8Array): string {
  return createHash("sha256").update(body).digest("hex");
}

export function computeSignature(secret: string, timestamp: string, method: string, path: string, body: string | Uint8Array): string {
  return createHmac("sha256", secret)
    .update(`${timestamp}.${method.toUpperCase()}.${path}.${bodyHash(body)}`)
    .digest("hex");
}

export function signRequest(secret: string, method: string, path: string, body: string | Uint8Array = "", now = Date.now()) {
  const timestamp = String(Math.floor(now / 1000));
  return {
    [TIMESTAMP_HEADER]: timestamp,
    [SIGNATURE_HEADER]: `v1=${computeSignature(secret, timestamp, method, path, body)}`,
  };
}

export type VerifyResult = { ok: true } | { ok: false; reason: string };

export function verifySignature(params: {
  secret: string;
  method: string;
  path: string;
  body: string | Uint8Array;
  timestamp: string | null;
  signature: string | null;
  now?: number;
}): VerifyResult {
  const { secret, method, path, body, timestamp, signature } = params;
  if (!timestamp || !signature) return { ok: false, reason: "Missing runner signature headers." };
  if (!/^\d{9,11}$/.test(timestamp)) return { ok: false, reason: "Invalid timestamp." };
  const skew = Math.abs((params.now ?? Date.now()) / 1000 - Number(timestamp));
  if (skew > MAX_SKEW_SECONDS) return { ok: false, reason: "Signature timestamp is outside the allowed window." };
  const match = /^v1=([0-9a-f]{64})$/.exec(signature);
  if (!match) return { ok: false, reason: "Malformed signature." };
  const expected = Buffer.from(computeSignature(secret, timestamp, method, path, body), "hex");
  const provided = Buffer.from(match[1], "hex");
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
    return { ok: false, reason: "Invalid signature." };
  }
  return { ok: true };
}
