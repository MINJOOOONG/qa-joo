/**
 * Returns a same-origin path for post-action redirects, or the fallback.
 * Parses instead of prefix-checking so values like "/\\evil.com", "/%09/evil.com" or
 * "//evil.com" (which browsers resolve to another origin) are rejected.
 */
export function safeRedirectPath(value: unknown, fallback: string): string {
  if (typeof value !== "string" || !value.startsWith("/")) return fallback;
  // Backslashes and control characters are normalized by browsers into authority separators.
  if (/[\\\u0000-\u001f\u007f]/.test(value)) return fallback;
  try {
    const base = "http://qa-joo.invalid";
    const url = new URL(value, base);
    if (url.origin !== base) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
