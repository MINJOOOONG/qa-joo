import Link from "next/link";
import { CheckCircle2, CircleAlert, ListPlus, ScanSearch, Sparkles } from "lucide-react";
import { ActivityList } from "@/components/activity/activity-list";
import { RunAutomationButton } from "@/components/automation/run-automation-button";
import { Kpi, KpiStrip } from "@/components/common/kpi";
import { SectionTitle } from "@/components/common/page-header";
import { RunsTable } from "@/components/runs/runs-table";
import { formatPercent } from "@/lib/domain/run-stats";
import { loadProject } from "@/lib/loaders";
import { getProjectOverview } from "@/lib/services/projects";
import { listRunSummaries } from "@/lib/services/runs";
import { fmt } from "@/lib/i18n/define";
import { formatRelative } from "@/lib/i18n/format";
import { getI18n } from "@/lib/i18n/server";

export default async function ProjectOverviewPage({ params }: PageProps<"/projects/[key]">) {
  const { key } = await params;
  const { ctx, project } = await loadProject(key);
  const [overview, runs, activities] = await Promise.all([
    getProjectOverview(ctx, project),
    listRunSummaries(ctx, { projectId: project.id }),
    ctx.repo.listActivities({ projectId: project.id, limit: 6 }),
  ]);
  const analysis = project.lastAnalysis;
  const { t, locale } = await getI18n();
  const l = t.projects.overview;

  return (
    <div className="space-y-6 p-6">
      <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label={l.steps.title}>
        {[
          { icon: ScanSearch, title: l.analyzeProject, text: l.steps.s1, href: `/projects/${project.key}/review?autostart=1`, primary: true },
          { icon: Sparkles, title: l.generateCases, text: l.steps.s2, href: `/projects/${project.key}/review?mode=gaps` },
          { icon: ListPlus, title: l.createRun, text: l.steps.s3, href: `/runs/new?project=${project.id}` },
        ].map(({ icon: Icon, title, text, href, primary }, index) => (
          <li key={href}>
            <Link
              href={href}
              className={`flex h-full items-center gap-3 rounded-lg border p-3 transition hover:border-primary hover:shadow-sm ${primary ? "border-primary/40 bg-primary/5" : "bg-card"}`}
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">{index + 1}</span>
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  <Icon className="size-4 text-primary" /> {title}
                </span>
                <span className="block truncate text-xs text-muted-foreground">{text}</span>
              </span>
            </Link>
          </li>
        ))}
        <li className="flex items-center gap-3 rounded-lg border bg-card p-3">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">4</span>
          <span className="min-w-0 flex-1">
            <RunAutomationButton projectId={project.id} automatedCount={overview.automatedCount} label={l.runAutomation} size="sm" />
            <span className="mt-1 block truncate text-xs text-muted-foreground">{l.steps.s4}</span>
          </span>
        </li>
      </ol>

      <KpiStrip columns={4}>
        <Kpi label={l.kpiCases} value={overview.caseCount} hint={overview.draftCount ? fmt(l.draftsWaiting, { count: overview.draftCount }) : l.approved} />
        <Kpi label={l.kpiCoverage} value={formatPercent(overview.automationCoverage)} hint={fmt(l.automatedCount, { count: overview.automatedCount })} />
        <Kpi label={l.kpiPassRate} value={formatPercent(overview.latestRun?.passRate ?? null)} tone="passed" hint={overview.latestRun?.name ?? l.noRunsYet} />
        <Kpi label={l.kpiActiveRuns} value={overview.activeRuns} />
      </KpiStrip>

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <section>
            <SectionTitle
              actions={
                <Link href={`/projects/${project.key}/runs`} className="text-xs text-primary hover:underline">
                  {l.allRuns}
                </Link>
              }
            >
              {l.testRuns}
            </SectionTitle>
            {runs.length ? (
              <RunsTable runs={runs.slice(0, 5)} showProject={false} />
            ) : (
              <div className="rounded-md border border-dashed p-6 text-center text-[13px] text-muted-foreground">
                {l.noRuns}{" "}
                <Link href={`/runs/new?project=${project.id}`} className="text-primary hover:underline">
                  {l.createFirstRun}
                </Link>
              </div>
            )}
          </section>
          <section>
            <SectionTitle>{l.recentActivity}</SectionTitle>
            <div className="rounded-md border px-3">
              <ActivityList activities={activities} />
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-md border">
            <div className="flex items-center justify-between border-b px-3 py-2">
              <h2 className="text-[13px] font-semibold">{l.connectedSources}</h2>
              <Link href={`/projects/${project.key}/settings`} className="text-xs text-primary hover:underline">
                {l.edit}
              </Link>
            </div>
            <dl className="space-y-2 px-3 py-3 text-[13px]">
              <div>
                <dt className="text-xs text-muted-foreground">{l.appUrl}</dt>
                <dd className="truncate">{project.appUrl ?? l.notConnected}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{l.repoUrl}</dt>
                <dd className="truncate">{project.repoUrl ?? l.notConnected}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-md border">
            <div className="flex items-center justify-between border-b px-3 py-2">
              <h2 className="text-[13px] font-semibold">{l.lastAnalysis}</h2>
              <span className="text-xs text-muted-foreground">{formatRelative(analysis?.analyzedAt, locale)}</span>
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
                      [l.signals.pages, analysis.signals.pages],
                      [l.signals.forms, analysis.signals.forms],
                      [l.signals.routes, analysis.signals.routes],
                      [l.signals.apis, analysis.signals.apiEndpoints],
                    ] as const
                  ).map(([label, value]) => (
                    <div key={label} className="rounded bg-subtle py-1.5">
                      <div className="text-sm font-semibold tabular-nums">{value}</div>
                      <div className="text-[11px] text-muted-foreground">{label}</div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {fmt(l.generatedBy, { count: analysis.generatedCount, provider: analysis.provider })}
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
                <p>{l.notAnalyzed}</p>
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
