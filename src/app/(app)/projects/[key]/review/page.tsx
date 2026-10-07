import Link from "next/link";
import { CheckCircle2, ListPlus } from "lucide-react";
import { AiBadge } from "@/components/common/badges";
import { AnalyzePanel } from "@/components/review/analyze-panel";
import { DraftReviewTable } from "@/components/review/draft-review-table";
import { Button } from "@/components/ui/button";
import { getLlmProvider, describeProvider } from "@/lib/ai/provider";
import { sectionPaths } from "@/lib/domain/sections";
import { loadProject } from "@/lib/loaders";
import { fmt } from "@/lib/i18n/define";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t.review.meta.title };
}

export default async function ReviewPage({ params, searchParams }: PageProps<"/projects/[key]/review">) {
  const { key } = await params;
  const query = await searchParams;
  const { ctx, project } = await loadProject(key);
  const { t } = await getI18n();
  const r = t.review;
  const [drafts, approved, sections] = await Promise.all([
    ctx.repo.listTestCases({ projectId: project.id, reviewStatuses: ["draft"] }),
    ctx.repo.listTestCases({ projectId: project.id, reviewStatuses: ["approved"] }),
    ctx.repo.listSections(project.id),
  ]);
  const paths = sectionPaths(sections);
  const ai = describeProvider(getLlmProvider());
  const providerLabel = ai.model ? `${ai.provider} (${ai.model})` : r.analyze.heuristic;

  return (
    <div className="space-y-5 p-6">
      <AnalyzePanel
        projectId={project.id}
        autostart={query.autostart === "1"}
        initialMode={query.mode === "gaps" ? "gaps" : "analyze"}
        providerLabel={providerLabel}
        sources={[project.appUrl ? r.analyze.sourceApp : null, project.repoUrl ? r.analyze.sourceRepo : null].filter((s): s is string => Boolean(s))}
      />

      {drafts.length ? (
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <h2 className="text-[13px] font-semibold">{r.page.waiting}</h2>
            <AiBadge label={r.page.aiDraft} />
          </div>
          <p className="text-xs text-muted-foreground">
            {r.page.hint}
          </p>
          <DraftReviewTable
            projectId={project.id}
            projectKey={project.key}
            drafts={drafts.map((draft) => ({
              id: draft.id,
              caseKey: draft.caseKey,
              title: draft.title,
              sectionPath: draft.sectionId ? (paths.get(draft.sectionId) ?? null) : null,
              type: draft.type,
              priority: draft.priority,
              preconditions: draft.preconditions,
              steps: draft.steps,
              expectedResult: draft.expectedResult,
              rationale: draft.aiRationale,
            }))}
          />
        </section>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border px-4 py-3">
          <div className="flex items-center gap-2 text-[13px]">
            <CheckCircle2 className="size-4 text-passed" />
            {fmt(r.page.noDrafts, { count: approved.length })}
          </div>
          {approved.length ? (
            <Button asChild data-testid="create-run-cta">
              <Link href={`/runs/new?project=${project.id}`}>
                <ListPlus /> {r.page.createRun}
              </Link>
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}
