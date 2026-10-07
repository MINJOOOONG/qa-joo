import { PageHeader } from "@/components/common/page-header";
import { ProjectForm } from "@/components/projects/project-form";
import { createProjectAction } from "@/app/actions/projects";
import { getI18n } from "@/lib/i18n/server";
import { getPreferences } from "@/lib/preferences";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t.projects.new.title };
}

export default async function NewProjectPage() {
  const [preferences, { t }] = await Promise.all([getPreferences(), getI18n()]);
  return (
    <>
      <PageHeader
        eyebrow={t.projects.new.eyebrow}
        title={t.projects.new.title}
        description={t.projects.new.description}
      />
      <div className="p-4 sm:p-6">
        <ProjectForm mode="create" action={createProjectAction} defaults={{ environment: preferences.environment }} />
      </div>
    </>
  );
}
