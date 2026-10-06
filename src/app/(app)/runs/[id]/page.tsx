import Link from "next/link";
import { notFound } from "next/navigation";
import { RunAutomationButton } from "@/components/automation/run-automation-button";
import { AutomationRunStatusBadge, EnvironmentBadge } from "@/components/common/badges";
import { RunProgressBar } from "@/components/common/run-progress";
import { RunExecution } from "@/components/runs/run-execution";
import { RunHeaderActions } from "@/components/runs/run-header-actions";
import { Badge } from "@/components/ui/badge";
import { isAppError } from "@/lib/errors";
import { formatPercent } from "@/lib/domain/run-stats";
import { getServiceContext } from "@/lib/server-context";
import { getRunDetail } from "@/lib/services/runs";
import { formatRelative } from "@/lib/utils";

export default async function RunDetailPage({ params, searchParams }: PageProps<"/runs/[id]">) {
  const { id } = await params;
  const query = await searchParams;
  const ctx = await getServiceContext();
  const detail = await getRunDetail(ctx, id).catch((error) => {
    if (isAppError(error) && error.code === "not_found") notFound();
    throw error;
  });
  const { run, project, rows, stats, automationRuns } = detail;
  const automatedIds = rows.filter((row) => row.mode === "automated").map((row) => row.testCase.id);
  const latestAutomation = automationRuns[0];

  return (
    <>
      <div className="border-b px-6 py-4">
        <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
          <Link href="/runs" className="hover:underline">
            Test Runs
          </Link>
          <span>/</span>
          <Link href={`/projects/${project.key}`} className="hover:underline">
            {project.key} · {project.name}
          </Link>
        </div>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-lg font-semibold tracking-tight" data-testid="run-name">
                {run.name}
              </h1>
              {run.status === "active" ? <Badge variant="info">Active</Badge> : <Badge>Completed</Badge>}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <EnvironmentBadge environment={run.environment} />
              <span>
                Build <span className="font-mono text-foreground">{run.build ?? "—"}</span>
              </span>
              <span>Created by {run.createdBy}</span>
              <span>Updated {formatRelative(run.updatedAt)}</span>
            </div>
            {run.description ? <p className="max-w-3xl text-[13px] text-zinc-700">{run.description}</p> : null}
          </div>
          <div className="flex items-center gap-2">
            <RunAutomationButton
              projectId={project.id}
              testRunId={run.id}
              testCaseIds={automatedIds}
              automatedCount={run.status === "active" ? automatedIds.length : 0}
              label="Run Automated Tests"
            />
            <RunHeaderActions runId={run.id} status={run.status} untested={stats.untested} />
          </div>
        </div>
        <div className="mt-4 grid max-w-3xl grid-cols-[1fr_auto_auto] items-center gap-6">
          <div>
            <div className="mb-1 flex justify-between text-xs text-muted-foreground">
              <span>Progress</span>
              <span className="tabular-nums" data-testid="run-progress">
                {stats.executed}/{stats.total} · {formatPercent(stats.progress, "0%")}
              </span>
            </div>
            <RunProgressBar stats={stats} height="h-2" />
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Pass Rate</div>
            <div className="text-xl font-semibold tabular-nums text-passed" data-testid="run-pass-rate">
              {formatPercent(stats.passRate)}
            </div>
          </div>
          {latestAutomation ? (
            <Link href={`/automation/runs/${latestAutomation.id}`} className="text-right text-xs hover:underline">
              <div className="text-muted-foreground">Last automation</div>
              <AutomationRunStatusBadge status={latestAutomation.status} />
            </Link>
          ) : null}
        </div>
      </div>
      <div className="p-6">
        <RunExecution
          runId={run.id}
          locked={run.status === "completed"}
          rows={rows}
          initialCaseId={typeof query.case === "string" ? query.case : null}
        />
        <p className="mt-3 text-xs text-muted-foreground">
          Tip: open a case and use <kbd className="rounded border px-1">P</kbd> <kbd className="rounded border px-1">F</kbd>{" "}
          <kbd className="rounded border px-1">B</kbd> <kbd className="rounded border px-1">S</kbd> to record, <kbd className="rounded border px-1">J</kbd>/
          <kbd className="rounded border px-1">K</kbd> to move. Passing a case jumps to the next untested one.
        </p>
      </div>
    </>
  );
}
