import dns from "node:dns";
import net from "node:net";
import { AppError } from "@/lib/errors";

/**
 * SSRF protection for every outbound request QA JOO makes on behalf of a user
 * (project analysis, repository reads). Private, loopback, link-local, multicast and
 * reserved ranges are blocked unless ALLOW_PRIVATE_NETWORK_TARGETS is enabled for local work.
 */
const blockList = new net.BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  blockList.addSubnet(network, prefix, "ipv4");
}
for (const [network, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
  ["2001:db8::", 32],
  ["100::", 64],
] as const) {
  blockList.addSubnet(network, prefix, "ipv6");
}

const BLOCKED_HOST_SUFFIXES = [".localhost", ".local", ".internal", ".home.arpa", ".lan"];
const BLOCKED_HOSTS = new Set(["localhost", "metadata.google.internal", "metadata"]);
const PUBLIC_PORTS = new Set(["", "80", "443", "8080", "8443"]);

/** IPv4-mapped (::ffff:a.b.c.d) and NAT64 (64:ff9b::a.b.c.d) addresses embed an IPv4 target. */
function embeddedIpv4(address: string): string | null {
  const lower = address.toLowerCase();
  const mapped = /^(?:::ffff:|64:ff9b::)(\d{1,3}(?:\.\d{1,3}){3})$/.exec(lower);
  if (mapped) return mapped[1];
  const hexMapped = /^(?:::ffff:|64:ff9b::)([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(lower);
  if (hexMapped) {
    const high = parseInt(hexMapped[1], 16);
    const low = parseInt(hexMapped[2], 16);
    return `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`;
  }
  return null;
}

export function isPrivateAddress(address: string): boolean {
  const family = net.isIP(address);
  if (family === 0) return true; // not an IP: never trust it as "public"
  if (family === 6) {
    const v4 = embeddedIpv4(address);
    if (v4) return isPrivateAddress(v4);
    return blockList.check(address, "ipv6");
  }
  return blockList.check(address, "ipv4");
}

export interface GuardOptions {
  allowPrivate: boolean;
}

/** Synchronous checks on the URL itself (scheme, credentials, host names, ports, IP literals). */
export function assertSafeUrl(input: string | URL, options: GuardOptions): URL {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new AppError("validation", "Enter a valid http(s) URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new AppError("validation", "Only http and https URLs are supported.");
  }
  if (url.username || url.password) {
    throw new AppError("validation", "URLs with embedded credentials are not allowed.");
  }
  if (options.allowPrivate) return url;

  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (BLOCKED_HOSTS.has(host) || BLOCKED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))) {
    throw new AppError("forbidden", "Local and internal hostnames cannot be analyzed.");
  }
  if (net.isIP(host) && isPrivateAddress(host)) {
    throw new AppError("forbidden", "Private, loopback and reserved IP addresses cannot be analyzed.");
  }
  if (!PUBLIC_PORTS.has(url.port)) {
    throw new AppError("forbidden", "Only standard web ports (80, 443, 8080, 8443) are allowed.");
  }
  return url;
}

type LookupAll = (hostname: string) => Promise<Array<{ address: string; family: number }>>;

const defaultLookupAll: LookupAll = (hostname) => dns.promises.lookup(hostname, { all: true, verbatim: true });

/** Full check: URL rules plus DNS resolution, rejecting hosts that resolve to private ranges. */
export async function assertSafeTarget(
  input: string | URL,
  options: GuardOptions,
  lookupAll: LookupAll = defaultLookupAll,
): Promise<URL> {
  const url = assertSafeUrl(input, options);
  if (options.allowPrivate) return url;
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(host)) return url;
  let addresses: Array<{ address: string }>;
  try {
    addresses = await lookupAll(host);
  } catch {
    throw new AppError("validation", `Could not resolve ${host}.`);
  }
  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new AppError("forbidden", `${host} resolves to a private or reserved address.`);
  }
  return url;
}

/**
 * `lookup` for socket connections: re-validates the address actually being dialed, which closes
 * the DNS-rebinding gap between `assertSafeTarget` and the real connection.
 */
export function guardedLookup(
  hostname: string,
  options: dns.LookupOptions,
  callback: (error: NodeJS.ErrnoException | null, address: string | dns.LookupAddress[], family?: number) => void,
): void {
  dns.lookup(hostname, { ...options, all: true, verbatim: true }, (error, addresses) => {
    if (error) return callback(error, []);
    const list = addresses as dns.LookupAddress[];
    const unsafe = list.find((entry) => isPrivateAddress(entry.address));
    if (unsafe || list.length === 0) {
      const blocked: NodeJS.ErrnoException = new Error(`Blocked connection to private address for ${hostname}`);
      blocked.code = "EQAJOO_PRIVATE_ADDRESS";
      return callback(blocked, []);
    }
    if (options.all) return callback(null, list);
    callback(null, list[0].address, list[0].family);
  });
}
