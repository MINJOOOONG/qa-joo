import { PageHeader } from "@/components/common/page-header";
import { ProjectForm } from "@/components/projects/project-form";
import { createProjectAction } from "@/app/actions/projects";
import { getPreferences } from "@/lib/preferences";

export const metadata = { title: "New Project" };

export default async function NewProjectPage() {
  const preferences = await getPreferences();
  return (
    <>
      <PageHeader
        eyebrow="Projects"
        title="New Project"
        description="Paste the URL of the app you want to test. QA JOO will analyze it and draft test cases for your review."
      />
      <div className="p-6">
        <ProjectForm mode="create" action={createProjectAction} defaults={{ environment: preferences.environment }} />
      </div>
    </>
  );
}
