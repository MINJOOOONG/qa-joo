import { AppError, notFound } from "@/lib/errors";
import { createRunSchema, type CaseSelection } from "@/lib/domain/schemas";
import { computeRunStats, type RunStats } from "@/lib/domain/run-stats";
import { flattenSections, sectionPaths, sectionSubtree } from "@/lib/domain/sections";
import type { ExecutionMode } from "@/lib/domain/constants";
import type {
  AutomationResult,
  AutomationRun,
  Project,
  TestCase,
  TestResult,
  TestRun,
} from "@/lib/domain/types";
import { logActivity } from "./activity";
import type { ServiceContext } from "./context";

/** Resolves a run's case selection to approved case ids, in section-tree order. */
export async function resolveCaseSelection(
  ctx: ServiceContext,
  projectId: string,
  selection: CaseSelection,
): Promise<string[]> {
  const [cases, sections] = await Promise.all([
    ctx.repo.listTestCases({ projectId, reviewStatuses: ["approved"] }),
    ctx.repo.listSections(projectId),
  ]);
  let selected: TestCase[] = cases;
  if (selection.mode === "filter") {
    const sectionIds = new Set<string>();
    for (const id of selection.sectionIds) for (const child of sectionSubtree(sections, id)) sectionIds.add(child);
    selected = cases.filter(
      (c) =>
        (selection.sectionIds.length === 0 || (c.sectionId !== null && sectionIds.has(c.sectionId))) &&
        (selection.types.length === 0 || selection.types.includes(c.type)) &&
        (selection.priorities.length === 0 || selection.priorities.includes(c.priority)) &&
        (selection.automationStatuses.length === 0 || selection.automationStatuses.includes(c.automationStatus)),
    );
  } else if (selection.mode === "manual") {
    const wanted = new Set(selection.caseIds);
    selected = cases.filter((c) => wanted.has(c.id));
  }
  const order = new Map(flattenSections(sections).map((node, index) => [node.section.id, index]));
  return selected
    .map((c, index) => ({ c, index }))
    .sort(
      (a, b) =>
        (a.c.sectionId ? (order.get(a.c.sectionId) ?? 0) + 1 : 0) -
          (b.c.sectionId ? (order.get(b.c.sectionId) ?? 0) + 1 : 0) || a.index - b.index,
    )
    .map(({ c }) => c.id);
}

export async function createTestRun(ctx: ServiceContext, raw: unknown): Promise<TestRun> {
  const input = createRunSchema.parse(raw);
  const project = await ctx.repo.getProject(input.projectId);
  if (!project) throw notFound("Project", input.projectId);
  const caseIds = await resolveCaseSelection(ctx, project.id, input.selection);
  if (caseIds.length === 0) {
    throw new AppError("validation", "The selection matched no approved test cases.", {
      selection: "No approved test cases match this selection.",
    });
  }
  const run = await ctx.repo.createTestRun(
    {
      projectId: project.id,
      name: input.name,
      environment: input.environment,
      build: input.build ?? null,
      description: input.description ?? null,
      createdBy: ctx.actor,
    },
    caseIds,
  );
  await logActivity(ctx, {
    projectId: project.id,
    action: "test_run.created",
    entityType: "test_run",
    entityId: run.id,
    message: `Created run ${run.name} with ${caseIds.length} case(s)`,
  });
  return run;
}

export async function addCasesToRun(ctx: ServiceContext, testRunId: string, caseIds: string[]): Promise<number> {
  const run = await ctx.repo.getTestRun(testRunId);
  if (!run) throw notFound("Test run", testRunId);
  if (run.status === "completed") throw new AppError("invalid_state", "Reopen the run before adding cases.");
  const cases = await ctx.repo.listTestCases({ projectId: run.projectId, ids: caseIds });
  const draft = cases.find((c) => c.reviewStatus !== "approved");
  if (draft) throw new AppError("validation", `${draft.caseKey} must be approved before it can be executed.`);
  if (cases.length !== new Set(caseIds).size) {
    throw new AppError("validation", "Every case must belong to the run's project.");
  }
  const added = await ctx.repo.addRunCases(run.id, cases.map((c) => c.id));
  if (added) {
    await ctx.repo.updateTestRun(run.id, {});
    await logActivity(ctx, {
      projectId: run.projectId,
      action: "test_run.cases_added",
      entityType: "test_run",
      entityId: run.id,
      message: `Added ${added} case(s) to ${run.name}`,
    });
  }
  return added;
}

