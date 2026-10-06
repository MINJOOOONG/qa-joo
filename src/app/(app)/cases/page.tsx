import { CaseExplorer } from "@/components/cases/case-explorer";
import { PageHeader } from "@/components/common/page-header";
import { getPreferences, scopePreferences } from "@/lib/preferences";
import { getServiceContext } from "@/lib/server-context";

export const metadata = { title: "Test Cases" };

export default async function CasesPage({ searchParams }: PageProps<"/cases">) {
  const [ctx, storedPreferences, params] = await Promise.all([getServiceContext(), getPreferences(), searchParams]);
  const preferences = await scopePreferences(ctx.repo, storedPreferences);
  return (
    <>
      <PageHeader title="Test Cases" description="Every case across your projects. Click a row for details." />
      <div className="p-6">
        <CaseExplorer ctx={ctx} basePath="/cases" searchParams={params} defaultProjectId={preferences.projectId} />
      </div>
    </>
  );
}
