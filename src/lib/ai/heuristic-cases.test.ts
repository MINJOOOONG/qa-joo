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
});
