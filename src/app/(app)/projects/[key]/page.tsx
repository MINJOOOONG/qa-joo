import Link from "next/link";
import { Bot, CheckCircle2, CircleAlert, ListPlus, ScanSearch, Sparkles } from "lucide-react";
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
import type { Dictionary } from "@/lib/i18n/dictionary";

/** Source notes are stored in English by the analyzer; translate the known shapes for display. */
function localizeSourceNote(note: string, l: Dictionary["projects"]["overview"]["sourceNote"]): string {
  let m = /^(\d+) page\(s\) analyzed \((\w+)\)$/.exec(note);
  if (m) return fmt(l.pages, { count: m[1], mode: m[2] });
  m = /^(.+), (\d+) route\(s\), (\d+) API endpoint\(s\)$/.exec(note);
  if (m) return fmt(l.repo, { stack: m[1] === "Unknown stack" ? l.unknownStack : m[1], routes: m[2], apis: m[3] });
  if (note === "Failed") return l.failed;
  return note;
}

export default async function ProjectOverviewPage({ params }: PageProps<"/projects/[key]">) {
  const { key } = await params;
  const { ctx, project } = await loadProject(key);
  const [overview, runs] = await Promise.all([
    getProjectOverview(ctx, project),
    listRunSummaries(ctx, { projectId: project.id }),
  ]);
  const analysis = project.lastAnalysis;
  // The demo seed stores only a site summary; the analysis card needs a real crawl.
  const crawled = analysis && analysis.sources.length > 0 ? analysis : null;
  const { t, locale } = await getI18n();
  const l = t.projects.overview;

  return (
    <div className="min-w-0 space-y-6 p-4 sm:p-6">
      <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label={l.steps.title}>
        {[
          { icon: ScanSearch, title: l.analyzeProject, text: l.steps.s1, href: `/projects/${project.key}/review?autostart=1`, primary: true },
          { icon: Sparkles, title: l.generateCases, text: l.steps.s2, href: `/projects/${project.key}/review?mode=gaps` },
          { icon: ListPlus, title: l.createRun, text: l.steps.s3, href: `/runs/new?project=${project.id}` },
          {
            icon: Bot,
            title: l.runAutomation,
            text: overview.automatedCount > 0 ? `${fmt(l.steps.s4Approved, { count: overview.automatedCount })} · ${l.steps.s4}` : l.steps.s4None,
            href: `/projects/${project.key}/automation`,
          },
        ].map(({ icon: Icon, title, text, href, primary }, index) => (
          <li key={href} className="min-w-0">
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
      </ol>

      <KpiStrip columns={4}>
        <Kpi label={l.kpiCases} value={overview.caseCount} />
        <Kpi label={l.kpiCoverage} value={formatPercent(overview.automationCoverage)} hint={fmt(l.automatedCount, { count: overview.automatedCount })} />
        <Kpi label={l.kpiPassRate} value={formatPercent(overview.latestRun?.passRate ?? null)} tone="passed" hint={overview.latestRun?.name ?? l.noRunsYet} />
        <Kpi label={l.kpiActiveRuns} value={overview.activeRuns} />
      </KpiStrip>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-6">
          <section className="rounded-lg border bg-card p-4" data-testid="site-summary">
            <h2 className="mb-1.5 text-sm font-semibold">{l.siteSummaryTitle}</h2>
            {analysis?.siteSummary ? (
              <p className="break-words text-[13px] leading-relaxed text-zinc-700">{analysis.siteSummary}</p>
            ) : (
              <p className="text-[13px] text-muted-foreground">{l.siteSummaryEmpty}</p>
            )}
          </section>
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
        </div>

        <aside className="min-w-0 space-y-4">
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
              <span className="text-xs text-muted-foreground">{formatRelative(crawled?.analyzedAt, locale)}</span>
            </div>
            {crawled ? (
              <div className="space-y-3 px-3 py-3 text-[13px]">
                <ul className="space-y-1.5">
                  {crawled.sources.map((source) => (
                    <li key={source.url} className="flex min-w-0 items-start gap-2">
                      {source.ok ? (
                        <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-passed" />
                      ) : (
                        <CircleAlert className="mt-0.5 size-3.5 shrink-0 text-blocked" />
                      )}
                      <span className="min-w-0">
                        <span className="font-medium">{l.sourceKind[source.kind] ?? source.kind}</span>
                        <span className="block break-words text-xs text-muted-foreground">{localizeSourceNote(source.note, l.sourceNote)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="grid grid-cols-4 gap-2 text-center">
                  {(
                    [
                      [l.signals.pages, crawled.signals.pages],
                      [l.signals.forms, crawled.signals.forms],
                      [l.signals.routes, crawled.signals.routes],
                      [l.signals.apis, crawled.signals.apiEndpoints],
                    ] as const
                  ).map(([label, value]) => (
                    <div key={label} className="rounded bg-subtle py-1.5">
                      <div className="text-sm font-semibold tabular-nums">{value}</div>
                      <div className="text-[11px] text-muted-foreground">{label}</div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {fmt(l.generatedBy, { count: crawled.generatedCount, provider: t.shell.aiProvider[crawled.provider as "heuristic"] ?? crawled.provider })}
                  {crawled.model ? ` (${crawled.model})` : ""}.
                </p>
                {crawled.warnings.length ? (
                  <ul className="list-disc space-y-0.5 pl-4 text-xs text-amber-800">
                    {crawled.warnings.map((warning) => (
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
