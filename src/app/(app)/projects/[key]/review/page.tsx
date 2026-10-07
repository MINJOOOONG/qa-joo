import { AnalyzePanel } from "@/components/review/analyze-panel";
import { getLlmProvider, describeProvider } from "@/lib/ai/provider";
import { loadProject } from "@/lib/loaders";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t.review.meta.title };
}

/** Runs site/GitHub analysis and test case generation; results go straight to the case list. */
export default async function CreateCasesPage({ params, searchParams }: PageProps<"/projects/[key]/review">) {
  const { key } = await params;
  const query = await searchParams;
  const { project } = await loadProject(key);
  const { t } = await getI18n();
  const r = t.review;
  const ai = describeProvider(getLlmProvider());
  const providerLabel = ai.model ? `${ai.provider} (${ai.model})` : r.analyze.heuristic;

  return (
    <div className="space-y-5 p-6">
      <AnalyzePanel
        projectId={project.id}
        casesHref={`/projects/${project.key}/cases`}
        autostart={query.autostart === "1"}
        initialMode={query.mode === "gaps" ? "gaps" : "analyze"}
        providerLabel={providerLabel}
        sources={[project.appUrl ? r.analyze.sourceApp : null, project.repoUrl ? r.analyze.sourceRepo : null].filter((s): s is string => Boolean(s))}
      />
    </div>
  );
}
