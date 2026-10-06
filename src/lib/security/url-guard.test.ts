import { describe, expect, it } from "vitest";
import { assertSafeTarget, assertSafeUrl, isPrivateAddress } from "./url-guard";

const strict = { allowPrivate: false };

describe("SSRF guard", () => {
  it.each([
    "127.0.0.1",
    "10.1.2.3",
    "172.16.0.1",
    "192.168.1.10",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "224.0.0.1",
    "::1",
    "fe80::1",
    "fc00::1",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
    "64:ff9b::a9fe:a9fe",
  ])("treats %s as private", (address) => {
    expect(isPrivateAddress(address)).toBe(true);
  });

  it.each(["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111", "172.32.0.1"])("treats %s as public", (address) => {
    expect(isPrivateAddress(address)).toBe(false);
  });

  it.each([
    "http://localhost:3000",
    "http://api.localhost",
    "http://printer.local/",
    "http://metadata.google.internal/computeMetadata/v1/",
    "http://127.0.0.1/",
    "http://2130706433/",
    "http://0x7f000001/",
    "http://[::1]/",
    "http://169.254.169.254/latest/meta-data/",
    "https://example.com:22/",
  ])("blocks %s", (url) => {
    expect(() => assertSafeUrl(url, strict)).toThrow();
  });

  it("rejects non-http schemes and embedded credentials", () => {
    expect(() => assertSafeUrl("file:///etc/passwd", strict)).toThrow(/http/);
    expect(() => assertSafeUrl("ftp://example.com", strict)).toThrow(/http/);
    expect(() => assertSafeUrl("https://user:pass@example.com", strict)).toThrow(/credentials/);
  });

  it("allows public URLs on standard ports", () => {
    expect(assertSafeUrl("https://example.com/path?q=1", strict).hostname).toBe("example.com");
    expect(assertSafeUrl("http://example.com:8080/", strict).port).toBe("8080");
  });

  it("allows private targets only when explicitly enabled", () => {
    expect(assertSafeUrl("http://localhost:3000/sandbox/index.html", { allowPrivate: true }).port).toBe("3000");
  });

  it("rejects hosts that resolve to private addresses (DNS rebinding pre-check)", async () => {
    const lookup = async () => [{ address: "93.184.216.34", family: 4 }, { address: "10.0.0.5", family: 4 }];
    await expect(assertSafeTarget("https://rebind.example.com", strict, lookup)).rejects.toMatchObject({ code: "forbidden" });
    const publicLookup = async () => [{ address: "93.184.216.34", family: 4 }];
    await expect(assertSafeTarget("https://example.com", strict, publicLookup)).resolves.toBeInstanceOf(URL);
  });

  it("reports unresolvable hosts as validation errors", async () => {
    const failing = async () => {
      throw new Error("ENOTFOUND");
    };
    await expect(assertSafeTarget("https://nope.invalid", strict, failing)).rejects.toMatchObject({ code: "validation" });
  });
});
