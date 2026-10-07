import Link from "next/link";
import { Bot, CircleX, FolderKanban, Plus } from "lucide-react";
import { ActivityList } from "@/components/activity/activity-list";
import { AutomationRunStatusBadge, ResultBadge } from "@/components/common/badges";
import { EmptyState } from "@/components/common/empty-state";
import { Kpi, KpiStrip } from "@/components/common/kpi";
import { PageHeader, SectionTitle } from "@/components/common/page-header";
import { RunsTable } from "@/components/runs/runs-table";
import { Button } from "@/components/ui/button";
import { formatPercent } from "@/lib/domain/run-stats";
import { getPreferences, scopePreferences } from "@/lib/preferences";
import { getServiceContext } from "@/lib/server-context";
import { getDashboard } from "@/lib/services/dashboard";
import { fmt } from "@/lib/i18n/define";
import { formatRelative } from "@/lib/i18n/format";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t.dashboard.title };
}

export default async function DashboardPage() {
  const [ctx, storedPreferences, { t, locale }] = await Promise.all([getServiceContext(), getPreferences(), getI18n()]);
  const l = t.dashboard;
  const preferences = await scopePreferences(ctx.repo, storedPreferences);
  const data = await getDashboard(ctx, preferences.projectId);
  const scope = preferences.projectId ? data.projects[0]?.name : l.allProjects;
  const projectKeys = new Map(data.projects.map((p) => [p.id, p.key]));

  if (data.projectCount === 0 && !preferences.projectId) {
    return (
      <>
        <PageHeader title={l.title} />
        <div className="p-6">
          <EmptyState
            icon={FolderKanban}
            title={l.welcomeTitle}
            description={l.welcomeDescription}
            action={
              <Button asChild>
                <Link href="/projects/new">
                  <Plus /> {l.newProject}
                </Link>
              </Button>
            }
          />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title={l.title} description={fmt(l.overview, { scope: scope ?? l.allProjects })} />
      <div className="space-y-6 p-6">
        <KpiStrip>
          <Kpi label={l.kpi.projects} value={data.projectCount} />
          <Kpi label={l.kpi.cases} value={data.caseCount} hint={l.kpi.approved} />
          <Kpi label={l.kpi.activeRuns} value={data.activeRunCount} />
          <Kpi label={l.kpi.passRate} value={formatPercent(data.passRate)} tone="passed" hint={l.kpi.passRateHint} />
          <Kpi label={l.kpi.failed} value={data.failedCount} tone={data.failedCount ? "failed" : "default"} hint={l.kpi.failedHint} />
          <Kpi label={l.kpi.coverage} value={formatPercent(data.automationCoverage)} hint={fmt(l.kpi.automatedCount, { count: data.automatedCount })} />
        </KpiStrip>

        <section>
          <SectionTitle
            actions={
              <Link href="/runs" className="text-xs text-primary hover:underline">
                {l.allRuns}
              </Link>
            }
          >
            {l.recentRuns}
          </SectionTitle>
          {data.recentRuns.length ? (
            <RunsTable runs={data.recentRuns} />
          ) : (
            <p className="rounded-md border border-dashed p-6 text-center text-[13px] text-muted-foreground">
              {l.noRuns} <Link href="/runs/new" className="text-primary hover:underline">{l.createOne}</Link>.
            </p>
          )}
        </section>

        <div className="grid gap-6 xl:grid-cols-3">
          <section className="xl:col-span-1">
            <SectionTitle>{l.recentFailures}</SectionTitle>
            <div className="rounded-md border">
              {data.recentFailures.length === 0 ? (
                <p className="p-6 text-center text-[13px] text-muted-foreground">{l.noFailures}</p>
              ) : (
                <ul className="divide-y">
                  {data.recentFailures.map(({ testCase, run, result }) => (
                    <li key={testCase.id} className="space-y-0.5 px-3 py-2 text-[13px]">
                      <div className="flex items-center gap-2">
                        <CircleX className="size-3.5 shrink-0 text-failed" />
                        <Link href={`/cases/${testCase.id}`} className="truncate font-medium hover:underline">
                          <span className="font-mono text-xs text-muted-foreground">{testCase.caseKey}</span> {testCase.title}
                        </Link>
                      </div>
                      <div className="pl-5 text-xs text-muted-foreground">
                        {run ? (
                          <Link href={`/runs/${run.id}`} className="hover:underline">
                            {run.name}
                          </Link>
                        ) : null}
                        {result.failureCategory ? ` · ${t.enums.failureCategory[result.failureCategory]}` : ""}
                        {result.mode === "automated" ? ` · ${l.automated}` : ""} · {formatRelative(result.executedAt, locale)}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section>
            <SectionTitle
              actions={
                <Link href="/automation" className="text-xs text-primary hover:underline">
                  {l.automation}
                </Link>
              }
            >
              {l.automationStatus}
            </SectionTitle>
            <div className="rounded-md border">
              {data.automationRuns.length === 0 ? (
                <div className="flex flex-col items-center gap-1 p-6 text-center text-[13px] text-muted-foreground">
                  <Bot className="size-5" />
                  {l.noAutomationRuns}
                </div>
              ) : (
                <ul className="divide-y">
                  {data.automationRuns.map(({ run, project, results }) => {
                    const failed = results.filter((r) => r.status === "failed").length;
                    const passed = results.filter((r) => r.status === "passed").length;
                    return (
                      <li key={run.id} className="flex items-center gap-2 px-3 py-2 text-[13px]">
                        <AutomationRunStatusBadge status={run.status} />
                        <Link href={`/automation/runs/${run.id}`} className="truncate hover:underline">
                          {project?.key ?? ""} · {fmt(l.specs, { count: run.testCaseIds.length })}
                        </Link>
                        <span className="ml-auto text-xs tabular-nums">
                          <span className="text-passed">{passed}</span> / <span className="text-failed">{failed}</span>
                        </span>
                        <span className="w-14 text-right text-xs text-muted-foreground">{formatRelative(run.createdAt, locale)}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>

          <section>
            <SectionTitle
              actions={
                <Link href="/activity" className="text-xs text-primary hover:underline">
                  {l.allActivity}
                </Link>
              }
            >
              {l.recentActivity}
            </SectionTitle>
            <div className="rounded-md border px-3">
              <ActivityList activities={data.activities.slice(0, 10)} projectKeys={projectKeys} />
            </div>
          </section>
        </div>
        <p className="text-xs text-muted-foreground">
          {l.legend} <ResultBadge status="passed" /> <ResultBadge status="failed" /> <ResultBadge status="blocked" />{" "}
          <ResultBadge status="skipped" /> <ResultBadge status="untested" />
        </p>
      </div>
    </>
  );
}
