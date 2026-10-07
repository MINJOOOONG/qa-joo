import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { parsePage } from "@/lib/analyzer/html";
import type { ProjectAnalysis } from "@/lib/analyzer/types";
import { UNHAPPY_CASE_TYPES } from "@/lib/domain/constants";
import { balanceCases, dedupeCases, heuristicGapCandidates, heuristicTestCases, normalizeTitle, unhappyShare } from "./heuristic-cases";
import { objectParticle } from "./heuristic-cases-shared";
import { generateTestCases } from "./test-case-generator";
import type { GeneratedCase } from "./schemas";

const html = fs.readFileSync(new URL("../../../public/sandbox/index.html", import.meta.url), "utf8");
const aboutHtml = fs.readFileSync(new URL("../../../public/sandbox/about.html", import.meta.url), "utf8");
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

  it("writes executable happy-path steps with concrete values and a visible outcome", () => {
    for (const locale of ["ko", "en"] as const) {
      const happy = heuristicTestCases("Sandbox", analysis, 30, locale).find((c) => c.tags.includes("happy-path"))!;
      const steps = happy.steps.join("\n");
      expect(steps).toContain('"https://example.com/campaign"');
      expect(steps).toContain('"brunch, seongsu"');
      expect(steps).toMatch(/"1"/);
      expect(steps).not.toMatch(/유효한 값|valid data/);
      expect(happy.expectedResult).toContain('"Campaign requirements"');
      expect(happy.title).not.toMatch(/^\//);
    }
    const ko = heuristicTestCases("Sandbox", analysis, 30).find((c) => c.tags.includes("happy-path"))!;
    expect(ko.steps[0]).toBe('"Campaign URL"에 "https://example.com/campaign"을 입력한다.');
  });

  it("phrases limits and failures as doable, concrete checks", () => {
    for (const locale of ["ko", "en"] as const) {
      const all = heuristicTestCases("Sandbox", analysis, 40, locale);
      const text = all.map((c) => `${c.title} ${c.preconditions} ${c.steps.join(" ")} ${c.expectedResult}`).join("\n");
      expect(text).not.toMatch(/2,048|2,049|HTTP 500을 반환하거나|returns HTTP 500 or|잘리거나 거부|truncated or rejected/);
      expect(all.every((c) => !c.title.startsWith("/"))).toBe(true);
      const maxlength = all.find((c) => c.title.includes("300"))!;
      expect(maxlength.expectedResult).toMatch(/300자까지만 입력된다|at most 300 characters/);
      const error = all.find((c) => c.type === "error" && c.tags.includes("resilience"))!;
      expect(error.steps.join(" ")).toMatch(/Offline/);
      const numeric = all.find((c) => c.tags.includes("number"))!;
      expect(numeric.steps.length).toBe(8);
      expect(numeric.steps.every((step) => !/뒤|then/.test(step))).toBe(true);
    }
    const nav = heuristicTestCases("Sandbox", analysis, 40).find((c) => c.tags.includes("navigation"))!;
    expect(nav.steps).toEqual(['"Checker" 링크를 클릭한다.', '"About" 링크를 클릭한다.']);
  });

  it("fills gaps with genuinely new cases after step 1, in both languages", () => {
    const crawled: ProjectAnalysis = {
      ...analysis,
      app: { ...analysis.app!, pages: [analysis.app!.pages[0], parsePage(aboutHtml, "http://localhost:3000/sandbox/about.html")] },
    };
    for (const locale of ["ko", "en"] as const) {
      const step1 = heuristicTestCases("Sandbox", crawled, 14, locale);
      const gaps = dedupeCases(heuristicGapCandidates("Sandbox", crawled, locale), step1.map((c) => c.title));
      expect(gaps.length).toBeGreaterThanOrEqual(6);
      const tags = gaps.flatMap((c) => c.tags);
      for (const tag of ["keyboard", "responsive", "state", "navigation"]) expect(tags).toContain(tag);
      expect(gaps.some((c) => c.expectedResult.includes("About this sandbox"))).toBe(true);
    }
    const ko = heuristicGapCandidates("Sandbox", crawled, "ko");
    const en = heuristicGapCandidates("Sandbox", crawled, "en");
    expect(en.map((c) => c.type)).toEqual(ko.map((c) => c.type));
    expect(en.some((c) => /[가-힣]/.test(`${c.title} ${c.steps.join(" ")} ${c.expectedResult}`))).toBe(false);
  });

  it("links pages that were not crawled as gap cases", () => {
    const gaps = heuristicGapCandidates("Sandbox", analysis, "ko");
    expect(gaps.find((c) => c.title === "연결된 페이지 로딩: About")?.steps).toContain('"About" 링크를 클릭한다.');
  });

  it("gap mode without an AI key never repeats existing or dismissed titles", async () => {
    const step1 = await generateTestCases({ projectName: "Sandbox", projectDescription: null, analysis, existingTitles: [], recentFailures: [], focus: null, maxCases: 14, mode: "analyze" }, null);
    const dismissed = [normalizeTitle(step1.cases[1].title)];
    const gap = await generateTestCases({ projectName: "Sandbox", projectDescription: null, analysis, existingTitles: [...step1.cases.slice(2).map((c) => c.title), step1.cases[0].title, ...dismissed], recentFailures: [], focus: null, maxCases: 10, mode: "gaps" }, null);
    expect(gap.cases.length).toBeGreaterThan(0);
    const taken = new Set(step1.cases.map((c) => normalizeTitle(c.title)));
    expect(gap.cases.some((c) => taken.has(normalizeTitle(c.title)))).toBe(false);
  });

  it("picks the Korean object particle", () => {
    expect(objectParticle("https://example.com/campaign")).toBe("을");
    expect(objectParticle("not-a-valid-url")).toBe("을");
    expect(objectParticle("user@")).toBe("를");
    expect(objectParticle("2")).toBe("를");
    expect(objectParticle("브런치")).toBe("를");
    expect(objectParticle("성수")).toBe("를");
    expect(objectParticle("가방")).toBe("을");
  });
});
