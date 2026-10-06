import "server-only";
import { Agent, EnvHttpProxyAgent, fetch as undiciFetch, type Dispatcher } from "undici";
import { AppError } from "@/lib/errors";
import { assertSafeTarget, guardedLookup } from "./url-guard";

export interface SafeFetchOptions {
  allowPrivate: boolean;
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  headers?: Record<string, string>;
  /** Accepted content-type prefixes, e.g. ["text/html"]. Empty = any. */
  accept?: string[];
}

export interface SafeFetchResult {
  url: string;
  status: number;
  contentType: string;
  body: string;
  truncated: boolean;
  redirects: string[];
}

let directAgent: Agent | null = null;
let permissiveAgent: Agent | null = null;
let proxyAgent: EnvHttpProxyAgent | null = null;
let guardedProxyAgent: EnvHttpProxyAgent | null = null;

/**
 * Direct connections validate every resolved address at connect time (anti DNS rebinding).
 * When the host environment forces an HTTP(S) proxy, the proxy resolves names, so only the
 * pre-flight DNS validation in `assertSafeTarget` applies; hosts matched by NO_PROXY still connect
 * directly, so the proxy agent carries the guarded lookup as well.
 */
function dispatcherFor(allowPrivate: boolean): Dispatcher {
  const proxied = Boolean(process.env.HTTPS_PROXY || process.env.https_proxy);
  if (proxied && !allowPrivate) {
    guardedProxyAgent ??= new EnvHttpProxyAgent({ connect: { lookup: guardedLookup } });
    return guardedProxyAgent;
  }
  if (allowPrivate) {
    return proxied ? (proxyAgent ??= new EnvHttpProxyAgent()) : (permissiveAgent ??= new Agent());
  }
  directAgent ??= new Agent({ connect: { lookup: guardedLookup } });
  return directAgent;
}

async function readLimited(response: Response, maxBytes: number): Promise<{ body: string; truncated: boolean }> {
  if (!response.body) return { body: "", truncated: false };
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  let truncated = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (received + value.byteLength > maxBytes) {
      chunks.push(value.subarray(0, maxBytes - received));
      truncated = true;
      await reader.cancel().catch(() => undefined);
      break;
    }
    chunks.push(value);
    received += value.byteLength;
  }
  return { body: Buffer.concat(chunks).toString("utf8"), truncated };
}

/** GET with SSRF guard, manual redirect validation, timeout and response size cap. */
export async function safeFetch(input: string, options: SafeFetchOptions): Promise<SafeFetchResult> {
  const timeoutMs = options.timeoutMs ?? 10_000;
  const maxBytes = options.maxBytes ?? 2 * 1024 * 1024;
  const maxRedirects = options.maxRedirects ?? 3;
  const redirects: string[] = [];
  let current = await assertSafeTarget(input, { allowPrivate: options.allowPrivate });

  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    let response: Awaited<ReturnType<typeof undiciFetch>>;
    try {
      response = await undiciFetch(current, {
        method: "GET",
        redirect: "manual",
        signal: AbortSignal.timeout(timeoutMs),
        dispatcher: dispatcherFor(options.allowPrivate),
        headers: {
          "user-agent": "QA-JOO-Analyzer/0.1 (+https://github.com/MINJOOOONG/qa-joo)",
          accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.5",
          ...options.headers,
        },
      });
    } catch (error) {
      const cause = (error as { cause?: { code?: string } }).cause;
      if (cause?.code === "EQAJOO_PRIVATE_ADDRESS") {
        throw new AppError("forbidden", `${current.hostname} resolves to a private or reserved address.`);
      }
      if ((error as Error).name === "TimeoutError") {
        throw new AppError("upstream", `Timed out after ${timeoutMs / 1000}s fetching ${current.host}.`);
      }
      throw new AppError("upstream", `Could not reach ${current.host}.`);
    }

    if (response.status >= 300 && response.status < 400 && response.headers.get("location")) {
      if (hop === maxRedirects) throw new AppError("upstream", `Too many redirects from ${input}.`);
      const next = new URL(response.headers.get("location")!, current);
      await response.body?.cancel().catch(() => undefined);
      redirects.push(next.toString());
      current = await assertSafeTarget(next, { allowPrivate: options.allowPrivate });
      continue;
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (options.accept?.length && !options.accept.some((type) => contentType.toLowerCase().startsWith(type))) {
      await response.body?.cancel().catch(() => undefined);
      throw new AppError("upstream", `Unexpected content type "${contentType || "unknown"}" from ${current.host}.`);
    }
    const declared = Number(response.headers.get("content-length") ?? 0);
    const { body, truncated } = await readLimited(response as unknown as Response, maxBytes);
    return {
      url: current.toString(),
      status: response.status,
      contentType,
      body,
      truncated: truncated || declared > maxBytes,
      redirects,
    };
  }
  throw new AppError("upstream", `Too many redirects from ${input}.`);
}
