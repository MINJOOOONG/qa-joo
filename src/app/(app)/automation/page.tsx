import { AutomationOverview } from "@/components/automation/automation-overview";
import { PageHeader } from "@/components/common/page-header";
import { getConfig } from "@/lib/env";
import { getPreferences, scopePreferences } from "@/lib/preferences";
import { getServiceContext } from "@/lib/server-context";

export const metadata = { title: "Automation" };

export default async function AutomationPage() {
  const [ctx, storedPreferences] = await Promise.all([getServiceContext(), getPreferences()]);
  const preferences = await scopePreferences(ctx.repo, storedPreferences);
  return (
    <>
      <PageHeader
        title="Automation"
        description="AI-drafted Playwright specs, human review, and automated runs with screenshots and traces."
      />
      <div className="p-6">
        <AutomationOverview ctx={ctx} projectId={preferences.projectId ?? undefined} runnerMode={getConfig().runner.mode} />
      </div>
    </>
  );
}
