import Link from "next/link";
import { CaseForm } from "@/components/cases/case-form";
import { PageHeader } from "@/components/common/page-header";
import { createCaseAction } from "@/app/actions/cases";
import { flattenSections } from "@/lib/domain/sections";
import { getPreferences } from "@/lib/preferences";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { getServiceContext } from "@/lib/server-context";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t.cases.meta.new };
}

export default async function NewCasePage({ searchParams }: PageProps<"/cases/new">) {
  const [ctx, preferences, params] = await Promise.all([getServiceContext(), getPreferences(), searchParams]);
  const { t } = await getI18n();
  const projects = await ctx.repo.listProjects();
  const requested = typeof params.project === "string" ? params.project : null;
  const project =
    projects.find((p) => p.id === requested || p.key === requested) ??
    projects.find((p) => p.id === preferences.projectId) ??
    (projects.length === 1 ? projects[0] : null);
  const returnTo = safeRedirectPath(params.returnTo, "/cases");

  if (!project) {
    return (
      <>
        <PageHeader title={t.cases.page.newTitle} description={t.cases.page.chooseProject} />
        <ul className="space-y-1 p-6 text-[13px]">
          {projects.map((p) => (
            <li key={p.id}>
              <Link className="text-primary hover:underline" href={`/cases/new?project=${p.id}`}>
                {p.key} · {p.name}
              </Link>
            </li>
          ))}
          {projects.length === 0 ? (
            <li>
              <Link className="text-primary hover:underline" href="/projects/new">
                {t.cases.page.createProjectFirst}
              </Link>
            </li>
          ) : null}
        </ul>
      </>
    );
  }
  const sections = flattenSections(await ctx.repo.listSections(project.id)).map((node) => ({
    id: node.section.id,
    label: `${"— ".repeat(node.depth)}${node.section.name}`,
  }));
  const sectionId = typeof params.section === "string" ? params.section : null;
  return (
    <>
      <PageHeader eyebrow={`${project.key} · ${project.name}`} title={t.cases.page.newTitle} />
      <div className="p-6">
        <CaseForm mode="create" action={createCaseAction} projectId={project.id} sections={sections} returnTo={returnTo} defaults={{ sectionId }} />
      </div>
    </>
  );
}
