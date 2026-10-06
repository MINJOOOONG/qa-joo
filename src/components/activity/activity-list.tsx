import type { Activity } from "@/lib/domain/types";
import { formatRelative } from "@/lib/utils";

export function ActivityList({ activities, projectKeys }: { activities: Activity[]; projectKeys?: Map<string, string> }) {
  if (activities.length === 0) {
    return <p className="py-6 text-center text-[13px] text-muted-foreground">No activity yet.</p>;
  }
  return (
    <ul className="divide-y">
      {activities.map((activity) => (
        <li key={activity.id} className="flex items-baseline gap-3 py-2 text-[13px]">
          <span className="w-16 shrink-0 text-xs tabular-nums text-muted-foreground" title={activity.createdAt}>
            {formatRelative(activity.createdAt)}
          </span>
          {projectKeys && activity.projectId ? (
            <span className="w-10 shrink-0 font-mono text-[11px] text-muted-foreground">
              {projectKeys.get(activity.projectId) ?? ""}
            </span>
          ) : null}
          <span className="min-w-0 flex-1">
            <span className="font-medium">{activity.actor}</span>{" "}
            <span className="text-zinc-700">{activity.message}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
