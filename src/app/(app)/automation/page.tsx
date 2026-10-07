import { AutomationOverview } from "@/components/automation/automation-overview";
import { PageHeader } from "@/components/common/page-header";
import { getConfig } from "@/lib/env";
import { getPreferences, scopePreferences } from "@/lib/preferences";
import { getServiceContext } from "@/lib/server-context";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t.automation.page.title };
}

export default async function AutomationPage() {
  const [ctx, storedPreferences, { t }] = await Promise.all([getServiceContext(), getPreferences(), getI18n()]);
  const preferences = await scopePreferences(ctx.repo, storedPreferences);
  return (
    <>
      <PageHeader
        title={t.automation.page.title}
        description={t.automation.page.description}
      />
      <div className="p-6">
        <AutomationOverview ctx={ctx} projectId={preferences.projectId ?? undefined} runnerMode={getConfig().runner.mode} />
      </div>
    </>
  );
}
