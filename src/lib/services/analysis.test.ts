import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { generateTestCases } from "@/lib/ai/test-case-generator";
import type { AppAnalysis } from "@/lib/analyzer/types";
import { memoryContext, seedProject } from "@/test/helpers";
import { runProjectAnalysis, type AnalysisDeps } from "./analysis";

const app: AppAnalysis = {
  baseUrl: "https://app.example.com",
  mode: "http",
  warnings: [],
  pages: [
    {
      url: "https://app.example.com/",
      path: "/",
      title: "Campaign Checker",
      description: null,
      headings: ["Campaign Analysis"],
      internalLinks: [],
      navLabels: [],
      buttons: ["Analyze"],
      forms: [{ name: "Campaign", action: null, method: "post", submitLabels: ["Analyze"], fields: [{ tag: "input", name: "url", label: "Campaign URL", type: "url", required: true, placeholder: null, constraints: ["type=url"] }] }],
      looseFields: [],
      textSample: "Campaign Analysis",
      clientRendered: false,
    },
  ],
};

const deps = (overrides: Partial<AnalysisDeps> = {}): AnalysisDeps => ({
  analyzeApplication: async () => app,
  analyzeRepository: async () => {
    throw new Error("should not be called");
  },
  generate: (input) => generateTestCases(input, null),
  ...overrides,
});

describe("project analysis → AI draft test cases", () => {
  it("saves generated cases ready to use, grouped into sections", async () => {
    const ctx = memoryContext();
    const project = await seedProject(ctx);
    const result = await runProjectAnalysis(ctx, deps(), { projectId: project.id, maxCases: 8 });
    expect(result.created.length).toBeGreaterThan(3);
    expect(result.created.every((c) => c.source === "ai_generated" && c.reviewStatus === "approved")).toBe(true);
    expect(result.created.every((c) => c.sectionId !== null)).toBe(true);
    expect(result.summary).toMatchObject({ provider: "heuristic", generatedCount: result.created.length, signals: { pages: 1, forms: 1, inputs: 1 } });
    expect((await ctx.repo.getProject(project.id))?.lastAnalysis?.generatedCount).toBe(result.created.length);
    expect(result.summary.siteSummary).toBeTruthy();
  });

  it("does not duplicate existing cases on a second pass", async () => {
    const ctx = memoryContext();
    const project = await seedProject(ctx);
    const first = await runProjectAnalysis(ctx, deps(), { projectId: project.id, maxCases: 8 });
    const second = await runProjectAnalysis(ctx, deps(), { projectId: project.id, maxCases: 8 }, "gaps");
    const titles = new Set(first.created.map((c) => c.title));
    expect(second.created.some((c) => titles.has(c.title))).toBe(false);
  });

  it("validates the request", async () => {
    const ctx = memoryContext();
    const project = await seedProject(ctx);
    await expect(runProjectAnalysis(ctx, deps(), { projectId: project.id, maxCases: 500 })).rejects.toBeInstanceOf(ZodError);
    await expect(runProjectAnalysis(ctx, deps(), { projectId: "missing" })).rejects.toMatchObject({ code: "not_found" });
  });

  it("reports source failures and fails only when nothing could be analyzed", async () => {
    const ctx = memoryContext();
    const project = await seedProject(ctx, "RF", { repoUrl: "https://github.com/a/b" });
    const failing = deps({
      analyzeRepository: async () => {
        throw new Error("rate limited");
      },
    });
    const partial = await runProjectAnalysis(ctx, failing, { projectId: project.id });
    expect(partial.summary.sources.find((s) => s.kind === "repository")).toMatchObject({ ok: false });
    const bothFail = deps({
      analyzeApplication: async () => {
        throw new Error("timeout");
      },
      analyzeRepository: async () => {
        throw new Error("private");
      },
    });
    await expect(runProjectAnalysis(ctx, bothFail, { projectId: project.id })).rejects.toMatchObject({ code: "upstream" });
  });
});