export async function setRunStatus(ctx: ServiceContext, testRunId: string, status: TestRun["status"]): Promise<TestRun> {
  const run = await ctx.repo.getTestRun(testRunId);
  if (!run) throw notFound("Test run", testRunId);
  if (run.status === status) return run;
  const updated = await ctx.repo.updateTestRun(run.id, {
    status,
    completedAt: status === "completed" ? new Date().toISOString() : null,
  });
  await logActivity(ctx, {
    projectId: run.projectId,
    action: status === "completed" ? "test_run.completed" : "test_run.reopened",
    entityType: "test_run",
    entityId: run.id,
    message: `${status === "completed" ? "Completed" : "Reopened"} run ${run.name}`,
  });
  return updated;
}

export async function deleteTestRun(ctx: ServiceContext, testRunId: string): Promise<void> {
  const run = await ctx.repo.getTestRun(testRunId);
  if (!run) throw notFound("Test run", testRunId);
  const affected = (await ctx.repo.listRunCases(run.id)).map((rc) => rc.testCaseId);
  await ctx.repo.deleteTestRun(run.id);
  const { refreshLastResult } = await import("./results");
  for (const caseId of affected) await refreshLastResult(ctx, caseId);
  await logActivity(ctx, {
    projectId: run.projectId,
    action: "test_run.deleted",
    entityType: "test_run",
    entityId: run.id,
    message: `Deleted run ${run.name}`,
  });
}

export interface RunRow {
  testCase: TestCase;
  sectionPath: string | null;
  result: TestResult | null;
  mode: ExecutionMode;
  automationResult: AutomationResult | null;
}

export interface RunDetail {
  run: TestRun;
  project: Project;
  rows: RunRow[];
  stats: RunStats;
  automationRuns: AutomationRun[];
  automatedCaseCount: number;
}

export async function getRunDetail(ctx: ServiceContext, testRunId: string): Promise<RunDetail> {
  const run = await ctx.repo.getTestRun(testRunId);
  if (!run) throw notFound("Test run", testRunId);
  const [project, runCases, results, sections, automationRuns] = await Promise.all([
    ctx.repo.getProject(run.projectId),
    ctx.repo.listRunCases(run.id),
    ctx.repo.listResults({ testRunId: run.id }),
    ctx.repo.listSections(run.projectId),
    ctx.repo.listAutomationRuns({ testRunId: run.id, limit: 20 }),
  ]);
  if (!project) throw notFound("Project", run.projectId);
  const cases = await ctx.repo.listTestCases({ projectId: run.projectId, ids: runCases.map((rc) => rc.testCaseId) });
  const caseById = new Map(cases.map((c) => [c.id, c]));
  const resultByCase = new Map(results.map((r) => [r.testCaseId, r]));
  const automationResultIds = new Set(results.map((r) => r.automationResultId).filter(Boolean));
  const automationResults = new Map<string, AutomationResult>();
  for (const automationRun of automationRuns) {
    const list = await ctx.repo.listAutomationResults({ automationRunId: automationRun.id });
    for (const item of list) if (automationResultIds.has(item.id)) automationResults.set(item.id, item);
  }
  const paths = sectionPaths(sections);
  const rows: RunRow[] = [];
  for (const rc of runCases) {
    const testCase = caseById.get(rc.testCaseId);
    if (!testCase) continue;
    const result = resultByCase.get(testCase.id) ?? null;
    rows.push({
      testCase,
      sectionPath: testCase.sectionId ? (paths.get(testCase.sectionId) ?? null) : null,
      result,
      mode: testCase.automationStatus === "automated" ? "automated" : "manual",
      automationResult: result?.automationResultId ? (automationResults.get(result.automationResultId) ?? null) : null,
    });
  }
  return {
    run,
    project,
    rows,
    stats: computeRunStats(rows.length, rows.map((row) => row.result?.status ?? "untested")),
    automationRuns,
    automatedCaseCount: rows.filter((row) => row.mode === "automated").length,
  };
}

export interface RunSummary {
  run: TestRun;
  project: Project | null;
  stats: RunStats;
}

export async function listRunSummaries(ctx: ServiceContext, filter: { projectId?: string } = {}): Promise<RunSummary[]> {
  const [runs, projects] = await Promise.all([ctx.repo.listTestRuns(filter), ctx.repo.listProjects()]);
  const projectById = new Map(projects.map((p) => [p.id, p]));
  const results = await ctx.repo.listResults({ testRunIds: runs.map((r) => r.id) });
  const statusesByRun = new Map<string, TestResult["status"][]>();
  for (const result of results) {
    const list = statusesByRun.get(result.testRunId) ?? [];
    list.push(result.status);
    statusesByRun.set(result.testRunId, list);
  }
  const summaries: RunSummary[] = [];
  for (const run of runs) {
    const total = (await ctx.repo.listRunCases(run.id)).length;
    summaries.push({
      run,
      project: projectById.get(run.projectId) ?? null,
      stats: computeRunStats(total, statusesByRun.get(run.id) ?? []),
    });
  }
  return summaries;
}
