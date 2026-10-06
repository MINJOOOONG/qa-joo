/**
 * Static review of Playwright specs before a human can approve them. Approved specs run on a
 * runner machine with the repository checked out, so anything beyond driving the browser through
 * `@playwright/test` is treated as unsafe and blocks approval.
 */
export interface LintReport {
  errors: string[];
  warnings: string[];
}

const FORBIDDEN: Array<[RegExp, string]> = [
  [/\brequire\s*\(/, "require() is not allowed; use the existing @playwright/test import."],
  [/\bimport\s*\(/, "Dynamic import() is not allowed."],
  [/\bchild_process\b|\bexecSync\b|\bspawn\s*\(/, "Spawning processes is not allowed."],
  [/\bprocess\s*\.\s*(env|exit|kill|chdir|binding)\b/, "Accessing process.env / process controls is not allowed in specs."],
  [/\beval\s*\(|\bnew\s+Function\s*\(/, "eval / new Function is not allowed."],
  [/\b(fs|node:fs|fs\/promises)\b\s*[.'"]/, "File system access is not allowed."],
  [/\bglobalThis\b|\b__dirname\b|\b__filename\b/, "Global / filesystem helpers are not allowed."],
];

export function lintAutomationCode(code: string): LintReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!code.trim()) return { errors: ["The spec is empty."], warnings };
  if (code.length > 50_000) errors.push("The spec is larger than 50 KB.");

  const imports = Array.from(code.matchAll(/^\s*import\s+(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']/gm)).map((m) => m[1]);
  if (!imports.includes("@playwright/test")) errors.push('The spec must import { test, expect } from "@playwright/test".');
  for (const source of imports.filter((value) => value !== "@playwright/test")) {
    errors.push(`Import of "${source}" is not allowed; only @playwright/test may be imported.`);
  }
  for (const [pattern, message] of FORBIDDEN) if (pattern.test(code)) errors.push(message);
  if (!/\btest\s*(\.\w+)?\s*\(/.test(code)) errors.push("No test() block found.");
  if (!/\bexpect\s*\(/.test(code)) warnings.push("No expect() assertion found; the test can only fail on errors.");
  if (/waitForTimeout\s*\(/.test(code)) warnings.push("waitForTimeout() makes tests slow and flaky; prefer web-first assertions.");
  if (/page\.goto\(\s*["']https?:\/\//.test(code)) warnings.push("page.goto() uses an absolute URL; prefer relative paths so the run's target URL applies.");
  if (/TODO/.test(code)) warnings.push("The spec still contains TODOs to resolve before it is reliable.");
  if (/\.only\s*\(/.test(code)) errors.push("test.only() would skip other tests; remove it.");
  return { errors: Array.from(new Set(errors)), warnings };
}
