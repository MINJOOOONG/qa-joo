import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { parsePage } from "@/lib/analyzer/html";
import { lintAutomationCode } from "@/lib/automation/code-lint";
import { assertionFor, generateAutomationDraft, heuristicAutomationDraft, splitCompoundStep } from "./automation-generator";
import type { LlmProvider } from "./provider";

const page = parsePage(fs.readFileSync(new URL("../../../public/sandbox/index.html", import.meta.url), "utf8"), "http://localhost:3000/sandbox/index.html");
const testCase = {
  caseKey: "SB-TC-008",
  title: "Reject malformed URL in Campaign URL",
  preconditions: "User is on the checker.",
  steps: ['Enter "not-a-valid-url" in "Campaign URL" and click "Analyze".'],
  expectedResult: "An inline validation error is shown.",
  type: "negative" as const,
};

describe("Playwright draft generation", () => {
  it("maps steps to user-facing locators from the analyzed page", () => {
    const draft = heuristicAutomationDraft({ testCase, entryPath: "/sandbox/index.html", page });
    expect(draft.code).toContain('await page.goto("/sandbox/index.html");');
    expect(draft.code).toContain('await page.getByLabel(/Campaign URL/i).fill("not-a-valid-url");');
    expect(draft.code).toContain('await page.getByRole("button", { name: /Analyze/i }).click();');
    expect(draft.code).toContain('await expect(page.getByRole("alert").first()).toBeVisible();');
    expect(lintAutomationCode(draft.code).errors).toEqual([]);
  });

  it("leaves TODOs instead of guessing", () => {
    const draft = heuristicAutomationDraft({ testCase: { ...testCase, steps: ["Throttle the network to 3G."] }, entryPath: "/", page: null });
    expect(draft.code).toContain("// TODO: Throttle the network to 3G");
    expect(draft.assumptions.length).toBeGreaterThan(0);
  });

  it("splits compound steps and builds assertions from quoted text", () => {
    expect(splitCompoundStep('Enter "x" in "URL" and click "Go"')).toEqual(['Enter "x" in "URL"', 'click "Go"']);
    expect(assertionFor("A message 'Saved successfully' appears.")).toEqual([
      "// Expected: A message 'Saved successfully' appears.",
      'await expect(page.getByRole("alert")).toHaveCount(0);',
      'await expect(page.getByText("Saved successfully").first()).toBeVisible();',
    ]);
    expect(assertionFor("The user's dashboard shows \"Welcome back\".")).toContain('await expect(page.getByText("Welcome back").first()).toBeVisible();');
    expect(assertionFor('An error "Enter a valid URL" is shown.')).toEqual([
      '// Expected: An error "Enter a valid URL" is shown.',
      'await expect(page.getByText("Enter a valid URL").first()).toBeVisible();',
    ]);
    expect(assertionFor("It's the user's page.\nNext line")[0]).toBe("// TODO: assert the expected result — It's the user's page. Next line");
  });

  it("wraps LLM output with a review header", async () => {
    const provider: LlmProvider = {
      name: "anthropic",
      model: "claude-opus-5-5",
      generate: async () =>
        ({ code: 'import { test, expect } from "@playwright/test";\n\ntest("SB-TC-008 x", async ({ page }) => {\n  await page.goto("/");\n  await expect(page).toHaveTitle(/Sandbox/);\n});', assumptions: ["Title contains Sandbox"] }) as never,
    };
    const draft = await generateAutomationDraft({ testCase, entryPath: "/", page }, provider);
    expect(draft.generatedBy).toBe("anthropic:claude-opus-5-5");
    expect(draft.code).toContain("// REVIEW: Title contains Sandbox");
    expect(draft.code.startsWith('import { test, expect } from "@playwright/test";')).toBe(true);
  });
});

describe("Korean test steps", () => {
  const korean = {
    ...testCase,
    title: "Campaign URL에 잘못된 형식의 URL 입력 시 거부",
    steps: [
      "/sandbox/index.html 페이지를 연다.",
      '"Campaign URL" 필드를 비워 둔다.',
      '"Campaign URL"에 "not-a-valid-url"을 입력하고 "Analyze" 버튼을 클릭한다.',
      '"Analyze" 버튼을 빠르게 두 번 클릭한다.',
      "응답을 기다린다.",
    ],
    expectedResult: "입력란에 검증 오류가 표시되고 요청이 전송되지 않는다.",
  };

  it("maps Korean phrasing to Playwright actions", () => {
    const draft = heuristicAutomationDraft({ testCase: korean, entryPath: "/sandbox/index.html", page });
    expect(draft.code).toContain('await page.getByLabel(/Campaign URL/i).fill("");');
    expect(draft.code).toContain('await page.getByLabel(/Campaign URL/i).fill("not-a-valid-url");');
    expect(draft.code).toContain('await page.getByRole("button", { name: /Analyze/i }).click();');
    expect(draft.code).toContain('await page.getByRole("button", { name: /Analyze/i }).dblclick();');
    expect(draft.code).toContain("// 응답을 기다린다");
    expect(draft.code).toContain('await expect(page.getByRole("alert").first()).toBeVisible();');
    expect(draft.code).not.toContain("TODO");
    expect(lintAutomationCode(draft.code).errors).toEqual([]);
  });

  it("splits Korean compound steps", () => {
    expect(splitCompoundStep('"A"에 "x"을 입력하고 "Go" 버튼을 클릭한다.')).toEqual(['"A"에 "x"을 입력하', '"Go" 버튼을 클릭한다.']);
  });
});

describe("expected-result assertions", () => {
  it("asserts no alert for happy paths instead of an error alert", () => {
    const lines = assertionFor("요청이 성공하고 결과가 오류 없이 표시된다.");
    expect(lines).toContain('await expect(page.getByRole("alert")).toHaveCount(0);');
    expect(lines.join("\n")).not.toContain("toBeVisible");
    expect(assertionFor("The request succeeds and the report is displayed without errors.")).toContain(
      'await expect(page.getByRole("alert")).toHaveCount(0);',
    );
    expect(assertionFor("No error is shown.")).toContain('await expect(page.getByRole("alert")).toHaveCount(0);');
  });

  it("checks quoted text on success with .first()", () => {
    expect(assertionFor('"분석 결과" 제목이 오류 없이 표시된다.')).toEqual([
      '// Expected: "분석 결과" 제목이 오류 없이 표시된다.',
      'await expect(page.getByRole("alert")).toHaveCount(0);',
      'await expect(page.getByText("분석 결과").first()).toBeVisible();',
    ]);
  });

  it("still asserts the alert for real error expectations", () => {
    expect(assertionFor("입력란에 검증 오류가 표시된다.")).toContain('await expect(page.getByRole("alert").first()).toBeVisible();');
  });

  it("fills the happy-path step form and does not double quotes in review notes", () => {
    const happy = heuristicAutomationDraft({
      testCase: { ...testCase, steps: ['"Campaign URL"에 "https://example.com/?utm_source=a"을 입력한다.', '"Campaign URL"에 값을 입력한다.'] },
      entryPath: "/",
      page,
    });
    expect(happy.code).toContain('await page.getByLabel(/Campaign URL/i).fill("https://example.com/?utm_source=a");');
    expect(happy.code).toContain('// REVIEW: 입력값을 정하세요: "Campaign URL"에 값을 입력한다');
    expect(happy.code).not.toContain('""Campaign URL"');
  });
});
