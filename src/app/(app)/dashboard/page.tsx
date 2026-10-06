import Link from "next/link";
import { Bot, CircleX, FolderKanban, Plus } from "lucide-react";
import { ActivityList } from "@/components/activity/activity-list";
import { AutomationRunStatusBadge, ResultBadge } from "@/components/common/badges";
import { EmptyState } from "@/components/common/empty-state";
import { Kpi, KpiStrip } from "@/components/common/kpi";
import { PageHeader, SectionTitle } from "@/components/common/page-header";
import { RunsTable } from "@/components/runs/runs-table";
import { Button } from "@/components/ui/button";
import { FAILURE_CATEGORY_LABELS } from "@/lib/domain/constants";
import { formatPercent } from "@/lib/domain/run-stats";
import { getPreferences } from "@/lib/preferences";
import { getServiceContext } from "@/lib/server-context";
import { getDashboard } from "@/lib/services/dashboard";
import { formatRelative } from "@/lib/utils";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const [ctx, preferences] = await Promise.all([getServiceContext(), getPreferences()]);
  const data = await getDashboard(ctx, preferences.projectId);
  const scope = preferences.projectId ? data.projects[0]?.name : "All projects";
  const projectKeys = new Map(data.projects.map((p) => [p.id, p.key]));

  if (data.projectCount === 0 && !preferences.projectId) {
    return (
      <>
        <PageHeader title="Dashboard" />
        <div className="p-6">
          <EmptyState
            icon={FolderKanban}
            title="Welcome to QA JOO"
            description="Create your first project: paste an application URL or a public GitHub repository and QA JOO drafts the first test cases for you to review."
            action={
              <Button asChild>
                <Link href="/projects/new">
                  <Plus /> New Project
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
      <PageHeader title="Dashboard" description={`Quality overview · ${scope ?? "All projects"}`} />
      <div className="space-y-6 p-6">
        <KpiStrip>
          <Kpi label="Projects" value={data.projectCount} />
          <Kpi label="Test Cases" value={data.caseCount} hint="approved" />
          <Kpi label="Active Runs" value={data.activeRunCount} />
          <Kpi label="Pass Rate" value={formatPercent(data.passRate)} tone="passed" hint="latest result per case" />
          <Kpi label="Failed" value={data.failedCount} tone={data.failedCount ? "failed" : "default"} hint="cases failing now" />
          <Kpi label="Automated Coverage" value={formatPercent(data.automationCoverage)} hint={`${data.automatedCount} automated`} />
        </KpiStrip>

        <section>
          <SectionTitle
            actions={
              <Link href="/runs" className="text-xs text-primary hover:underline">
                All runs
              </Link>
            }
          >
            Recent Test Runs
          </SectionTitle>
          {data.recentRuns.length ? (
            <RunsTable runs={data.recentRuns} />
          ) : (
            <p className="rounded-md border border-dashed p-6 text-center text-[13px] text-muted-foreground">
              No test runs yet. <Link href="/runs/new" className="text-primary hover:underline">Create one</Link>.
            </p>
          )}
        </section>

        <div className="grid gap-6 xl:grid-cols-3">
          <section className="xl:col-span-1">
            <SectionTitle>Recent Failures</SectionTitle>
            <div className="rounded-md border">
              {data.recentFailures.length === 0 ? (
                <p className="p-6 text-center text-[13px] text-muted-foreground">No failing cases. </p>
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
                        {result.failureCategory ? ` · ${FAILURE_CATEGORY_LABELS[result.failureCategory]}` : ""}
                        {result.mode === "automated" ? " · Automated" : ""} · {formatRelative(result.executedAt)}
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
                  Automation
                </Link>
              }
            >
              Automation Status
            </SectionTitle>
            <div className="rounded-md border">
              {data.automationRuns.length === 0 ? (
                <div className="flex flex-col items-center gap-1 p-6 text-center text-[13px] text-muted-foreground">
                  <Bot className="size-5" />
                  No automation runs yet.
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
                          {project?.key ?? ""} · {run.testCaseIds.length} spec(s)
                        </Link>
                        <span className="ml-auto text-xs tabular-nums">
                          <span className="text-passed">{passed}</span> / <span className="text-failed">{failed}</span>
                        </span>
                        <span className="w-14 text-right text-xs text-muted-foreground">{formatRelative(run.createdAt)}</span>
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
                  All activity
                </Link>
              }
            >
              Recent Activity
            </SectionTitle>
            <div className="rounded-md border px-3">
              <ActivityList activities={data.activities.slice(0, 10)} projectKeys={projectKeys} />
            </div>
          </section>
        </div>
        <p className="text-xs text-muted-foreground">
          Legend: <ResultBadge status="passed" /> <ResultBadge status="failed" /> <ResultBadge status="blocked" />{" "}
          <ResultBadge status="skipped" /> <ResultBadge status="untested" />
        </p>
      </div>
    </>
  );
}
