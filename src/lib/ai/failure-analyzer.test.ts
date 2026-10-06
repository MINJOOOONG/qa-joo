import { describe, expect, it } from "vitest";
import { heuristicFailureAnalysis, type FailureContext } from "./failure-analyzer";

const base: FailureContext = {
  testCase: { caseKey: "RF-TC-009", title: "Handle API 500", steps: ["Submit"], expectedResult: "Error shown", type: "error" },
  errorMessage: null,
  code: null,
  durationMs: 1000,
  targetUrl: "https://app.example.com",
};
const analyze = (errorMessage: string) => heuristicFailureAnalysis({ ...base, errorMessage });

describe("heuristic failure analysis", () => {
  it("classifies infrastructure problems", () => {
    expect(analyze("page.goto: net::ERR_NAME_NOT_RESOLVED at https://app.example.com").category).toBe("network");
    expect(analyze("browserType.launch: Executable doesn't exist at /ms-playwright/chromium").category).toBe("environment");
  });

  it("classifies backend errors and suggests regression cases", () => {
    const analysis = analyze("Error: response status 500 Internal Server Error");
    expect(analysis.category).toBe("backend");
    expect(analysis.suggestedRegressionCases.map((c) => c.type)).toEqual(["error", "regression"]);
  });

  it("classifies broken specs", () => {
    expect(analyze("ReferenceError: pagee is not defined").category).toBe("automation_script");
  });

  it("uses concrete expected/received values for assertion mismatches", () => {
    const analysis = analyze('Error: expect(locator).toHaveText(expected) failed\nExpected string: "Saved"\nReceived string: "Something went wrong"\nTimeout: 5000ms\n  - waiting for getByRole(\'status\')');
    expect(analysis.category).toBe("ui");
    expect(analysis.probableCause).toContain("Something went wrong");
  });

  it("treats missing elements as UI or selector problems with low confidence", () => {
    const analysis = analyze("Error: expect(locator).toBeVisible() failed\nLocator: getByRole('alert').first()\nExpected: visible\nError: element(s) not found");
    expect(analysis.category).toBe("ui");
    expect(analysis.confidence).toBe("low");
  });

  it("falls back to unknown", () => {
    expect(analyze("something odd").category).toBe("unknown");
  });
});
