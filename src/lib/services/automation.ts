import { AppError, notFound } from "@/lib/errors";
import { automationCallbackSchema, createAutomationRunSchema } from "@/lib/domain/schemas";
import type {
  AutomationResult,
  AutomationRun,
  AutomationTest,
  FailureAnalysis,
  Project,
  TestCase,
  TestRun,
} from "@/lib/domain/types";
import type { AutomationRunStatus, AutomationTrigger } from "@/lib/domain/constants";
import type { PageInfo } from "@/lib/analyzer/types";
import type { AutomationDraft, AutomationDraftInput } from "@/lib/ai/automation-generator";
import type { FailureContext } from "@/lib/ai/failure-analyzer";
import { lintAutomationCode, type LintReport } from "@/lib/automation/code-lint";
import { automationFilePath, isSafeSpecPath } from "@/lib/automation/paths";
import type { DispatchResult } from "@/lib/automation/dispatch";
import { assertSafeUrl } from "@/lib/security/url-guard";
import { logActivity } from "./activity";
import { createTestCase } from "./cases";
import type { ServiceContext } from "./context";
import { recordAutomatedResult } from "./results";

// --- Drafts ----------------------------------------------------------------

export interface DraftDeps {
  fetchEntryPage(appUrl: string): Promise<PageInfo | null>;
  generate(input: AutomationDraftInput): Promise<AutomationDraft>;
}

export function entryPathOf(appUrl: string | null): string {
  if (!appUrl) return "/";
  const url = new URL(appUrl);
  return `${url.pathname || "/"}${url.search}`;
}

/** TC → Playwright draft. Never runs or commits code: the draft waits for human approval. */
export async function generateAutomationForCase(
  ctx: ServiceContext,
  deps: DraftDeps,
  testCaseId: string,
): Promise<{ automationTest: AutomationTest; lint: LintReport }> {
  const testCase = await ctx.repo.getTestCase(testCaseId);
  if (!testCase) throw notFound("Test case", testCaseId);
  if (testCase.reviewStatus !== "approved") {
    throw new AppError("invalid_state", "Approve the test case before generating automation.");
  }
  const project = await ctx.repo.getProject(testCase.projectId);
  if (!project) throw notFound("Project", testCase.projectId);
  const existing = await ctx.repo.getAutomationTestByCase(testCase.id);
  if (existing?.status === "approved") {
    throw new AppError("invalid_state", "This case already has approved automation. Edit it instead of regenerating.");
  }

  const page = project.appUrl ? await deps.fetchEntryPage(project.appUrl).catch(() => null) : null;
  const draft = await deps.generate({ testCase, entryPath: entryPathOf(project.appUrl), page });
  const filePath = automationFilePath(project.name, testCase.caseKey);
  const automationTest = existing
    ? await ctx.repo.updateAutomationTest(existing.id, {
        code: draft.code,
        status: "draft",
        filePath,
        testName: `${testCase.caseKey} ${testCase.title}`.slice(0, 200),
        generatedBy: draft.generatedBy,
        reviewNote: null,
        approvedAt: null,
      })
    : await ctx.repo.createAutomationTest({
        projectId: project.id,
        testCaseId: testCase.id,
        framework: "playwright",
        filePath,
        testName: `${testCase.caseKey} ${testCase.title}`.slice(0, 200),
        code: draft.code,
        status: "draft",
        generatedBy: draft.generatedBy,
        reviewNote: null,
        approvedAt: null,
      });
  if (testCase.automationStatus === "manual") await ctx.repo.updateTestCase(testCase.id, { automationStatus: "candidate" });
  await logActivity(ctx, {
    projectId: project.id,
    action: "automation.drafted",
    entityType: "automation_test",
    entityId: automationTest.id,
    message: `Generated a Playwright draft for ${testCase.caseKey} (${draft.generatedBy})`,
  });
  return { automationTest, lint: lintAutomationCode(automationTest.code) };
}

async function loadAutomation(ctx: ServiceContext, id: string) {
  const automation = await ctx.repo.getAutomationTest(id);
  if (!automation) throw notFound("Automation test", id);
  const testCase = await ctx.repo.getTestCase(automation.testCaseId);
  if (!testCase) throw notFound("Test case", automation.testCaseId);
  return { automation, testCase };
}

