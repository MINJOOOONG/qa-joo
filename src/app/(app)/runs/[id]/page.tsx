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
import { fmt } from "@/lib/i18n/define";
import { formatRelative } from "@/lib/i18n/format";
import { getI18n } from "@/lib/i18n/server";

export default async function RunDetailPage({ params, searchParams }: PageProps<"/runs/[id]">) {
  const { id } = await params;
  const query = await searchParams;
  const ctx = await getServiceContext();
  const { t, locale } = await getI18n();
  const m = t.runs.detail;
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
            {t.runs.list.title}
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
              {run.status === "active" ? <Badge variant="info">{t.enums.testRunStatus.active}</Badge> : <Badge>{t.enums.testRunStatus.completed}</Badge>}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <EnvironmentBadge environment={run.environment} />
              <span>
                {m.build} <span className="font-mono text-foreground">{run.build ?? "—"}</span>
              </span>
              <span>{fmt(m.createdBy, { name: run.createdBy })}</span>
              <span>{fmt(m.updated, { time: formatRelative(run.updatedAt, locale) })}</span>
            </div>
            {run.description ? <p className="max-w-3xl text-[13px] text-zinc-700">{run.description}</p> : null}
          </div>
          <div className="flex items-center gap-2">
            <RunAutomationButton
              projectId={project.id}
              testRunId={run.id}
              testCaseIds={automatedIds}
              automatedCount={run.status === "active" ? automatedIds.length : 0}
              label={m.runAutomated}
            />
            <RunHeaderActions runId={run.id} status={run.status} untested={stats.untested} />
          </div>
        </div>
        <div className="mt-4 grid max-w-3xl grid-cols-[1fr_auto_auto] items-center gap-6">
          <div>
            <div className="mb-1 flex justify-between text-xs text-muted-foreground">
              <span>{m.progress}</span>
              <span className="tabular-nums" data-testid="run-progress">
                {stats.executed}/{stats.total} · {formatPercent(stats.progress, "0%")}
              </span>
            </div>
            <RunProgressBar stats={stats} height="h-2" />
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">{m.passRate}</div>
            <div className="text-xl font-semibold tabular-nums text-passed" data-testid="run-pass-rate">
              {formatPercent(stats.passRate)}
            </div>
          </div>
          {latestAutomation ? (
            <Link href={`/automation/runs/${latestAutomation.id}`} className="text-right text-xs hover:underline">
              <div className="text-muted-foreground">{m.lastAutomation}</div>
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
          {m.tipUse} <kbd className="rounded border px-1">P</kbd> <kbd className="rounded border px-1">F</kbd>{" "}
          <kbd className="rounded border px-1">B</kbd> <kbd className="rounded border px-1">S</kbd> {m.tipRecord} <kbd className="rounded border px-1">J</kbd>/
          <kbd className="rounded border px-1">K</kbd> {m.tipMove}
        </p>
      </div>
    </>
  );
}
