import { ActivityList } from "@/components/activity/activity-list";
import { PageHeader } from "@/components/common/page-header";
import { getPreferences } from "@/lib/preferences";
import { getServiceContext } from "@/lib/server-context";

export const metadata = { title: "Activity" };

export default async function ActivityPage() {
  const [ctx, preferences] = await Promise.all([getServiceContext(), getPreferences()]);
  const [activities, projects] = await Promise.all([
    ctx.repo.listActivities({ projectId: preferences.projectId ?? undefined, limit: 200 }),
    ctx.repo.listProjects(),
  ]);
  return (
    <>
      <PageHeader title="Activity" description="Audit trail of everything people, AI and runners did in this workspace." />
      <div className="p-6">
        <div className="rounded-md border px-3">
          <ActivityList activities={activities} projectKeys={new Map(projects.map((p) => [p.id, p.key]))} />
        </div>
      </div>
    </>
  );
}