/** Saving edited code always returns the spec to draft so it is re-approved. */
export async function saveAutomationCode(ctx: ServiceContext, id: string, code: string): Promise<AutomationTest> {
  const { automation, testCase } = await loadAutomation(ctx, id);
  if (code.length > 50_000) throw new AppError("validation", "The spec is larger than 50 KB.");
  const updated = await ctx.repo.updateAutomationTest(id, { code, status: "draft", approvedAt: null });
  if (automation.status === "approved") {
    await ctx.repo.updateTestCase(testCase.id, { automationStatus: "candidate" });
  }
  await logActivity(ctx, {
    projectId: automation.projectId,
    action: "automation.edited",
    entityType: "automation_test",
    entityId: id,
    message: `Edited the Playwright spec for ${testCase.caseKey}`,
  });
  return updated;
}

export async function approveAutomation(ctx: ServiceContext, id: string, code?: string): Promise<AutomationTest> {
  const { automation, testCase } = await loadAutomation(ctx, id);
  const finalCode = code ?? automation.code;
  const lint = lintAutomationCode(finalCode);
  if (lint.errors.length) {
    throw new AppError("validation", `Fix the blocking issues before approving: ${lint.errors.join(" ")}`, { code: lint.errors[0] });
  }
  if (!isSafeSpecPath(automation.filePath)) throw new AppError("validation", "Invalid spec file path.");
  const updated = await ctx.repo.updateAutomationTest(id, {
    code: finalCode,
    status: "approved",
    approvedAt: new Date().toISOString(),
    reviewNote: `Approved by ${ctx.actor}`,
  });
  await ctx.repo.updateTestCase(testCase.id, { automationStatus: "automated" });
  await logActivity(ctx, {
    projectId: automation.projectId,
    action: "automation.approved",
    entityType: "automation_test",
    entityId: id,
    message: `Approved Playwright automation for ${testCase.caseKey}; the case is now Automated`,
  });
  return updated;
}

export async function rejectAutomation(ctx: ServiceContext, id: string, note: string | null): Promise<AutomationTest> {
  const { automation, testCase } = await loadAutomation(ctx, id);
  const updated = await ctx.repo.updateAutomationTest(id, {
    status: "rejected",
    approvedAt: null,
    reviewNote: note?.slice(0, 1000) || `Rejected by ${ctx.actor}`,
  });
  await ctx.repo.updateTestCase(testCase.id, { automationStatus: "candidate" });
  await logActivity(ctx, {
    projectId: automation.projectId,
    action: "automation.rejected",
    entityType: "automation_test",
    entityId: id,
    message: `Rejected the Playwright draft for ${testCase.caseKey}`,
  });
  return updated;
}

// --- Runs ------------------------------------------------------------------

export async function createAutomationRun(
  ctx: ServiceContext,
  raw: unknown,
  options: {
    defaultRunner: AutomationRun["runner"];
    allowPrivateTargets: boolean;
    dispatch: (run: AutomationRun, project: Project) => Promise<DispatchResult>;
    trigger?: AutomationTrigger;
  },
): Promise<AutomationRun> {
  const input = createAutomationRunSchema.parse(raw);
  const project = await ctx.repo.getProject(input.projectId);
  if (!project) throw notFound("Project", input.projectId);

  let testRun: TestRun | null = null;
  let scope: string[] | undefined = input.testCaseIds;
  if (input.testRunId) {
    testRun = await ctx.repo.getTestRun(input.testRunId);
    if (!testRun || testRun.projectId !== project.id) throw notFound("Test run", input.testRunId);
    if (testRun.status === "completed") throw new AppError("invalid_state", "Reopen the test run before running automation.");
    const runCaseIds = new Set((await ctx.repo.listRunCases(testRun.id)).map((rc) => rc.testCaseId));
    scope = (scope ?? Array.from(runCaseIds)).filter((id) => runCaseIds.has(id));
  }
  const approved = await ctx.repo.listAutomationTests({ projectId: project.id, status: "approved", testCaseIds: scope });
  if (approved.length === 0) {
    throw new AppError("validation", "No approved Playwright specs in scope. Generate and approve automation first.");
  }

  const targetUrl = input.targetUrl ?? project.appUrl;
  if (!targetUrl) throw new AppError("validation", "Set the project's Application URL (or pass targetUrl) to run automation.");
  assertSafeUrl(targetUrl, { allowPrivate: options.allowPrivateTargets });

  const run = await ctx.repo.createAutomationRun({
    projectId: project.id,
    testRunId: testRun?.id ?? null,
    environment: input.environment ?? testRun?.environment ?? project.environment,
    targetUrl,
    trigger: options.trigger ?? "manual",
    // The runner is server configuration; clients cannot choose where specs execute.
    runner: options.defaultRunner,
    branch: null,
    commitSha: null,
    status: "queued",
    testCaseIds: approved.map((test) => test.testCaseId),
    externalUrl: null,
    error: null,
    startedAt: null,
    finishedAt: null,
  });
  await logActivity(ctx, {
    projectId: project.id,
    action: "automation_run.queued",
    entityType: "automation_run",
    entityId: run.id,
    message: `Queued ${approved.length} Playwright spec(s) on the ${run.runner} runner${testRun ? ` for ${testRun.name}` : ""}`,
  });

  try {
    const dispatched = await options.dispatch(run, project);
    return dispatched.externalUrl ? await ctx.repo.updateAutomationRun(run.id, { externalUrl: dispatched.externalUrl }) : run;
  } catch (error) {
    const message = error instanceof AppError ? error.message : "Could not start the runner.";
    await ctx.repo.updateAutomationRun(run.id, { status: "failed", error: message, finishedAt: new Date().toISOString() });
    throw error;
  }
}

