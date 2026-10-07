import Link from "next/link";
import { Bot, Terminal } from "lucide-react";
import { AutomationRunStatusBadge, ResultBadge } from "@/components/common/badges";
import { SectionTitle } from "@/components/common/page-header";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDuration } from "@/lib/domain/run-stats";
import type { RunnerMode } from "@/lib/env";
import type { ServiceContext } from "@/lib/services/context";
import { fmt } from "@/lib/i18n/define";
import { formatRelative } from "@/lib/i18n/format";
import { getI18n } from "@/lib/i18n/server";

export async function AutomationOverview({ ctx, projectId, runnerMode }: { ctx: ServiceContext; projectId?: string; runnerMode: RunnerMode }) {
  const { t: i18n, locale } = await getI18n();
  const m = i18n.automation.overview;
  const [tests, runs, projects] = await Promise.all([
    ctx.repo.listAutomationTests(projectId ? { projectId } : {}),
    ctx.repo.listAutomationRuns({ projectId, limit: 30 }),
    ctx.repo.listProjects(),
  ]);
  const cases = new Map(
    (await ctx.repo.listTestCases({ projectId, ids: tests.map((t) => t.testCaseId) })).map((c) => [c.id, c]),
  );
  const projectById = new Map(projects.map((p) => [p.id, p]));
  const drafts = tests.filter((t) => t.status === "draft");
  const approved = tests.filter((t) => t.status === "approved");
  const runResults = new Map(
    await Promise.all(runs.map(async (run) => [run.id, await ctx.repo.listAutomationResults({ automationRunId: run.id })] as const)),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-2 rounded-md border bg-subtle px-3 py-2 text-xs text-zinc-700">
        <Terminal className="mt-0.5 size-3.5 shrink-0" />
        <span>{m.runnerHelp[runnerMode]}</span>
      </div>

      <section>
        <SectionTitle>{fmt(m.draftsTitle, { count: drafts.length })}</SectionTitle>
        {drafts.length ? (
          <ul className="divide-y rounded-md border">
            {drafts.map((test) => {
              const testCase = cases.get(test.testCaseId);
              return (
                <li key={test.id} className="flex items-center gap-3 px-3 py-2 text-[13px]">
                  <Badge variant="warning">{i18n.enums.automationTestStatus.draft}</Badge>
                  <Link href={`/automation/tests/${test.id}`} className="font-medium hover:underline">
                    <span className="font-mono text-xs text-muted-foreground">{testCase?.caseKey}</span> {testCase?.title}
                  </Link>
                  <span className="ml-auto font-mono text-xs text-muted-foreground">{test.filePath}</span>
                  <span className="text-xs text-muted-foreground">{formatRelative(test.updatedAt, locale)}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="rounded-md border border-dashed p-4 text-center text-[13px] text-muted-foreground">
            {m.noDraftsBefore}<span className="font-medium">{m.noDraftsAction}</span>{m.noDraftsAfter}
          </p>
        )}
      </section>

      <section>
        <SectionTitle>{fmt(m.approvedTitle, { count: approved.length })}</SectionTitle>
        {approved.length ? (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">{m.colCase}</TableHead>
                  <TableHead>{m.colTitle}</TableHead>
                  {!projectId ? <TableHead>{m.colProject}</TableHead> : null}
                  <TableHead>{m.colSpecFile}</TableHead>
                  <TableHead>{m.colLastResult}</TableHead>
                  <TableHead>{m.colApproved}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {approved.map((test) => {
                  const testCase = cases.get(test.testCaseId);
                  return (
                    <TableRow key={test.id}>
                      <TableCell className="font-mono text-xs text-muted-foreground">{testCase?.caseKey}</TableCell>
                      <TableCell>
                        <Link href={`/automation/tests/${test.id}`} className="hover:underline">
                          {testCase?.title}
                        </Link>
                      </TableCell>
                      {!projectId ? <TableCell className="text-xs">{projectById.get(test.projectId)?.key}</TableCell> : null}
                      <TableCell className="font-mono text-xs">{test.filePath}</TableCell>
                      <TableCell>
                        <ResultBadge status={testCase?.lastResult} />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatRelative(test.approvedAt, locale)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="rounded-md border border-dashed p-4 text-center text-[13px] text-muted-foreground">{m.noApproved}</p>
        )}
      </section>

      <section>
        <SectionTitle>{m.runsTitle}</SectionTitle>
        {runs.length ? (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{m.colStatus}</TableHead>
                  <TableHead>{m.colRun}</TableHead>
                  {!projectId ? <TableHead>{m.colProject}</TableHead> : null}
                  <TableHead>{m.colTrigger}</TableHead>
                  <TableHead>{m.colRunner}</TableHead>
                  <TableHead>{m.colTarget}</TableHead>
                  <TableHead className="text-right">{m.colPassed}</TableHead>
                  <TableHead className="text-right">{m.colFailed}</TableHead>
                  <TableHead className="text-right">{m.colDuration}</TableHead>
                  <TableHead>{m.colCreated}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((run) => {
                  const results = runResults.get(run.id) ?? [];
                  return (
                    <TableRow key={run.id}>
                      <TableCell>
                        <AutomationRunStatusBadge status={run.status} />
                      </TableCell>
                      <TableCell>
                        <Link href={`/automation/runs/${run.id}`} className="font-mono text-xs hover:underline">
                          {run.id.slice(0, 8)}
                        </Link>
                        <span className="ml-2 text-xs text-muted-foreground">{fmt(m.specCount, { count: run.testCaseIds.length })}</span>
                      </TableCell>
                      {!projectId ? <TableCell className="text-xs">{projectById.get(run.projectId)?.key}</TableCell> : null}
                      <TableCell className="text-xs">{i18n.enums.automationTrigger[run.trigger]}</TableCell>
                      <TableCell className="text-xs capitalize">{i18n.automation.runnerName[run.runner]}</TableCell>
                      <TableCell className="max-w-56 truncate text-xs text-muted-foreground">{run.targetUrl}</TableCell>
                      <TableCell className="text-right tabular-nums text-passed">{results.filter((r) => r.status === "passed").length}</TableCell>
                      <TableCell className="text-right tabular-nums text-failed">{results.filter((r) => r.status === "failed").length}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs">
                        {run.startedAt && run.finishedAt
                          ? formatDuration(new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime())
                          : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatRelative(run.createdAt, locale)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1 rounded-md border border-dashed p-6 text-center text-[13px] text-muted-foreground">
            <Bot className="size-5" /> {m.noRuns}
          </div>
        )}
      </section>
    </div>
  );
}
