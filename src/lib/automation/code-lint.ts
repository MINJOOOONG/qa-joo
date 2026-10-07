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
  [/(^|[^\w$.])fetch\s*\(/, "fetch() is not allowed; specs may only drive the browser."],
  [/\b(XMLHttpRequest|WebSocket|EventSource)\b/, "XMLHttpRequest / WebSocket / EventSource are not allowed in specs."],
  [/\(\s*\{[^}]*\brequest\b[^}]*\}|\brequest\s*\.\s*\w+/, "The request API fixture (page.request / { request }) is not allowed; specs may only drive the browser."],
  [/\bdocument\s*\.\s*cookie\b/, "Reading document.cookie is not allowed."],
];

/** Identifiers that reach Node internals however they are spelled (e.g. `x["constructor"]` is caught via the string check). */
const FORBIDDEN_IDENTIFIERS = ["process", "globalThis", "global", "require", "module", "Function", "constructor", "__proto__", "eval"];

/**
 * Blanks out comments and string/template literal contents (keeping quotes) so the checks below
 * see code structure only, and returns the literal contents separately.
 */
export function splitCode(code: string): { code: string; literals: string[] } {
  let out = "";
  const literals: string[] = [];
  let i = 0;
  while (i < code.length) {
    const ch = code[i];
    const next = code[i + 1];
    if (ch === "/" && next === "/") {
      while (i < code.length && code[i] !== "\n") i += 1;
      continue;
    }
    if (ch === "/" && next === "*") {
      const end = code.indexOf("*/", i + 2);
      i = end === -1 ? code.length : end + 2;
      out += " ";
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      let j = i + 1;
      let literal = "";
      while (j < code.length && code[j] !== ch) {
        if (code[j] === "\\") {
          literal += code[j + 1] ?? "";
          j += 2;
          continue;
        }
        if (ch === "`" && code[j] === "$" && code[j + 1] === "{") {
          // Template expressions are code: keep them visible to the checks.
          const close = code.indexOf("}", j);
          out += ` ${code.slice(j + 2, close === -1 ? code.length : close)} `;
          j = close === -1 ? code.length : close + 1;
          continue;
        }
        literal += code[j];
        j += 1;
      }
      literals.push(literal);
      out += ch + ch;
      i = j + 1;
      continue;
    }
    out += ch;
    i += 1;
  }
  return { code: out, literals };
}

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
  const { code: structure, literals } = splitCode(code);
  for (const [pattern, message] of FORBIDDEN) if (pattern.test(structure)) errors.push(message);
  for (const name of FORBIDDEN_IDENTIFIERS) {
    if (new RegExp(`(^|[^\\w$.])${name}(?![\\w$])|\\.\\s*${name}(?![\\w$])`).test(structure)) {
      errors.push(`"${name}" is not allowed in specs.`);
    }
  }
  for (const literal of literals) {
    if (FORBIDDEN_IDENTIFIERS.includes(literal.trim())) errors.push(`"${literal.trim()}" is not allowed as a property name in specs.`);
  }
  if (!/\btest\s*(\.\w+)?\s*\(/.test(code)) errors.push("No test() block found.");
  if (!/\bexpect\s*\(/.test(code)) warnings.push("No expect() assertion found; the test can only fail on errors.");
  if (/waitForTimeout\s*\(/.test(code)) warnings.push("waitForTimeout() makes tests slow and flaky; prefer web-first assertions.");
  if (/page\.goto\(\s*["']https?:\/\//.test(code)) warnings.push("page.goto() uses an absolute URL; prefer relative paths so the run's target URL applies.");
  if (/file:\/\//i.test(code)) errors.push("file:// URLs are not allowed.");
  const expectCount = (structure.match(/\bexpect\s*\(/g) ?? []).length;
  const bodyOnlyCount = (code.match(/\bexpect\s*\(\s*page\.locator\(\s*["']body["']\s*\)\s*\)/g) ?? []).length;
  if (expectCount > 0 && bodyOnlyCount === expectCount) {
    warnings.push("This spec does not check the actual result; it only asserts that the page body is visible.");
  }
  if (/TODO/.test(code)) warnings.push("The spec still contains TODOs to resolve before it is reliable.");
  if (/\.only\s*\(/.test(code)) errors.push("test.only() would skip other tests; remove it.");
  return { errors: Array.from(new Set(errors)), warnings };
}