export async function cancelAutomationRun(ctx: ServiceContext, id: string): Promise<AutomationRun> {
  const run = await ctx.repo.getAutomationRun(id);
  if (!run) throw notFound("Automation run", id);
  if (run.status !== "queued" && run.status !== "running") {
    throw new AppError("invalid_state", "Only queued or running automation runs can be cancelled.");
  }
  const updated = await ctx.repo.updateAutomationRun(id, { status: "cancelled", finishedAt: new Date().toISOString() });
  await logActivity(ctx, {
    projectId: run.projectId,
    action: "automation_run.cancelled",
    entityType: "automation_run",
    entityId: id,
    message: "Cancelled an automation run",
  });
  return updated;
}

export interface RunnerManifest {
  automationRunId: string;
  project: { id: string; key: string; name: string };
  targetUrl: string;
  environment: string;
  /** Every case the run covers; cases without an approved spec must still be reported. */
  testCaseIds: string[];
  tests: Array<{ testCaseId: string; caseKey: string; title: string; filePath: string; code: string }>;
}

/** What a runner needs to execute a run: only approved specs, only for cases in the run. */
export async function buildRunnerManifest(ctx: ServiceContext, id: string): Promise<RunnerManifest> {
  const run = await ctx.repo.getAutomationRun(id);
  if (!run) throw notFound("Automation run", id);
  if (run.status !== "queued" && run.status !== "running") {
    throw new AppError("invalid_state", `Automation run is already ${run.status}.`);
  }
  const project = await ctx.repo.getProject(run.projectId);
  if (!project) throw notFound("Project", run.projectId);
  const tests = await ctx.repo.listAutomationTests({ projectId: project.id, status: "approved", testCaseIds: run.testCaseIds });
  const cases = new Map((await ctx.repo.listTestCases({ projectId: project.id, ids: run.testCaseIds })).map((c) => [c.id, c]));
  return {
    automationRunId: run.id,
    project: { id: project.id, key: project.key, name: project.name },
    targetUrl: run.targetUrl,
    environment: run.environment,
    testCaseIds: run.testCaseIds.filter((id) => cases.has(id)),
    tests: tests
      .filter((test) => isSafeSpecPath(test.filePath) && cases.has(test.testCaseId))
      .map((test) => ({
        testCaseId: test.testCaseId,
        caseKey: cases.get(test.testCaseId)!.caseKey,
        title: cases.get(test.testCaseId)!.title,
        filePath: test.filePath,
        code: test.code,
      })),
  };
}

const TERMINAL: AutomationRunStatus[] = ["passed", "failed", "cancelled"];

/**
 * Applies a runner callback: per-case automation results, mirroring of verdicts into the linked
 * test run, then the run status. Results are written before the terminal status so a callback that
 * fails half-way can be retried; finished runs are immutable, which makes replays harmless.
 */
