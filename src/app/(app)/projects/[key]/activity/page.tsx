import { ActivityList } from "@/components/activity/activity-list";
import { loadProject } from "@/lib/loaders";

export default async function ProjectActivityPage({ params }: PageProps<"/projects/[key]/activity">) {
  const { key } = await params;
  const { ctx, project } = await loadProject(key);
  const activities = await ctx.repo.listActivities({ projectId: project.id, limit: 200 });
  return (
    <div className="p-6">
      <div className="rounded-md border px-3">
        <ActivityList activities={activities} />
      </div>
    </div>
  );
}
