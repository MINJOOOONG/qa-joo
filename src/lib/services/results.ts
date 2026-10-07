import { AppError, notFound } from "@/lib/errors";
import { recordResultSchema } from "@/lib/domain/schemas";
import { assertCanRecordResult } from "@/lib/domain/result-rules";
import { RESULT_STATUS_LABELS, type AutomationResultStatus } from "@/lib/domain/constants";
import type { Evidence, TestResult, TestRun } from "@/lib/domain/types";
import { logActivity } from "./activity";
import type { ServiceContext } from "./context";

const NO_EVIDENCE: Evidence = { screenshotUrl: null, traceUrl: null, logUrl: null, networkLogUrl: null };

/**
 * Recomputes the denormalized `lastResult` on a case from its most recent executed result —
 * manual/mirrored test-run results and automation results (with or without a linked test run).
 */
export async function refreshLastResult(ctx: ServiceContext, testCaseId: string): Promise<void> {
  const [results, automation] = await Promise.all([
    ctx.repo.listResults({ testCaseId }),
    ctx.repo.listAutomationResults({ testCaseId }),
  ]);
  const candidates: Array<{ status: TestResult["status"]; at: string }> = [
    ...results.filter((r) => r.status !== "untested" && r.executedAt).map((r) => ({ status: r.status, at: r.executedAt! })),
    ...automation.map((r) => ({ status: r.status, at: r.createdAt })),
  ];
  const latest = candidates.sort((a, b) => b.at.localeCompare(a.at))[0];
  await ctx.repo.setLastResult(testCaseId, latest?.status ?? null, latest?.at ?? null);
}

async function loadRunAndMembership(ctx: ServiceContext, testRunId: string, testCaseId: string) {
  const run = await ctx.repo.getTestRun(testRunId);
  if (!run) throw notFound("Test run", testRunId);
  const runCases = await ctx.repo.listRunCases(testRunId);
  if (!runCases.some((rc) => rc.testCaseId === testCaseId)) {
    throw new AppError("validation", "This test case is not part of the run.");
  }
  const testCase = await ctx.repo.getTestCase(testCaseId);
  if (!testCase) throw notFound("Test case", testCaseId);
  return { run, testCase };
}

/** Records a manual verdict from the execution drawer. */
export async function recordManualResult(ctx: ServiceContext, raw: unknown): Promise<TestResult> {
  const input = recordResultSchema.parse(raw);
  const { run, testCase } = await loadRunAndMembership(ctx, input.testRunId, input.testCaseId);
  const current = await ctx.repo.getResult(run.id, testCase.id);
  assertCanRecordResult({ run, current, next: input.status, mode: "manual" });

  const isFailure = input.status === "failed";
  const executedAt = input.status === "untested" ? null : new Date().toISOString();
  const result = await ctx.repo.upsertResult({
    testRunId: run.id,
    testCaseId: testCase.id,
    status: input.status,
    mode: "manual",
    actualResult: input.actualResult ?? null,
    comment: input.comment ?? null,
    durationMs: input.durationMs ?? null,
    tester: input.status === "untested" ? null : ctx.actor,
    failureCategory: isFailure ? (input.failureCategory ?? null) : null,
    severity: isFailure ? (input.severity ?? null) : null,
    evidence: { ...NO_EVIDENCE, ...input.evidence },
    automationResultId: null,
    executedAt,
  });
  await ctx.repo.updateTestRun(run.id, {}); // bump updatedAt so the run surfaces as recently active
  await refreshLastResult(ctx, testCase.id);
  await logActivity(ctx, {
    projectId: run.projectId,
    action: input.status === "untested" ? "test_result.reset" : "test_result.recorded",
    entityType: "test_result",
    entityId: result.id,
    message:
      input.status === "untested"
        ? `Reset ${testCase.caseKey} in ${run.name}`
        : `Marked ${testCase.caseKey} ${RESULT_STATUS_LABELS[input.status]} in ${run.name}`,
  });
  return result;
}

/** Mirrors an automation runner verdict into the linked test run. */
export async function recordAutomatedResult(
  ctx: ServiceContext,
  params: {
    run: TestRun;
    testCaseId: string;
    status: AutomationResultStatus;
    durationMs: number | null;
    errorMessage: string | null;
    evidence: Partial<Evidence>;
    automationResultId: string;
    automationStartedAt: string | null;
  },
): Promise<TestResult | null> {
  const { run } = params;
  const runCases = await ctx.repo.listRunCases(run.id);
  if (!runCases.some((rc) => rc.testCaseId === params.testCaseId)) return null;
  const current = await ctx.repo.getResult(run.id, params.testCaseId);
  try {
    assertCanRecordResult({
      run,
      current,
      next: params.status,
      mode: "automated",
      automationStartedAt: params.automationStartedAt,
    });
  } catch (error) {
    if (error instanceof AppError) return null; // keep the human verdict / closed run untouched
    throw error;
  }
  const result = await ctx.repo.upsertResult({
    testRunId: run.id,
    testCaseId: params.testCaseId,
    status: params.status,
    mode: "automated",
    actualResult: params.status === "failed" ? (params.errorMessage?.slice(0, 4000) ?? null) : null,
    comment: null,
    durationMs: params.durationMs,
    tester: ctx.actor,
    failureCategory: null,
    severity: null,
    evidence: { ...NO_EVIDENCE, ...params.evidence },
    automationResultId: params.automationResultId,
    executedAt: new Date().toISOString(),
  });
  await refreshLastResult(ctx, params.testCaseId);
  return result;
}
