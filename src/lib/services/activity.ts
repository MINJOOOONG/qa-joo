import type { Activity } from "@/lib/domain/types";
import type { ServiceContext } from "./context";

export async function logActivity(
  ctx: ServiceContext,
  entry: {
    projectId: string | null;
    action: string;
    entityType: Activity["entityType"];
    entityId: string | null;
    message: string;
  },
): Promise<void> {
  try {
    await ctx.repo.addActivity({ ...entry, actor: ctx.actor });
  } catch (error) {
    // The activity log is best-effort and must never fail the user's action.
    console.warn("[qa-joo] failed to record activity", error);
  }
}
