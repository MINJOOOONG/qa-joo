/** Case keys look like `RF-TC-001`: project key, fixed `TC` infix, zero-padded sequence. */
const CASE_KEY_PATTERN = /^([A-Z][A-Z0-9]{1,9})-TC-(\d+)$/;

export function formatCaseKey(projectKey: string, sequence: number): string {
  return `${projectKey}-TC-${String(sequence).padStart(3, "0")}`;
}

export function caseKeyNumber(caseKey: string): number {
  const match = CASE_KEY_PATTERN.exec(caseKey);
  return match ? Number(match[2]) : Number.MAX_SAFE_INTEGER;
}

/** Highest numeric sequence among keys (0 when none); malformed keys are ignored. */
export function highestCaseNumber(keys: string[]): number {
  return keys.reduce((max, key) => {
    const value = caseKeyNumber(key);
    return value === Number.MAX_SAFE_INTEGER ? max : Math.max(max, value);
  }, 0);
}

/** Next free key for a project, after the highest sequence in use (gaps are never reused). */
export function nextCaseKey(projectKey: string, highestInUse: number): string {
  return formatCaseKey(projectKey, highestInUse + 1);
}

export function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "project"
  );
}
