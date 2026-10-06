import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { CancelRunButton } from "@/components/automation/cancel-run-button";
import { FailureAnalysisPanel } from "@/components/automation/failure-analysis";
import { RunPoller } from "@/components/automation/run-poller";
import { AutomationRunStatusBadge, EnvironmentBadge, ResultBadge } from "@/components/common/badges";
import { AUTOMATION_TRIGGER_LABELS } from "@/lib/domain/constants";
import { formatDuration } from "@/lib/domain/run-stats";
import { isAppError } from "@/lib/errors";
import { getServiceContext } from "@/lib/server-context";
import { getAutomationRunDetail } from "@/lib/services/automation";
import { cn, formatDateTime } from "@/lib/utils";

export const metadata = { title: "Automation Run" };

function isPublicHttps(url: string | null): url is string {
  return Boolean(url && url.startsWith("https://"));
}

export default async function AutomationRunPage({ params, searchParams }: PageProps<"/automation/runs/[id]">) {
  const { id } = await params;
  const query = await searchParams;
  const ctx = await getServiceContext();
  const detail = await getAutomationRunDetail(ctx, id).catch((error) => {
    if (isAppError(error) && error.code === "not_found") notFound();
    throw error;
  });
  const { run, project, testRun, rows, summary } = detail;
  const focused = typeof query.result === "string" ? query.result : null;
  const active = run.status === "queued" || run.status === "running";

  return (
    <>
      <RunPoller runId={run.id} status={run.status} resultCount={rows.filter((row) => row.result).length} />
      <div className="border-b px-6 py-4">
        <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
          <Link href="/automation" className="hover:underline">
            Automation
          </Link>
          <span>/</span>
          <Link href={`/projects/${project.key}/automation`} className="hover:underline">
            {project.key} · {project.name}
          </Link>
        </div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold tracking-tight">
                Automation run <span className="font-mono text-base text-muted-foreground">{run.id.slice(0, 8)}</span>
              </h1>
              <AutomationRunStatusBadge status={run.status} />
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <EnvironmentBadge environment={run.environment} />
              <span>Trigger: {AUTOMATION_TRIGGER_LABELS[run.trigger]}</span>
              <span className="capitalize">Runner: {run.runner}</span>
              <span>Target: {run.targetUrl}</span>
              {run.branch ? <span>Branch: {run.branch}</span> : null}
              {run.commitSha ? <span className="font-mono">{run.commitSha.slice(0, 7)}</span> : null}
              {testRun ? (
                <Link href={`/runs/${testRun.id}`} className="text-primary hover:underline">
                  Test run: {testRun.name}
                </Link>
              ) : null}
              {run.externalUrl ? (
                <a href={run.externalUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                  CI logs <ExternalLink className="size-3" />
                </a>
              ) : null}
            </div>
          </div>
          {active ? <CancelRunButton runId={run.id} /> : null}
        </div>
        <div className="mt-3 flex flex-wrap gap-6 text-[13px]">
          <span>
            <span className="text-muted-foreground">Specs</span> <span className="font-semibold tabular-nums">{summary.total}</span>
          </span>
          <span>
            <span className="text-muted-foreground">Passed</span> <span className="font-semibold tabular-nums text-passed">{summary.passed}</span>
          </span>
          <span>
            <span className="text-muted-foreground">Failed</span> <span className="font-semibold tabular-nums text-failed">{summary.failed}</span>
          </span>
          <span>
            <span className="text-muted-foreground">Pending</span> <span className="font-semibold tabular-nums">{summary.pending}</span>
          </span>
          <span>
            <span className="text-muted-foreground">Duration</span> <span className="font-semibold tabular-nums">{formatDuration(summary.durationMs)}</span>
          </span>
          <span className="text-muted-foreground">
            Started {formatDateTime(run.startedAt)} · Finished {formatDateTime(run.finishedAt)}
          </span>
        </div>
        {run.error ? <p className="mt-2 text-[13px] text-destructive">Runner error: {run.error}</p> : null}
        {run.status === "queued" && run.runner === "external" ? (
          <pre className="code-block mt-3 overflow-x-auto rounded bg-zinc-950 p-3 text-zinc-100">
            {`QA_JOO_URL=<this QA JOO URL> RUNNER_CALLBACK_SECRET=<secret> npm run qa:runner -- --run ${run.id}`}
          </pre>
        ) : null}
      </div>

      <div className="space-y-3 p-6">
        {rows.map(({ testCase, result, automationTest }) => (
          <section
            key={testCase.id}
            id={result?.id}
            className={cn("rounded-md border", result?.status === "failed" && "border-red-200", focused && focused === result?.id && "ring-2 ring-ring/40")}
            data-testid="automation-result"
            data-case-key={testCase.caseKey}
            data-status={result?.status ?? "pending"}
          >
            <div className="flex flex-wrap items-center gap-3 px-3 py-2 text-[13px]">
              <ResultBadge status={result?.status ?? "untested"} />
              <Link href={`/cases/${testCase.id}`} className="font-medium hover:underline">
                <span className="font-mono text-xs text-muted-foreground">{testCase.caseKey}</span> {testCase.title}
              </Link>
              {automationTest ? (
                <Link href={`/automation/tests/${automationTest.id}`} className="font-mono text-xs text-muted-foreground hover:underline">
                  {automationTest.filePath}
                </Link>
              ) : null}
              <span className="ml-auto tabular-nums text-xs text-muted-foreground">{result ? formatDuration(result.durationMs) : active ? "running…" : "—"}</span>
            </div>
            {result?.status === "failed" ? (
              <div className="space-y-3 border-t px-3 py-3">
                {result.errorMessage ? (
                  <pre className="code-block max-h-56 overflow-auto whitespace-pre-wrap rounded bg-zinc-950 p-3 text-zinc-100">{result.errorMessage}</pre>
                ) : null}
                <div className="flex flex-wrap items-start gap-4">
                  {result.screenshotUrl ? (
                    <a href={result.screenshotUrl} target="_blank" rel="noreferrer" className="block">
                      {/* eslint-disable-next-line @next/next/no-img-element -- runner artifact */}
                      <img src={result.screenshotUrl} alt={`Failure screenshot for ${testCase.caseKey}`} className="max-h-64 rounded border" data-testid="failure-screenshot" />
                    </a>
                  ) : null}
                  <div className="flex flex-col gap-1 text-xs">
                    {result.traceUrl ? (
                      <a href={result.traceUrl} className="text-primary hover:underline" data-testid="trace-link">
                        Download trace.zip
                      </a>
                    ) : null}
                    {isPublicHttps(result.traceUrl) ? (
                      <a href={`https://trace.playwright.dev/?trace=${encodeURIComponent(result.traceUrl)}`} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                        Open in Playwright Trace Viewer
                      </a>
                    ) : result.traceUrl ? (
                      <span className="text-muted-foreground">
                        View locally: <code className="font-mono">npx playwright show-trace trace.zip</code>
                      </span>
                    ) : null}
                    {result.logUrl ? (
                      <a href={result.logUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                        Runner log
                      </a>
                    ) : null}
                  </div>
                </div>
                <FailureAnalysisPanel resultId={result.id} analysis={result.analysis} />
              </div>
            ) : null}
          </section>
        ))}
      </div>
    </>
  );
}
