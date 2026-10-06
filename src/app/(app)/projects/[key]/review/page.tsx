import Link from "next/link";
import { CheckCircle2, ListPlus } from "lucide-react";
import { AiBadge } from "@/components/common/badges";
import { AnalyzePanel } from "@/components/review/analyze-panel";
import { DraftReviewTable } from "@/components/review/draft-review-table";
import { Button } from "@/components/ui/button";
import { getLlmProvider, describeProvider } from "@/lib/ai/provider";
import { sectionPaths } from "@/lib/domain/sections";
import { loadProject } from "@/lib/loaders";

export const metadata = { title: "AI Review" };

export default async function ReviewPage({ params, searchParams }: PageProps<"/projects/[key]/review">) {
  const { key } = await params;
  const query = await searchParams;
  const { ctx, project } = await loadProject(key);
  const [drafts, approved, sections] = await Promise.all([
    ctx.repo.listTestCases({ projectId: project.id, reviewStatuses: ["draft"] }),
    ctx.repo.listTestCases({ projectId: project.id, reviewStatuses: ["approved"] }),
    ctx.repo.listSections(project.id),
  ]);
  const paths = sectionPaths(sections);
  const ai = describeProvider(getLlmProvider());
  const providerLabel = ai.model ? `${ai.provider} (${ai.model})` : "rule-based heuristic (no AI key configured)";

  return (
    <div className="space-y-5 p-6">
      <AnalyzePanel
        projectId={project.id}
        autostart={query.autostart === "1"}
        initialMode={query.mode === "gaps" ? "gaps" : "analyze"}
        providerLabel={providerLabel}
        sources={[project.appUrl ? "Application" : null, project.repoUrl ? "GitHub repository" : null].filter((s): s is string => Boolean(s))}
      />

      {drafts.length ? (
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <h2 className="text-[13px] font-semibold">Drafts waiting for review</h2>
            <AiBadge label="AI DRAFT" />
          </div>
          <p className="text-xs text-muted-foreground">
            Approve the cases you want in the suite, edit anything that is off, and reject the rest. Only approved cases can be added to test runs.
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
            No drafts waiting. {approved.length} approved case(s) in the suite.
          </div>
          {approved.length ? (
            <Button asChild data-testid="create-run-cta">
              <Link href={`/runs/new?project=${project.id}`}>
                <ListPlus /> Create Test Run
              </Link>
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}
