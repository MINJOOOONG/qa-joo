import { beforeEach, describe, expect, it } from "vitest";
import { ZodError } from "zod";
import type { Project, TestCase, TestRun } from "@/lib/domain/types";
import { memoryContext, seedCase, seedProject } from "@/test/helpers";
import type { ServiceContext } from "./context";
import { recordAutomatedResult, recordManualResult } from "./results";
import { createTestRun, getRunDetail, setRunStatus } from "./runs";

describe("test result state transitions", () => {
  let ctx: ServiceContext;
  let project: Project;
  let cases: TestCase[];
  let run: TestRun;

  beforeEach(async () => {
    ctx = memoryContext();
    project = await seedProject(ctx);
    cases = [await seedCase(ctx, project.id), await seedCase(ctx, project.id, { title: "Second" })];
    run = await createTestRun(ctx, { projectId: project.id, name: "Regression", environment: "staging", selection: { mode: "all" } });
  });

  const record = (input: Record<string, unknown>) => recordManualResult(ctx, { testRunId: run.id, testCaseId: cases[0].id, ...input });

  it("records a pass and denormalizes the last result on the case", async () => {
    const result = await record({ status: "passed", durationMs: 2400 });
    expect(result).toMatchObject({ status: "passed", mode: "manual", tester: "Test QA", attempts: 1, durationMs: 2400 });
    expect((await ctx.repo.getTestCase(cases[0].id))?.lastResult).toBe("passed");
  });

  it("re-testing updates the same row instead of creating a duplicate", async () => {
    await record({ status: "passed" });
    await record({ status: "failed", failureCategory: "ui", severity: "major", actualResult: "Button missing" });
    const results = await ctx.repo.listResults({ testRunId: run.id });
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ status: "failed", attempts: 2, failureCategory: "ui" });
  });

  it("requires triage details for failures and a reason for blockers", async () => {
    await expect(record({ status: "failed" })).rejects.toBeInstanceOf(ZodError);
    await expect(record({ status: "failed", failureCategory: "ui", severity: "major" })).rejects.toBeInstanceOf(ZodError);
    await expect(record({ status: "blocked" })).rejects.toBeInstanceOf(ZodError);
    await expect(record({ status: "blocked", comment: "Staging is down" })).resolves.toMatchObject({ status: "blocked" });
  });

  it("drops failure fields when the verdict is not a failure", async () => {
    const result = await record({ status: "passed", failureCategory: "ui", severity: "major" });
    expect(result).toMatchObject({ failureCategory: null, severity: null });
  });

  it("rejects javascript: evidence URLs", async () => {
    await expect(
      record({ status: "failed", failureCategory: "ui", severity: "minor", actualResult: "x", evidence: { screenshotUrl: "javascript:alert(1)" } }),
    ).rejects.toBeInstanceOf(ZodError);
  });

  it("resets to untested only when there is a result", async () => {
    await expect(record({ status: "untested" })).rejects.toMatchObject({ code: "invalid_state" });
    await record({ status: "skipped" });
    const reset = await record({ status: "untested" });
    expect(reset.status).toBe("untested");
    expect((await ctx.repo.getTestCase(cases[0].id))?.lastResult).toBeNull();
  });

  it("locks results once the run is completed", async () => {
    await record({ status: "passed" });
    await setRunStatus(ctx, run.id, "completed");
    await expect(record({ status: "skipped" })).rejects.toMatchObject({ code: "invalid_state" });
    await setRunStatus(ctx, run.id, "active");
    await expect(record({ status: "skipped" })).resolves.toMatchObject({ status: "skipped" });
  });

  it("rejects results for cases outside the run", async () => {
    const outsider = await seedCase(ctx, project.id, { title: "Not in run" });
    await expect(recordManualResult(ctx, { testRunId: run.id, testCaseId: outsider.id, status: "passed" })).rejects.toMatchObject({ code: "validation" });
  });

  it("does not let automation overwrite a newer manual verdict", async () => {
    const startedAt = new Date(Date.now() - 60_000).toISOString();
    await record({ status: "failed", failureCategory: "ui", severity: "major", actualResult: "Seen by a human" });
    const mirrored = await recordAutomatedResult(ctx, {
      run,
      testCaseId: cases[0].id,
      status: "passed",
      durationMs: 1200,
      errorMessage: null,
      evidence: {},
      automationResultId: "auto-1",
      automationStartedAt: startedAt,
    });
    expect(mirrored).toBeNull();
    expect((await ctx.repo.getResult(run.id, cases[0].id))?.status).toBe("failed");

    const automated = await recordAutomatedResult(ctx, {
      run,
      testCaseId: cases[1].id,
      status: "failed",
      durationMs: 1800,
      errorMessage: "expect(locator).toBeVisible() failed",
      evidence: { screenshotUrl: "/api/artifacts/run-1234/x.png" },
      automationResultId: "auto-2",
      automationStartedAt: startedAt,
    });
    expect(automated).toMatchObject({ mode: "automated", status: "failed", actualResult: "expect(locator).toBeVisible() failed" });
  });

  it("computes run progress and pass rate from results", async () => {
    await record({ status: "passed" });
    await recordManualResult(ctx, { testRunId: run.id, testCaseId: cases[1].id, status: "blocked", comment: "env" });
    const detail = await getRunDetail(ctx, run.id);
    expect(detail.stats).toMatchObject({ total: 2, passed: 1, blocked: 1, executed: 2, progress: 1, passRate: 0.5 });
  });
});
