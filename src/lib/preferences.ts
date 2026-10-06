import "server-only";
import { cookies } from "next/headers";
import { ENVIRONMENTS, type Environment } from "@/lib/domain/constants";

export const PROJECT_COOKIE = "qajoo_project";
export const ENV_COOKIE = "qajoo_env";

export interface Preferences {
  /** Current project id, or null for "All projects". */
  projectId: string | null;
  environment: Environment;
}

export async function getPreferences(): Promise<Preferences> {
  const store = await cookies();
  const projectId = store.get(PROJECT_COOKIE)?.value || null;
  const env = store.get(ENV_COOKIE)?.value as Environment | undefined;
  return {
    projectId: projectId === "all" ? null : projectId,
    environment: env && ENVIRONMENTS.includes(env) ? env : "staging",
  };
}

/** Drops a remembered project that no longer exists (deleted elsewhere), falling back to "All projects". */
export async function scopePreferences(
  repo: { getProject(id: string): Promise<unknown> },
  preferences: Preferences,
): Promise<Preferences> {
  if (preferences.projectId && !(await repo.getProject(preferences.projectId))) {
    return { ...preferences, projectId: null };
  }
  return preferences;
}
