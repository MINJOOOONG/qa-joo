import { AutomationOverview } from "@/components/automation/automation-overview";
import { RunAutomationButton } from "@/components/automation/run-automation-button";
import { getConfig } from "@/lib/env";
import { loadProject } from "@/lib/loaders";
import { getI18n } from "@/lib/i18n/server";

export default async function ProjectAutomationPage({ params }: PageProps<"/projects/[key]/automation">) {
  const { key } = await params;
  const { ctx, project } = await loadProject(key);
  const { t } = await getI18n();
  const approved = await ctx.repo.listAutomationTests({ projectId: project.id, status: "approved" });
  return (
    <div className="space-y-4 p-6">
      <div className="flex justify-end">
        <RunAutomationButton projectId={project.id} automatedCount={approved.length} label={t.automation.runAllAutomated} variant="default" />
      </div>
      <AutomationOverview ctx={ctx} projectId={project.id} runnerMode={getConfig().runner.mode} />
    </div>
  );
}
