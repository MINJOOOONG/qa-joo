import Link from "next/link";
import { CheckCircle2, CircleAlert, ListPlus, PlayCircle, ScanSearch, Sparkles } from "lucide-react";
import { ActivityList } from "@/components/activity/activity-list";
import { RunAutomationButton } from "@/components/automation/run-automation-button";
import { Kpi, KpiStrip } from "@/components/common/kpi";
import { SectionTitle } from "@/components/common/page-header";
import { RunsTable } from "@/components/runs/runs-table";
import { Button } from "@/components/ui/button";
import { formatPercent } from "@/lib/domain/run-stats";
import { loadProject } from "@/lib/loaders";
import { getProjectOverview } from "@/lib/services/projects";
import { listRunSummaries } from "@/lib/services/runs";
import { formatRelative } from "@/lib/utils";

export default async function ProjectOverviewPage({ params }: PageProps<"/projects/[key]">) {
  const { key } = await params;
  const { ctx, project } = await loadProject(key);
  const [overview, runs, activities] = await Promise.all([
    getProjectOverview(ctx, project),
    listRunSummaries(ctx, { projectId: project.id }),
    ctx.repo.listActivities({ projectId: project.id, limit: 12 }),
  ]);
  const analysis = project.lastAnalysis;

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild>
          <Link href={`/projects/${project.key}/review?autostart=1`}>
            <ScanSearch /> Analyze Project
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href={`/projects/${project.key}/review?mode=gaps`}>
            <Sparkles /> Generate Test Cases
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href={`/runs/new?project=${project.id}`}>
            <ListPlus /> Create Test Run
          </Link>
        </Button>
        <RunAutomationButton projectId={project.id} automatedCount={overview.automatedCount} />
      </div>

      <KpiStrip>
        <Kpi label="Test Cases" value={overview.caseCount} hint={overview.draftCount ? `${overview.draftCount} AI drafts waiting` : "approved"} />
        <Kpi label="Automation Coverage" value={formatPercent(overview.automationCoverage)} hint={`${overview.automatedCount} automated`} />
        <Kpi label="Latest Pass Rate" value={formatPercent(overview.latestRun?.passRate ?? null)} tone="passed" hint={overview.latestRun?.name ?? "no runs yet"} />
        <Kpi label="Latest Progress" value={formatPercent(overview.latestRun?.progress ?? null)} />
        <Kpi label="Active Runs" value={overview.activeRuns} />
        <Kpi label="Last Run" value={<span className="text-base">{formatRelative(overview.latestRun?.updatedAt)}</span>} />
      </KpiStrip>

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <section>
            <SectionTitle
              actions={
                <Link href={`/projects/${project.key}/runs`} className="text-xs text-primary hover:underline">
                  All runs
                </Link>
              }
            >
              Test Runs
            </SectionTitle>
            {runs.length ? (
              <RunsTable runs={runs.slice(0, 5)} showProject={false} />
            ) : (
              <div className="rounded-md border border-dashed p-6 text-center text-[13px] text-muted-foreground">
                No runs yet.{" "}
                <Link href={`/runs/new?project=${project.id}`} className="text-primary hover:underline">
                  Create the first test run
                </Link>
              </div>
            )}
          </section>
          <section>
            <SectionTitle>Recent Activity</SectionTitle>
            <div className="rounded-md border px-3">
              <ActivityList activities={activities} />
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-md border">
            <div className="flex items-center justify-between border-b px-3 py-2">
              <h2 className="text-[13px] font-semibold">Connected sources</h2>
              <Link href={`/projects/${project.key}/settings`} className="text-xs text-primary hover:underline">
                Edit
              </Link>
            </div>
            <dl className="space-y-2 px-3 py-3 text-[13px]">
              <div>
                <dt className="text-xs text-muted-foreground">Application URL</dt>
                <dd className="truncate">{project.appUrl ?? "Not connected"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Repository URL</dt>
                <dd className="truncate">{project.repoUrl ?? "Not connected"}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-md border">
            <div className="flex items-center justify-between border-b px-3 py-2">
              <h2 className="text-[13px] font-semibold">Last analysis</h2>
              <span className="text-xs text-muted-foreground">{formatRelative(analysis?.analyzedAt)}</span>
            </div>
            {analysis ? (
              <div className="space-y-3 px-3 py-3 text-[13px]">
                <ul className="space-y-1.5">
                  {analysis.sources.map((source) => (
                    <li key={source.url} className="flex items-start gap-2">
                      {source.ok ? (
                        <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-passed" />
                      ) : (
                        <CircleAlert className="mt-0.5 size-3.5 shrink-0 text-blocked" />
                      )}
                      <span>
                        <span className="font-medium capitalize">{source.kind}</span>
                        <span className="block text-xs text-muted-foreground">{source.note}</span>
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="grid grid-cols-4 gap-2 text-center">
                  {(
                    [
                      ["Pages", analysis.signals.pages],
                      ["Forms", analysis.signals.forms],
                      ["Routes", analysis.signals.routes],
                      ["APIs", analysis.signals.apiEndpoints],
                    ] as const
                  ).map(([label, value]) => (
                    <div key={label} className="rounded bg-subtle py-1.5">
                      <div className="text-sm font-semibold tabular-nums">{value}</div>
                      <div className="text-[11px] text-muted-foreground">{label}</div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {analysis.generatedCount} draft case(s) by {analysis.provider}
                  {analysis.model ? ` (${analysis.model})` : ""}.
                </p>
                {analysis.warnings.length ? (
                  <ul className="list-disc space-y-0.5 pl-4 text-xs text-amber-800">
                    {analysis.warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : (
              <div className="space-y-2 px-3 py-4 text-[13px] text-muted-foreground">
                <p>This project has not been analyzed yet.</p>
                <Button size="sm" asChild>
                  <Link href={`/projects/${project.key}/review?autostart=1`}>
                    <PlayCircle /> Analyze now
                  </Link>
                </Button>
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
