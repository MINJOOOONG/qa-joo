/**
 * Removes credentials from text before it is stored or sent to an AI provider.
 * Repository content is untrusted and may contain committed secrets; QA JOO never forwards them.
 */
const PATTERNS: Array<[RegExp, string]> = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, "[REDACTED PRIVATE KEY]"],
  [/\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{16,}/g, "[REDACTED]"],
  [/\bgh[pousr]_[A-Za-z0-9]{20,}/g, "[REDACTED]"],
  [/\bgithub_pat_[A-Za-z0-9_]{20,}/g, "[REDACTED]"],
  [/\bAKIA[0-9A-Z]{16}\b/g, "[REDACTED]"],
  [/\bxox[abprs]-[A-Za-z0-9-]{10,}/g, "[REDACTED]"],
  [/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, "[REDACTED JWT]"],
  [
    /((?:api[_-]?key|secret|token|password|passwd|service[_-]?role[_-]?key|client[_-]?secret)["']?\s*[:=]\s*)(["']?)[^\s"'`,;]{8,}\2/gi,
    "$1$2[REDACTED]$2",
  ],
];

export function redactSecrets(text: string): string {
  return PATTERNS.reduce((value, [pattern, replacement]) => value.replace(pattern, replacement), text);
}

/** Files that are never fetched from a repository, regardless of size. */
export function isSensitivePath(path: string): boolean {
  const name = path.split("/").pop()?.toLowerCase() ?? "";
  return (
    (/^\.env(\..*)?$/.test(name) && name !== ".env.example") ||
    /\.(pem|key|p12|pfx|keystore|jks)$/.test(name) ||
    /^id_(rsa|dsa|ecdsa|ed25519)/.test(name) ||
    /secret|credential/.test(name)
  );
}
