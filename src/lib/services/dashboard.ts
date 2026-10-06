import { computeRunStats } from "@/lib/domain/run-stats";
import type { Activity, AutomationResult, AutomationRun, Project, TestCase, TestResult, TestRun } from "@/lib/domain/types";
import type { ServiceContext } from "./context";
import { listRunSummaries, type RunSummary } from "./runs";

export interface RecentFailure {
  testCase: TestCase;
  project: Project | null;
  run: TestRun | null;
  result: TestResult;
}

export interface DashboardData {
  projectCount: number;
  caseCount: number;
  activeRunCount: number;
  /** Suite health: passed / (passed + failed + blocked) over each case's latest result. */
  passRate: number | null;
  failedCount: number;
  automatedCount: number;
  automationCoverage: number | null;
  recentRuns: RunSummary[];
  recentFailures: RecentFailure[];
  activities: Activity[];
  automationRuns: Array<{ run: AutomationRun; project: Project | null; results: AutomationResult[] }>;
  projects: Project[];
}

export async function getDashboard(ctx: ServiceContext, projectId: string | null): Promise<DashboardData> {
  const filter = projectId ? { projectId } : {};
  const [allProjects, cases, runSummaries, activities, automationRuns] = await Promise.all([
    ctx.repo.listProjects(),
    ctx.repo.listTestCases({ ...filter, reviewStatuses: ["approved"] }),
    listRunSummaries(ctx, filter),
    ctx.repo.listActivities({ ...filter, limit: 15 }),
    ctx.repo.listAutomationRuns({ ...filter, limit: 6 }),
  ]);
  const projects = projectId ? allProjects.filter((p) => p.id === projectId) : allProjects;
  const projectById = new Map(allProjects.map((p) => [p.id, p]));
  const health = computeRunStats(cases.length, cases.map((c) => c.lastResult ?? "untested"));
  const automated = cases.filter((c) => c.automationStatus === "automated").length;

  const failedCases = cases
    .filter((c) => c.lastResult === "failed")
    .sort((a, b) => (b.lastResultAt ?? "").localeCompare(a.lastResultAt ?? ""))
    .slice(0, 8);
  const runById = new Map(runSummaries.map((s) => [s.run.id, s.run]));
  const recentFailures: RecentFailure[] = [];
  for (const testCase of failedCases) {
    const results = (await ctx.repo.listResults({ testCaseId: testCase.id }))
      .filter((r) => r.status === "failed")
      .sort((a, b) => (b.executedAt ?? "").localeCompare(a.executedAt ?? ""));
    if (!results[0]) continue;
    recentFailures.push({
      testCase,
      project: projectById.get(testCase.projectId) ?? null,
      run: runById.get(results[0].testRunId) ?? null,
      result: results[0],
    });
  }

  return {
    projectCount: projects.length,
    caseCount: cases.length,
    activeRunCount: runSummaries.filter((s) => s.run.status === "active").length,
    passRate: health.passRate,
    failedCount: health.failed,
    automatedCount: automated,
    automationCoverage: cases.length ? automated / cases.length : null,
    recentRuns: runSummaries.slice(0, 8),
    recentFailures,
    activities,
    automationRuns: await Promise.all(
      automationRuns.map(async (run) => ({
        run,
        project: projectById.get(run.projectId) ?? null,
        results: await ctx.repo.listAutomationResults({ automationRunId: run.id }),
      })),
    ),
    projects,
  };
}
