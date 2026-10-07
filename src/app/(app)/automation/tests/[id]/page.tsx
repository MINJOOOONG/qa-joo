import Link from "next/link";
import { notFound } from "next/navigation";
import { AiBadge, PriorityLabel, TypeBadge } from "@/components/common/badges";
import { CodeReview } from "@/components/automation/code-review";
import { RunAutomationButton } from "@/components/automation/run-automation-button";
import { Badge } from "@/components/ui/badge";
import { getServiceContext } from "@/lib/server-context";
import { fmt } from "@/lib/i18n/define";
import { formatDateTime } from "@/lib/i18n/format";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t.automation.test.metaTitle };
}

export default async function AutomationTestPage({ params }: PageProps<"/automation/tests/[id]">) {
  const { id } = await params;
  const ctx = await getServiceContext();
  const { t, locale } = await getI18n();
  const m = t.automation.test;
  const automation = await ctx.repo.getAutomationTest(id);
  if (!automation) notFound();
  const [testCase, project] = await Promise.all([ctx.repo.getTestCase(automation.testCaseId), ctx.repo.getProject(automation.projectId)]);
  if (!testCase || !project) notFound();
  const fromAi = automation.generatedBy && automation.generatedBy !== "heuristic" && automation.generatedBy !== "demo-seed";

  return (
    <>
      <div className="border-b px-6 py-4">
        <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
          <Link href="/automation" className="hover:underline">
            {t.automation.page.title}
          </Link>
          <span>/</span>
          <Link href={`/projects/${project.key}/automation`} className="hover:underline">
            {project.key}
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-semibold tracking-tight">{fmt(m.heading, { key: testCase.caseKey })}</h1>
          {automation.status === "approved" ? (
            <Badge variant="passed">{t.enums.automationTestStatus.approved}</Badge>
          ) : automation.status === "rejected" ? (
            <Badge variant="skipped">{t.enums.automationTestStatus.rejected}</Badge>
          ) : (
            <Badge variant="warning">{m.needsReview}</Badge>
          )}
          {fromAi ? <AiBadge /> : <Badge variant="outline">{m.ruleBased}</Badge>}
          <div className="ml-auto">
            <RunAutomationButton
              projectId={project.id}
              testCaseIds={[testCase.id]}
              automatedCount={automation.status === "approved" ? 1 : 0}
              label={m.run}
            />
          </div>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {fmt(m.generatedBy, { by: automation.generatedBy ?? "—", time: formatDateTime(automation.updatedAt, locale) })}
          {automation.approvedAt ? fmt(m.approvedAt, { time: formatDateTime(automation.approvedAt, locale) }) : ""}
          {automation.reviewNote ? ` · ${automation.reviewNote}` : ""}
        </p>
      </div>
      <div className="grid gap-6 p-6 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <aside className="space-y-4 text-[13px]">
          <div>
            <Link href={`/cases/${testCase.id}`} className="font-medium hover:underline">
              {testCase.title}
            </Link>
            <div className="mt-1 flex flex-wrap gap-1.5">
              <TypeBadge type={testCase.type} />
              <PriorityLabel priority={testCase.priority} />
            </div>
          </div>
          <section>
            <h3 className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{m.preconditions}</h3>
            <p>{testCase.preconditions || t.common.none}</p>
          </section>
          <section>
            <h3 className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{m.steps}</h3>
            <ol className="list-decimal space-y-1 pl-5">
              {testCase.steps.map((step, index) => (
                <li key={index}>{step}</li>
              ))}
            </ol>
          </section>
          <section>
            <h3 className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{m.expectedResult}</h3>
            <p>{testCase.expectedResult}</p>
          </section>
          <section>
            <h3 className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{m.target}</h3>
            <p className="break-all text-xs">{project.appUrl ?? m.noUrl}</p>
          </section>
        </aside>
        <CodeReview
          key={automation.updatedAt}
          automationTestId={automation.id}
          testCaseId={testCase.id}
          initialCode={automation.code}
          status={automation.status}
          filePath={automation.filePath}
        />
      </div>
    </>
  );
}
