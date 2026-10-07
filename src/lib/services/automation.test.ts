import { beforeEach, describe, expect, it, vi } from "vitest";
import { heuristicAutomationDraft } from "@/lib/ai/automation-generator";
import { heuristicFailureAnalysis } from "@/lib/ai/failure-analyzer";
import type { Project, TestCase } from "@/lib/domain/types";
import { memoryContext, seedCase, seedProject } from "@/test/helpers";
import {
  addSuggestedRegressionCases,
  analyzeAutomationFailure,
  applyRunnerCallback,
  approveAutomation,
  buildRunnerManifest,
  createAutomationRun,
  generateAutomationForCase,
  rejectAutomation,
  saveAutomationCode,
} from "./automation";
import type { ServiceContext } from "./context";
import { createTestRun, getRunDetail, setRunStatus } from "./runs";

const draftDeps = { fetchEntryPage: async () => null, generate: async (input: Parameters<typeof heuristicAutomationDraft>[0]) => heuristicAutomationDraft(input) };
const noDispatch = vi.fn(async () => ({ externalUrl: null, note: "external" }));
const runOptions = { defaultRunner: "external" as const, allowPrivateTargets: false, dispatch: noDispatch };

describe("automation workflow", () => {
  let ctx: ServiceContext;
  let project: Project;
  let testCase: TestCase;

  beforeEach(async () => {
    ctx = memoryContext();
    project = await seedProject(ctx);
    testCase = await seedCase(ctx, project.id, { steps: ['Enter "bad" in "Campaign URL".', 'Click "Analyze".'], expectedResult: "An error is shown." });
  });

  async function approvedSpec(target = testCase) {
    const { automationTest } = await generateAutomationForCase(ctx, draftDeps, target.id);
    return approveAutomation(ctx, automationTest.id);
  }

  it("generates a draft for approved cases only and marks the case as a candidate", async () => {
    const draft = await seedCase(ctx, project.id, { title: "AI draft" }, { source: "ai_generated" });
    await expect(generateAutomationForCase(ctx, draftDeps, draft.id)).rejects.toMatchObject({ code: "invalid_state" });
    const { automationTest, lint } = await generateAutomationForCase(ctx, draftDeps, testCase.id);
    expect(automationTest).toMatchObject({ status: "draft", framework: "playwright", filePath: "tests/project-rf/RF-TC-001.spec.ts" });
    expect(lint.errors).toEqual([]);
    expect((await ctx.repo.getTestCase(testCase.id))?.automationStatus).toBe("candidate");
  });

  it("requires approval (and a clean lint) before a case is Automated", async () => {
    const { automationTest } = await generateAutomationForCase(ctx, draftDeps, testCase.id);
    await expect(approveAutomation(ctx, automationTest.id, `import fs from "node:fs";\n${automationTest.code}`)).rejects.toMatchObject({ code: "validation" });
    await approveAutomation(ctx, automationTest.id);
    expect((await ctx.repo.getTestCase(testCase.id))?.automationStatus).toBe("automated");
    await expect(generateAutomationForCase(ctx, draftDeps, testCase.id)).rejects.toMatchObject({ code: "invalid_state" });

    const edited = await saveAutomationCode(ctx, automationTest.id, automationTest.code.replace("bad", "worse"));
    expect(edited.status).toBe("draft");
    expect((await ctx.repo.getTestCase(testCase.id))?.automationStatus).toBe("candidate");
    expect((await rejectAutomation(ctx, automationTest.id, "Selectors are wrong")).reviewNote).toBe("Selectors are wrong");
  });

  it("queues runs only with approved specs and a safe target", async () => {
    await expect(createAutomationRun(ctx, { projectId: project.id }, runOptions)).rejects.toMatchObject({ code: "validation" });
    await approvedSpec();
    await expect(createAutomationRun(ctx, { projectId: project.id, targetUrl: "http://127.0.0.1:3000" }, runOptions)).rejects.toMatchObject({ code: "forbidden" });
    const run = await createAutomationRun(ctx, { projectId: project.id }, runOptions);
    expect(run).toMatchObject({ status: "queued", trigger: "manual", runner: "external", targetUrl: "https://app.example.com/", testCaseIds: [testCase.id] });
    expect(noDispatch).toHaveBeenCalled();
  });

  it("marks the run failed when dispatch fails", async () => {
    await approvedSpec();
    const failing = { ...runOptions, dispatch: async () => Promise.reject(new Error("boom")) };
    await expect(createAutomationRun(ctx, { projectId: project.id }, failing)).rejects.toThrow("boom");
    const [run] = await ctx.repo.listAutomationRuns({ projectId: project.id });
    expect(run).toMatchObject({ status: "failed", error: "Could not start the runner." });
  });

  it("serves a manifest with approved specs and applies callbacks into the test run", async () => {
    await approvedSpec();
    const other = await seedCase(ctx, project.id, { title: "Manual only" });
    const testRun = await createTestRun(ctx, { projectId: project.id, name: "Regression", environment: "staging", selection: { mode: "all" } });
    const run = await createAutomationRun(ctx, { projectId: project.id, testRunId: testRun.id }, runOptions);
    const manifest = await buildRunnerManifest(ctx, run.id);
    expect(manifest.tests.map((t) => t.caseKey)).toEqual([testCase.caseKey]);
    expect(manifest.tests[0].code).toContain("@playwright/test");

    await expect(applyRunnerCallback(ctx, { automationRunId: run.id, results: [{ testCaseId: other.id, status: "passed" }] })).rejects.toMatchObject({ code: "validation" });
    expect((await applyRunnerCallback(ctx, { automationRunId: run.id, status: "running", commitSha: "abc1234" })).run.status).toBe("running");
    const final = await applyRunnerCallback(ctx, {
      automationRunId: run.id,
      status: "failed",
      results: [{ testCaseId: testCase.id, status: "failed", durationMs: 1800, errorMessage: "net::ERR_CONNECTION_REFUSED", screenshotUrl: "/api/artifacts/run-12345678/shot.png" }],
    });
    expect(final).toMatchObject({ accepted: 1, mirrored: 1, run: { status: "failed", commitSha: "abc1234" } });
    expect(final.run.finishedAt).not.toBeNull();

    const detail = await getRunDetail(ctx, testRun.id);
    const row = detail.rows.find((r) => r.testCase.id === testCase.id)!;
    expect(row).toMatchObject({ mode: "automated", result: { status: "failed", mode: "automated", durationMs: 1800 } });
    expect(row.automationResult?.screenshotUrl).toBe("/api/artifacts/run-12345678/shot.png");

    await expect(applyRunnerCallback(ctx, { automationRunId: run.id, status: "passed" })).rejects.toMatchObject({ code: "invalid_state" });
    await expect(buildRunnerManifest(ctx, run.id)).rejects.toMatchObject({ code: "invalid_state" });
  });

  it("refuses to run automation inside a completed test run", async () => {
    await approvedSpec();
    const testRun = await createTestRun(ctx, { projectId: project.id, name: "Done", environment: "staging", selection: { mode: "all" } });
    await setRunStatus(ctx, testRun.id, "completed");
    await expect(createAutomationRun(ctx, { projectId: project.id, testRunId: testRun.id }, runOptions)).rejects.toMatchObject({ code: "invalid_state" });
  });

  it("stores failure analysis as a suggestion and turns suggestions into AI-generated cases", async () => {
    await approvedSpec();
    const run = await createAutomationRun(ctx, { projectId: project.id }, runOptions);
    await applyRunnerCallback(ctx, { automationRunId: run.id, results: [{ testCaseId: testCase.id, status: "failed", errorMessage: "status 500 Internal Server Error" }] });
    const [result] = await ctx.repo.listAutomationResults({ automationRunId: run.id });
    const analyzed = await analyzeAutomationFailure(ctx, { analyze: async (context) => ({ ...heuristicFailureAnalysis(context), provider: "heuristic", analyzedAt: "now" }) }, result.id);
    expect(analyzed.analysis).toMatchObject({ category: "backend", provider: "heuristic" });
    const created = await addSuggestedRegressionCases(ctx, result.id, [0, 1, 0]);
    expect(created).toHaveLength(2);
    expect(created.every((c) => c.reviewStatus === "approved" && c.source === "ai_generated" && c.tags.includes("from-failure"))).toBe(true);
  });
});
