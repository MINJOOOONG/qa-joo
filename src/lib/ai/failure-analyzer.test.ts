import { describe, expect, it } from "vitest";
import { failureSystemPrompt, filterRegressionSuggestions, heuristicFailureAnalysis, type FailureContext } from "./failure-analyzer";
import { systemPromptFor } from "./test-case-generator";

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

  it("recognizes strict mode violations as a test-code problem without regression cases", () => {
    const error =
      "Error: strict mode violation: getByText('Campaign URL') resolved to 2 elements:\n    1) <label>Campaign URL</label>\n    2) <p role=\"alert\">Campaign URL is invalid</p>";
    const ko = analyze(error);
    expect(ko).toMatchObject({ category: "automation_script", suggestedRegressionCases: [] });
    expect(ko.probableCause).toBe("로케이터가 요소 2개와 일치해 테스트 코드가 실패했어요 (앱 문제 아님).");
    expect(ko.suggestedNextStep).toContain(".first()");
    expect(heuristicFailureAnalysis({ ...base, errorMessage: error, locale: "en" }).probableCause).toContain("matched 2 elements");
  });

  it("does not suggest regression cases that restate the failing case", () => {
    expect(analyze('Expected string: "Saved"\nReceived string: "Oops"').suggestedRegressionCases).toEqual([]);
    const same = { title: "Other title", type: "functional" as const, priority: "high" as const, steps: ["Submit"], expectedResult: "Error shown" };
    const different = { ...same, title: "Submit twice", steps: ["Submit", "Submit again"] };
    expect(filterRegressionSuggestions("ui", [same, different], base.testCase)).toEqual([different]);
    expect(filterRegressionSuggestions("automation_script", [different], base.testCase)).toEqual([]);
  });

  it("falls back to unknown", () => {
    expect(analyze("something odd").category).toBe("unknown");
  });

  it("writes the triage in the UI language (Korean by default, English on request)", () => {
    const error = "Error: response status 500 Internal Server Error";
    const ko = analyze(error);
    expect(ko.probableCause).toMatch(/[가-힣]/);
    expect(ko.suggestedNextStep).toMatch(/[가-힣]/);
    expect(ko.suggestedRegressionCases[0].title).toBe('"Handle API 500" 중 API 500 오류 처리');
    const en = heuristicFailureAnalysis({ ...base, errorMessage: error, locale: "en" });
    expect(en.probableCause).toBe("The application returned a server error (5xx) during the flow; the frontend may not handle it.");
    expect(en.suggestedRegressionCases.map((c) => c.title)).toEqual([
      'Handle API 500 gracefully during "Handle API 500"',
      'Retry "Handle API 500" after upstream recovery',
    ]);
    expect(heuristicFailureAnalysis({ ...base, errorMessage: "net::ERR_CONNECTION_REFUSED", locale: "en" }).suggestedRegressionCases[0].title).toBe(
      "Show a friendly error when handle api 500 cannot reach the service",
    );
  });

  it("asks the model for the UI language", () => {
    expect(failureSystemPrompt("ko")).toContain("in Korean");
    expect(failureSystemPrompt("en")).not.toContain("Korean");
    expect(systemPromptFor("ko")).toContain("in Korean");
    expect(systemPromptFor("en")).not.toContain("Korean");
    expect(systemPromptFor("en")).toContain('"Negative Cases"');
  });
});
