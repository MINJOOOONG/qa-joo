import "server-only";
import { getConfig } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { SIGNATURE_HEADER, TIMESTAMP_HEADER, verifySignature } from "./runner-auth";

/** Reads the raw body and verifies the runner's HMAC signature over method, path and body. */
export async function readVerifiedRunnerBody(request: Request, maxBytes: number): Promise<Uint8Array> {
  const secret = getConfig().runner.callbackSecret;
  if (!secret) throw new AppError("not_configured", "RUNNER_CALLBACK_SECRET is not configured on this server.");
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > maxBytes) throw new AppError("bad_request", "Request body is too large.");
  const body = new Uint8Array(await request.arrayBuffer());
  if (body.byteLength > maxBytes) throw new AppError("bad_request", "Request body is too large.");
  const url = new URL(request.url);
  const verdict = verifySignature({
    secret,
    method: request.method,
    path: `${url.pathname}${url.search}`,
    body,
    timestamp: request.headers.get(TIMESTAMP_HEADER),
    signature: request.headers.get(SIGNATURE_HEADER),
  });
  if (!verdict.ok) throw new AppError("unauthorized", verdict.reason);
  return body;
}

export function parseJson(body: Uint8Array): unknown {
  try {
    return JSON.parse(new TextDecoder().decode(body));
  } catch {
    throw new AppError("bad_request", "Request body must be JSON.");
  }
}
