import { ActivityList } from "@/components/activity/activity-list";
import { PageHeader } from "@/components/common/page-header";
import { getI18n } from "@/lib/i18n/server";
import { getPreferences, scopePreferences } from "@/lib/preferences";
import { getServiceContext } from "@/lib/server-context";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t.activity.title };
}

export default async function ActivityPage() {
  const [ctx, storedPreferences] = await Promise.all([getServiceContext(), getPreferences()]);
  const preferences = await scopePreferences(ctx.repo, storedPreferences);
  const { t } = await getI18n();
  const [activities, projects] = await Promise.all([
    ctx.repo.listActivities({ projectId: preferences.projectId ?? undefined, limit: 200 }),
    ctx.repo.listProjects(),
  ]);
  return (
    <>
      <PageHeader title={t.activity.title} description={t.activity.description} />
      <div className="p-6">
        <div className="rounded-md border px-3">
          <ActivityList activities={activities} projectKeys={new Map(projects.map((p) => [p.id, p.key]))} />
        </div>
      </div>
    </>
  );
}
