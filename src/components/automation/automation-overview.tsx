import Link from "next/link";
import { Bot, Terminal } from "lucide-react";
import { AutomationRunStatusBadge } from "@/components/common/badges";
import { SectionTitle } from "@/components/common/page-header";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AUTOMATION_TRIGGER_LABELS } from "@/lib/domain/constants";
import { formatDuration } from "@/lib/domain/run-stats";
import type { RunnerMode } from "@/lib/env";
import type { ServiceContext } from "@/lib/services/context";
import { formatRelative } from "@/lib/utils";

const RUNNER_HELP: Record<RunnerMode, string> = {
  local: "Local runner: QA JOO starts Playwright on this machine when you click Run.",
  github: "GitHub runner: runs are dispatched to the qa-automation workflow and report back via signed callbacks.",
  external: "External runner: start it yourself with `npm run qa:runner -- --run <id>` (or let a scheduler do it).",
};

export async function AutomationOverview({ ctx, projectId, runnerMode }: { ctx: ServiceContext; projectId?: string; runnerMode: RunnerMode }) {
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
        <span>{RUNNER_HELP[runnerMode]}</span>
      </div>

      <section>
        <SectionTitle>Drafts awaiting review ({drafts.length})</SectionTitle>
        {drafts.length ? (
          <ul className="divide-y rounded-md border">
            {drafts.map((test) => {
              const testCase = cases.get(test.testCaseId);
              return (
                <li key={test.id} className="flex items-center gap-3 px-3 py-2 text-[13px]">
                  <Badge variant="warning">Draft</Badge>
                  <Link href={`/automation/tests/${test.id}`} className="font-medium hover:underline">
                    <span className="font-mono text-xs text-muted-foreground">{testCase?.caseKey}</span> {testCase?.title}
                  </Link>
                  <span className="ml-auto font-mono text-xs text-muted-foreground">{test.filePath}</span>
                  <span className="text-xs text-muted-foreground">{formatRelative(test.updatedAt)}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="rounded-md border border-dashed p-4 text-center text-[13px] text-muted-foreground">
            No drafts. Open an approved test case and click <span className="font-medium">Generate Automation</span>.
          </p>
        )}
      </section>

      <section>
        <SectionTitle>Approved Playwright specs ({approved.length})</SectionTitle>
        {approved.length ? (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Case</TableHead>
                  <TableHead>Title</TableHead>
                  {!projectId ? <TableHead>Project</TableHead> : null}
                  <TableHead>Spec file</TableHead>
                  <TableHead>Last result</TableHead>
                  <TableHead>Approved</TableHead>
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
                      <TableCell className="text-xs">{testCase?.lastResult ?? "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatRelative(test.approvedAt)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="rounded-md border border-dashed p-4 text-center text-[13px] text-muted-foreground">No approved specs yet.</p>
        )}
      </section>

      <section>
        <SectionTitle>Automation runs</SectionTitle>
        {runs.length ? (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Run</TableHead>
                  {!projectId ? <TableHead>Project</TableHead> : null}
                  <TableHead>Trigger</TableHead>
                  <TableHead>Runner</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead className="text-right">Passed</TableHead>
                  <TableHead className="text-right">Failed</TableHead>
                  <TableHead className="text-right">Duration</TableHead>
                  <TableHead>Created</TableHead>
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
                        <span className="ml-2 text-xs text-muted-foreground">{run.testCaseIds.length} spec(s)</span>
                      </TableCell>
                      {!projectId ? <TableCell className="text-xs">{projectById.get(run.projectId)?.key}</TableCell> : null}
                      <TableCell className="text-xs">{AUTOMATION_TRIGGER_LABELS[run.trigger]}</TableCell>
                      <TableCell className="text-xs capitalize">{run.runner}</TableCell>
                      <TableCell className="max-w-56 truncate text-xs text-muted-foreground">{run.targetUrl}</TableCell>
                      <TableCell className="text-right tabular-nums text-passed">{results.filter((r) => r.status === "passed").length}</TableCell>
                      <TableCell className="text-right tabular-nums text-failed">{results.filter((r) => r.status === "failed").length}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs">
                        {run.startedAt && run.finishedAt
                          ? formatDuration(new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime())
                          : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatRelative(run.createdAt)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1 rounded-md border border-dashed p-6 text-center text-[13px] text-muted-foreground">
            <Bot className="size-5" /> No automation runs yet. Use “Run Automated Tests” on a test run or “Run Automation” on a project.
          </div>
        )}
      </section>
    </div>
  );
}
