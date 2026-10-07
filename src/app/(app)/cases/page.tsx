import { CaseExplorer } from "@/components/cases/case-explorer";
import { PageHeader } from "@/components/common/page-header";
import { getPreferences, scopePreferences } from "@/lib/preferences";
import { getServiceContext } from "@/lib/server-context";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t.cases.meta.list };
}

export default async function CasesPage({ searchParams }: PageProps<"/cases">) {
  const [ctx, storedPreferences, params] = await Promise.all([getServiceContext(), getPreferences(), searchParams]);
  const { t } = await getI18n();
  const preferences = await scopePreferences(ctx.repo, storedPreferences);
  return (
    <>
      <PageHeader title={t.cases.page.title} description={t.cases.page.description} />
      <div className="p-6">
        <CaseExplorer ctx={ctx} basePath="/cases" searchParams={params} defaultProjectId={preferences.projectId} />
      </div>
    </>
  );
}