export async function applyRunnerCallback(
  ctx: ServiceContext,
  raw: unknown,
): Promise<{ run: AutomationRun; accepted: number; mirrored: number; dropped: number }> {
  const payload = automationCallbackSchema.parse(raw);
  const run = await ctx.repo.getAutomationRun(payload.automationRunId);
  if (!run) throw notFound("Automation run", payload.automationRunId);
  if (TERMINAL.includes(run.status)) {
    throw new AppError("invalid_state", `Automation run is already ${run.status}.`);
  }

  const inScope = new Set(run.testCaseIds);
  const outOfScope = payload.results.find((result) => !inScope.has(result.testCaseId));
  if (outOfScope) throw new AppError("validation", `Test case ${outOfScope.testCaseId} is not part of this automation run.`);

  const now = new Date().toISOString();
  const startedAt = run.startedAt ?? now;
  if (!run.startedAt || run.status === "queued") {
    await ctx.repo.updateAutomationRun(run.id, { status: "running", startedAt });
  }

  // Cases deleted while the run was in flight are skipped instead of failing the whole callback.
  const reportedIds = Array.from(new Set(payload.results.map((result) => result.testCaseId)));
  const liveCaseIds = new Set(
    (await ctx.repo.listTestCases({ projectId: run.projectId, ids: reportedIds })).map((testCase) => testCase.id),
  );
  const results = payload.results.filter((result) => liveCaseIds.has(result.testCaseId));

  const testRun = run.testRunId ? await ctx.repo.getTestRun(run.testRunId) : null;
  const automationTests = new Map(
    (await ctx.repo.listAutomationTests({ projectId: run.projectId, testCaseIds: run.testCaseIds })).map((t) => [t.testCaseId, t]),
  );
  let mirrored = 0;
  for (const item of results) {
    const saved = await ctx.repo.upsertAutomationResult({
      automationRunId: run.id,
      testCaseId: item.testCaseId,
      automationTestId: automationTests.get(item.testCaseId)?.id ?? null,
      status: item.status,
      durationMs: item.durationMs ?? null,
      errorMessage: item.errorMessage ?? null,
      screenshotUrl: item.screenshotUrl ?? null,
      traceUrl: item.traceUrl ?? null,
      logUrl: item.logUrl ?? null,
    });
    if (testRun) {
      const mirroredResult = await recordAutomatedResult(ctx, {
        run: testRun,
        testCaseId: item.testCaseId,
        status: item.status,
        durationMs: item.durationMs ?? null,
        errorMessage: item.errorMessage ?? null,
        evidence: { screenshotUrl: item.screenshotUrl ?? null, traceUrl: item.traceUrl ?? null, logUrl: item.logUrl ?? null },
        automationResultId: saved.id,
        automationStartedAt: startedAt,
      });
      if (mirroredResult) mirrored += 1;
    }
  }
  if (testRun && results.length) await ctx.repo.updateTestRun(testRun.id, {});

  // Without an explicit status the run finishes only once every remaining case has reported.
  const allResults = await ctx.repo.listAutomationResults({ automationRunId: run.id });
  let status: AutomationRunStatus = payload.status ?? "running";
  if (!payload.status) {
    const remaining = (await ctx.repo.listTestCases({ projectId: run.projectId, ids: run.testCaseIds })).map((c) => c.id);
    const reported = new Set(allResults.map((result) => result.testCaseId));
    if (remaining.length > 0 && remaining.every((id) => reported.has(id))) {
      status = allResults.some((result) => result.status === "failed") ? "failed" : "passed";
    }
  }
  const updated = await ctx.repo.updateAutomationRun(run.id, {
    status,
    startedAt,
    finishedAt: TERMINAL.includes(status) ? new Date().toISOString() : null,
    branch: payload.branch ?? run.branch,
    commitSha: payload.commitSha ?? run.commitSha,
    externalUrl: payload.externalUrl ?? run.externalUrl,
    error: payload.error ?? run.error,
  });

  if (TERMINAL.includes(status)) {
    const failed = allResults.filter((r) => r.status === "failed").length;
    await logActivity(ctx, {
      projectId: run.projectId,
      action: `automation_run.${status}`,
      entityType: "automation_run",
      entityId: run.id,
      message: `Automation run ${status}: ${allResults.length - failed} passed, ${failed} failed`,
    });
  }
  return { run: updated, accepted: results.length, mirrored, dropped: payload.results.length - results.length };
}

export interface AutomationRunDetail {
  run: AutomationRun;
  project: Project;
  testRun: TestRun | null;
  rows: Array<{ testCase: TestCase; result: AutomationResult | null; automationTest: AutomationTest | null }>;
  summary: { total: number; passed: number; failed: number; skipped: number; pending: number; durationMs: number | null };
}

