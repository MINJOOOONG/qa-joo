import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { parsePage } from "@/lib/analyzer/html";
import type { ProjectAnalysis } from "@/lib/analyzer/types";
import { UNHAPPY_CASE_TYPES } from "@/lib/domain/constants";
import { balanceCases, dedupeCases, heuristicTestCases, unhappyShare } from "./heuristic-cases";
import type { GeneratedCase } from "./schemas";

const html = fs.readFileSync(new URL("../../../public/sandbox/index.html", import.meta.url), "utf8");
const analysis: ProjectAnalysis = {
  app: { baseUrl: "http://localhost:3000", mode: "http", pages: [parsePage(html, "http://localhost:3000/sandbox/index.html")], warnings: [] },
  repo: {
    url: "https://github.com/a/b",
    owner: "a",
    repo: "b",
    defaultBranch: "main",
    description: null,
    language: "TypeScript",
    framework: "Next.js",
    readme: null,
    routes: ["/", "/about"],
    apiEndpoints: ["/api/analyze-campaign"],
    components: [],
    keyFiles: [],
    hints: ["Rate limiting is implemented", "Requests use timeouts"],
    warnings: [],
  },
  errors: [],
};

describe("heuristic test case generation", () => {
  const cases = heuristicTestCases("Sandbox", analysis, 14);

  it("respects the maximum and grounds every case in evidence", () => {
    expect(cases.length).toBeLessThanOrEqual(14);
    expect(cases.every((c) => c.rationale.length > 0 && c.steps.length > 0)).toBe(true);
  });

  it("covers negative, boundary, security and error paths (>= 40%)", () => {
    for (const type of UNHAPPY_CASE_TYPES) expect(cases.some((c) => c.type === type)).toBe(true);
    expect(unhappyShare(cases)).toBeGreaterThanOrEqual(0.4);
  });

  it("uses the real field labels and constraints", () => {
    const titles = cases.map((c) => c.title).join("\n");
    expect(titles).toContain("Campaign URL");
    expect(cases.find((c) => c.type === "security" && /localhost/i.test(c.title))?.steps.join(" ")).toContain("169.254.169.254");
  });

  it("writes cases in Korean and keeps distinct Korean titles", () => {
    expect(cases.every((c) => /[가-힣]/.test(c.title) && c.steps.every((step) => /[가-힣]/.test(step)))).toBe(true);
    expect(new Set(cases.map((c) => c.title)).size).toBe(cases.length);
    expect(dedupeCases([cases[0], { ...cases[0], title: `${cases[0].title}!` }])).toHaveLength(1);
    expect(dedupeCases([cases[0], cases[1]])).toHaveLength(2);
  });

  it("dedupes against existing cases", () => {
    const deduped = dedupeCases(cases, [cases[0].title.toUpperCase()]);
    expect(deduped.find((c) => c.title === cases[0].title)).toBeUndefined();
  });

  it("balances large candidate sets toward unhappy paths", () => {
    const make = (type: GeneratedCase["type"], n: number): GeneratedCase[] =>
      Array.from({ length: n }, (_, i) => ({ title: `${type} ${i}`, area: "A", subarea: "", type, priority: "medium", preconditions: "", steps: ["x"], expectedResult: "y", tags: [], rationale: "r" }));
    const picked = balanceCases([...make("functional", 20), ...make("negative", 3), ...make("security", 1)], 10);
    expect(picked).toHaveLength(10);
    expect(unhappyShare(picked)).toBeGreaterThanOrEqual(0.4);
  });

  it("writes cases in English for the English UI, with the same coverage and order rules", () => {
    const english = heuristicTestCases("Sandbox", analysis, 14, "en");
    expect(english.length).toBe(cases.length);
    expect(english.some((c) => /[가-힣]/.test(`${c.title} ${c.steps.join(" ")} ${c.expectedResult}`))).toBe(false);
    for (const type of UNHAPPY_CASE_TYPES) expect(english.some((c) => c.type === type)).toBe(true);
    expect(english.find((c) => c.type === "security" && /localhost/i.test(c.title))?.steps.join(" ")).toContain("169.254.169.254");
    expect(english.map((c) => c.type)).toEqual(cases.map((c) => c.type));
  });
});
