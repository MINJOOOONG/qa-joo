import { describe, expect, it } from "vitest";
import { SIGNATURE_HEADER, TIMESTAMP_HEADER, signRequest, verifySignature } from "./runner-auth";

const secret = "test-secret";
const body = JSON.stringify({ automationRunId: "run-1", status: "running" });

function verify(overrides: Partial<Parameters<typeof verifySignature>[0]> = {}) {
  const headers = signRequest(secret, "POST", "/api/automation/results", body, 1_700_000_000_000);
  return verifySignature({
    secret,
    method: "POST",
    path: "/api/automation/results",
    body,
    timestamp: headers[TIMESTAMP_HEADER],
    signature: headers[SIGNATURE_HEADER],
    now: 1_700_000_030_000,
    ...overrides,
  });
}

describe("runner HMAC signatures", () => {
  it("accepts a valid signature", () => {
    expect(verify()).toEqual({ ok: true });
  });

  it("rejects tampered bodies, paths, methods and secrets", () => {
    expect(verify({ body: body.replace("running", "passed") }).ok).toBe(false);
    expect(verify({ path: "/api/automation/artifacts" }).ok).toBe(false);
    expect(verify({ method: "GET" }).ok).toBe(false);
    expect(verify({ secret: "other" }).ok).toBe(false);
  });

  it("rejects stale or missing timestamps and malformed signatures", () => {
    expect(verify({ now: 1_700_000_000_000 + 10 * 60_000 })).toEqual({ ok: false, reason: expect.stringContaining("window") });
    expect(verify({ timestamp: null }).ok).toBe(false);
    expect(verify({ signature: "v1=abc" }).ok).toBe(false);
    expect(verify({ signature: `v2=${"0".repeat(64)}` }).ok).toBe(false);
  });

  it("signs binary bodies", () => {
    const bytes = new Uint8Array([137, 80, 78, 71]);
    const headers = signRequest(secret, "POST", "/api/automation/artifacts?runId=x", bytes);
    expect(
      verifySignature({ secret, method: "POST", path: "/api/automation/artifacts?runId=x", body: bytes, timestamp: headers[TIMESTAMP_HEADER], signature: headers[SIGNATURE_HEADER] }),
    ).toEqual({ ok: true });
  });
});
