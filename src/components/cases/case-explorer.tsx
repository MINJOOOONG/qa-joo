import Link from "next/link";
import { ListChecks, Plus } from "lucide-react";
import { AiBadge, AutomationBadge, PriorityLabel, ResultBadge, TypeBadge } from "@/components/common/badges";
import { EmptyState } from "@/components/common/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { TestCaseFilter } from "@/lib/db/repository";
import { flattenSections, sectionPaths, sectionSubtree } from "@/lib/domain/sections";
import type { ResultStatus } from "@/lib/domain/constants";
import type { Project, Section, TestCase } from "@/lib/domain/types";
import { getCaseDetail } from "@/lib/services/cases";
import type { ServiceContext } from "@/lib/services/context";
import { cn } from "@/lib/utils";
import { formatRelative } from "@/lib/i18n/format";
import { fmt } from "@/lib/i18n/define";
import { getI18n } from "@/lib/i18n/server";
import { CaseDetailView } from "./case-detail-view";
import { CaseDrawer } from "./case-drawer";
import { CaseFilters } from "./case-filters";
import { hrefWith, parseCaseQuery, type CaseSearchParams } from "./query";

export async function CaseExplorer({
  ctx,
  basePath,
  searchParams,
  fixedProject,
  defaultProjectId,
}: {
  ctx: ServiceContext;
  basePath: string;
  searchParams: CaseSearchParams;
  fixedProject?: Project;
  defaultProjectId?: string | null;
}) {
  const query = parseCaseQuery(searchParams);
  const { t, locale } = await getI18n();
  const e = t.cases.explorer;
  const projects = await ctx.repo.listProjects();
  const projectById = new Map(projects.map((p) => [p.id, p]));
  let project: Project | null = fixedProject ?? null;
  if (!project && query.project !== "all") {
    project =
      (query.project ? projects.find((p) => p.key === query.project || p.id === query.project) : null) ??
      (defaultProjectId ? (projectById.get(defaultProjectId) ?? null) : null);
  }

  const sections: Section[] = project ? await ctx.repo.listSections(project.id) : [];
  const paths = project ? sectionPaths(sections) : new Map<string, string>();
  const allSectionPaths = new Map<string, string>(paths);
  if (!project) {
    for (const p of projects) for (const [id, path] of sectionPaths(await ctx.repo.listSections(p.id))) allSectionPaths.set(id, path);
  }

  // Optional run lens: show each case's result in one test run (and only the cases in that run).
  const projectRuns = project ? await ctx.repo.listTestRuns({ projectId: project.id }) : [];
  const selectedRun = query.run ? (projectRuns.find((run) => run.id === query.run) ?? null) : null;
  const runResults = new Map<string, ResultStatus>();
  let runCaseIds: Set<string> | null = null;
  if (selectedRun) {
    const [runCases, results] = await Promise.all([
      ctx.repo.listRunCases(selectedRun.id),
      ctx.repo.listResults({ testRunId: selectedRun.id }),
    ]);
    runCaseIds = new Set(runCases.map((rc) => rc.testCaseId));
    for (const result of results) runResults.set(result.testCaseId, result.status);
  }
  const resultOf = (testCase: TestCase): ResultStatus | null =>
    selectedRun ? (runResults.get(testCase.id) ?? "untested") : testCase.lastResult;

  const filter: TestCaseFilter = {
    projectId: project?.id,
    types: query.type ? [query.type] : undefined,
    priorities: query.priority ? [query.priority] : undefined,
    automationStatuses: query.automation ? [query.automation] : undefined,
    lastResults: query.result && !selectedRun ? [query.result] : undefined,
    sources: query.source ? [query.source] : undefined,
    reviewStatuses: query.review ? [query.review] : ["approved", "draft"],
    search: query.q || undefined,
  };
  if (project && query.section === "none") filter.sectionId = null;
  let cases = await ctx.repo.listTestCases(filter);
  if (project && query.section && query.section !== "none") {
    const subtree = sectionSubtree(sections, query.section);
    cases = cases.filter((c) => c.sectionId !== null && subtree.has(c.sectionId));
  }
  if (runCaseIds) {
    const inRun = runCaseIds;
    cases = cases.filter((c) => inRun.has(c.id) && (!query.result || resultOf(c) === query.result));
  }
  const resultCounts = new Map<ResultStatus, number>();
  if (selectedRun) for (const c of cases) resultCounts.set(resultOf(c)!, (resultCounts.get(resultOf(c)!) ?? 0) + 1);

  const detail = query.caseId ? await getCaseDetail(ctx, query.caseId).catch(() => null) : null;
  const activeRuns = detail
    ? (await ctx.repo.listTestRuns({ projectId: detail.project.id, status: "active" })).map((run) => ({ id: run.id, name: run.name }))
    : [];
  const closeHref = hrefWith(basePath, searchParams, { case: null });
  const newCaseHref = `/cases/new?project=${project?.id ?? ""}&returnTo=${encodeURIComponent(closeHref)}`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CaseFilters
          showProject={!fixedProject}
          projects={projects.map((p) => ({ value: p.key, label: `${p.key} · ${p.name}` }))}
          runs={projectRuns.map((run) => ({ value: run.id, label: run.name }))}
          sections={flattenSections(sections).map((node) => ({ value: node.section.id, label: `${"— ".repeat(node.depth)}${node.section.name}` }))}
        />
        <div className="flex items-center gap-2">
          <span className="text-xs tabular-nums text-muted-foreground">{fmt(e.count, { count: cases.length })}</span>
          <Button size="sm" asChild>
            <Link href={newCaseHref}>
              <Plus /> {e.newCase}
            </Link>
          </Button>
        </div>
      </div>

      {selectedRun ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border bg-muted/30 px-3 py-2 text-xs" data-testid="run-summary">
          <Link href={`/runs/${selectedRun.id}`} className="font-medium hover:underline">
            {fmt(e.runSummary, { run: selectedRun.name, count: cases.length })}
          </Link>
          {(["passed", "failed", "blocked", "skipped", "untested"] as const).map((status) => (
            <span key={status} className="tabular-nums text-muted-foreground">
              {t.enums.resultStatus[status]} <span className="font-semibold text-foreground">{resultCounts.get(status) ?? 0}</span>
            </span>
          ))}
        </div>
      ) : null}

      {cases.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title={e.emptyTitle}
          description={project ? e.emptyWithProject : e.emptyNoProject}
          action={
            project ? (
              <Button size="sm" variant="outline" asChild>
                <Link href={`/projects/${project.key}/review?autostart=1`}>{fmt(e.analyze, { name: project.name })}</Link>
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">{e.columns.id}</TableHead>
                <TableHead>{e.columns.title}</TableHead>
                {!fixedProject ? <TableHead>{e.columns.project}</TableHead> : null}
                <TableHead>{e.columns.section}</TableHead>
                <TableHead>{e.columns.type}</TableHead>
                <TableHead>{e.columns.priority}</TableHead>
                <TableHead>{e.columns.automation}</TableHead>
                <TableHead>{selectedRun ? fmt(e.resultIn, { run: selectedRun.name }) : e.columns.lastResult}</TableHead>
                <TableHead>{e.columns.updated}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cases.map((testCase) => {
                const href = hrefWith(basePath, searchParams, { case: testCase.id });
                return (
                  <TableRow key={testCase.id} data-state={query.caseId === testCase.id ? "selected" : undefined} className={cn(testCase.reviewStatus === "draft" && "bg-violet-50/30")}>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      <Link href={href} scroll={false} className="hover:text-foreground">
                        {testCase.caseKey}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-[28rem]">
                      <Link href={href} scroll={false} className="flex items-center gap-2 hover:underline" data-testid="case-row-link">
                        <span className="truncate">{testCase.title}</span>
                        {testCase.source === "ai_generated" ? <AiBadge className="shrink-0" /> : null}
                        {testCase.reviewStatus === "draft" ? <Badge variant="warning" className="shrink-0">{e.draft}</Badge> : null}
                      </Link>
                    </TableCell>
                    {!fixedProject ? (
                      <TableCell className="text-xs text-muted-foreground">{projectById.get(testCase.projectId)?.key}</TableCell>
                    ) : null}
                    <TableCell className="max-w-52 truncate text-xs text-muted-foreground">
                      {testCase.sectionId ? (allSectionPaths.get(testCase.sectionId) ?? "—") : "—"}
                    </TableCell>
                    <TableCell>
                      <TypeBadge type={testCase.type} />
                    </TableCell>
                    <TableCell>
                      <PriorityLabel priority={testCase.priority} />
                    </TableCell>
                    <TableCell>
                      <AutomationBadge status={testCase.automationStatus} />
                    </TableCell>
                    <TableCell>
                      <ResultBadge status={resultOf(testCase)} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatRelative(testCase.updatedAt, locale)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {detail ? (
        <CaseDrawer closeHref={closeHref} title={`${detail.testCase.caseKey} ${detail.testCase.title}`}>
          <CaseDetailView detail={detail} activeRuns={activeRuns} returnTo={closeHref} />
          <div className="mt-6 border-t pt-3 text-xs">
            <Link href={`/cases/${detail.testCase.id}`} className="text-primary hover:underline">
              {e.openFullPage}
            </Link>
          </div>
        </CaseDrawer>
      ) : null}
    </div>
  );
}
