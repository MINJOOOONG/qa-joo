import Link from "next/link";
import { PageHeader } from "@/components/common/page-header";
import { CreateRunForm } from "@/components/runs/create-run-form";
import { flattenSections, sectionPaths } from "@/lib/domain/sections";
import { getPreferences } from "@/lib/preferences";
import { getServiceContext } from "@/lib/server-context";

export const metadata = { title: "Create Test Run" };

export default async function NewRunPage({ searchParams }: PageProps<"/runs/new">) {
  const [ctx, preferences, params] = await Promise.all([getServiceContext(), getPreferences(), searchParams]);
  const projects = await ctx.repo.listProjects();
  const requested = typeof params.project === "string" ? params.project : null;
  const project =
    projects.find((p) => p.id === requested || p.key === requested) ??
    projects.find((p) => p.id === preferences.projectId) ??
    projects[0];
  if (!project) {
    return (
      <>
        <PageHeader title="Create Test Run" />
        <p className="p-6 text-[13px]">
          <Link href="/projects/new" className="text-primary hover:underline">
            Create a project
          </Link>{" "}
          first.
        </p>
      </>
    );
  }
  const [sections, cases] = await Promise.all([
    ctx.repo.listSections(project.id),
    ctx.repo.listTestCases({ projectId: project.id, reviewStatuses: ["approved"] }),
  ]);
  const paths = sectionPaths(sections);
  const preselected = typeof params.cases === "string" ? params.cases.split(",").filter(Boolean) : [];
  return (
    <>
      <PageHeader eyebrow="Test Runs" title="Create Test Run" description="Choose the build and environment, then select which approved cases to execute." />
      <div className="p-6">
        <CreateRunForm
          key={project.id}
          projects={projects.map(({ id, key, name }) => ({ id, key, name }))}
          projectId={project.id}
          defaultEnvironment={preferences.environment}
          sections={flattenSections(sections).map(({ section, depth }) => ({ section, depth }))}
          cases={cases.map((c) => ({
            id: c.id,
            caseKey: c.caseKey,
            title: c.title,
            sectionId: c.sectionId,
            sectionPath: c.sectionId ? (paths.get(c.sectionId) ?? null) : null,
            type: c.type,
            priority: c.priority,
            automationStatus: c.automationStatus,
          }))}
          preselected={preselected}
        />
      </div>
    </>
  );
}
