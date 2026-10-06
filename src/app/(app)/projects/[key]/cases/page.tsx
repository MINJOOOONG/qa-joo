import { CaseExplorer } from "@/components/cases/case-explorer";
import { loadProject } from "@/lib/loaders";

export default async function ProjectCasesPage({ params, searchParams }: PageProps<"/projects/[key]/cases">) {
  const { key } = await params;
  const { ctx, project } = await loadProject(key);
  return (
    <div className="p-6">
      <CaseExplorer ctx={ctx} basePath={`/projects/${project.key}/cases`} searchParams={await searchParams} fixedProject={project} />
    </div>
  );
}
