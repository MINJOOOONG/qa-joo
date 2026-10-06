import { DeleteProject } from "@/components/projects/delete-project";
import { ProjectForm } from "@/components/projects/project-form";
import { SectionsManager } from "@/components/projects/sections-manager";
import { updateProjectAction } from "@/app/actions/projects";
import { flattenSections } from "@/lib/domain/sections";
import { loadProject } from "@/lib/loaders";

export const metadata = { title: "Project Settings" };

export default async function ProjectSettingsPage({ params }: PageProps<"/projects/[key]/settings">) {
  const { key } = await params;
  const { ctx, project } = await loadProject(key);
  const [sections, cases] = await Promise.all([
    ctx.repo.listSections(project.id),
    ctx.repo.listTestCases({ projectId: project.id }),
  ]);
  const caseCounts: Record<string, number> = {};
  for (const c of cases) if (c.sectionId) caseCounts[c.sectionId] = (caseCounts[c.sectionId] ?? 0) + 1;

  return (
    <div className="max-w-4xl space-y-8 p-6">
      <section>
        <h2 className="mb-3 text-[13px] font-semibold">General & connection</h2>
        <ProjectForm
          mode="edit"
          action={updateProjectAction.bind(null, project.id)}
          defaults={{
            name: project.name,
            key: project.key,
            description: project.description ?? "",
            appUrl: project.appUrl ?? "",
            repoUrl: project.repoUrl ?? "",
            environment: project.environment,
          }}
        />
      </section>
      <section>
        <h2 className="mb-1 text-[13px] font-semibold">Sections</h2>
        <p className="mb-3 text-xs text-muted-foreground">Organize the suite into a hierarchy, e.g. Campaign Analysis → Negative Cases.</p>
        <SectionsManager projectId={project.id} nodes={flattenSections(sections)} caseCounts={caseCounts} />
      </section>
      <section className="rounded-md border border-red-200 p-4">
        <h2 className="mb-2 text-[13px] font-semibold text-destructive">Danger zone</h2>
        <DeleteProject projectId={project.id} projectKey={project.key} />
      </section>
    </div>
  );
}