export async function getAutomationRunDetail(ctx: ServiceContext, id: string): Promise<AutomationRunDetail> {
  const run = await ctx.repo.getAutomationRun(id);
  if (!run) throw notFound("Automation run", id);
  const [project, testRun, results, cases, tests] = await Promise.all([
    ctx.repo.getProject(run.projectId),
    run.testRunId ? ctx.repo.getTestRun(run.testRunId) : Promise.resolve(null),
    ctx.repo.listAutomationResults({ automationRunId: run.id }),
    ctx.repo.listTestCases({ projectId: run.projectId, ids: run.testCaseIds }),
    ctx.repo.listAutomationTests({ projectId: run.projectId, testCaseIds: run.testCaseIds }),
  ]);
  if (!project) throw notFound("Project", run.projectId);
  const resultByCase = new Map(results.map((r) => [r.testCaseId, r]));
  const testByCase = new Map(tests.map((t) => [t.testCaseId, t]));
  const rows = cases.map((testCase) => ({
    testCase,
    result: resultByCase.get(testCase.id) ?? null,
    automationTest: testByCase.get(testCase.id) ?? null,
  }));
  return {
    run,
    project,
    testRun,
    rows,
    summary: {
      total: rows.length,
      passed: results.filter((r) => r.status === "passed").length,
      failed: results.filter((r) => r.status === "failed").length,
      skipped: results.filter((r) => r.status === "skipped").length,
      pending: rows.filter((row) => !row.result).length,
      durationMs:
        run.startedAt && run.finishedAt ? new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime() : null,
    },
  };
}

// --- Failure analysis --------------------------------------------------------

export interface FailureAnalysisDeps {
  analyze(context: FailureContext): Promise<FailureAnalysis>;
}

/** Runs AI (or heuristic) triage for a failed automated result and stores it as a suggestion. */
export async function analyzeAutomationFailure(ctx: ServiceContext, deps: FailureAnalysisDeps, resultId: string): Promise<AutomationResult> {
  const result = await ctx.repo.getAutomationResult(resultId);
  if (!result) throw notFound("Automation result", resultId);
  if (result.status !== "failed") throw new AppError("invalid_state", "Only failed results can be analyzed.");
  const [testCase, run, automation] = await Promise.all([
    ctx.repo.getTestCase(result.testCaseId),
    ctx.repo.getAutomationRun(result.automationRunId),
    result.automationTestId ? ctx.repo.getAutomationTest(result.automationTestId) : Promise.resolve(null),
  ]);
  if (!testCase || !run) throw notFound("Automation result", resultId);
  const analysis = await deps.analyze({
    testCase,
    errorMessage: result.errorMessage,
    code: automation?.code ?? null,
    durationMs: result.durationMs,
    targetUrl: run.targetUrl,
  });
  const saved = await ctx.repo.setAutomationResultAnalysis(result.id, analysis);
  await logActivity(ctx, {
    projectId: run.projectId,
    action: "automation.failure_analyzed",
    entityType: "automation_run",
    entityId: run.id,
    message: `Analyzed the ${testCase.caseKey} failure (${analysis.category}, ${analysis.confidence} confidence)`,
  });
  return saved;
}

/** Turns selected regression suggestions from a failure analysis into AI draft test cases. */
export async function addSuggestedRegressionCases(ctx: ServiceContext, resultId: string, indexes: number[]): Promise<TestCase[]> {
  const result = await ctx.repo.getAutomationResult(resultId);
  if (!result?.analysis) throw new AppError("invalid_state", "Analyze the failure first.");
  const source = await ctx.repo.getTestCase(result.testCaseId);
  if (!source) throw notFound("Test case", result.testCaseId);
  const created: TestCase[] = [];
  for (const index of Array.from(new Set(indexes))) {
    const suggestion = result.analysis.suggestedRegressionCases[index];
    if (!suggestion) continue;
    created.push(
      await createTestCase(
        ctx,
        {
          projectId: source.projectId,
          sectionId: source.sectionId,
          title: suggestion.title.slice(0, 200),
          preconditions: source.preconditions,
          steps: suggestion.steps.length ? suggestion.steps.slice(0, 15) : source.steps,
          expectedResult: suggestion.expectedResult || source.expectedResult,
          type: suggestion.type,
          priority: suggestion.priority,
          tags: ["regression", "from-failure"],
        },
        {
          source: "ai_generated",
          reviewStatus: "draft",
          aiRationale: `Suggested after ${source.caseKey} failed: ${result.analysis.probableCause}`.slice(0, 600),
          silent: true,
        },
      ),
    );
  }
  if (created.length) {
    await logActivity(ctx, {
      projectId: source.projectId,
      action: "test_case.suggested",
      entityType: "test_case",
      entityId: created[0].id,
      message: `Added ${created.length} suggested regression case(s) from the ${source.caseKey} failure as AI drafts`,
    });
  }
  return created;
}
