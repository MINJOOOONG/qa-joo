import { redirect } from "next/navigation";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { signOut } from "@/app/actions/auth";
import { getCurrentUser } from "@/lib/auth";
import { getRepository } from "@/lib/db";
import { getConfig } from "@/lib/env";
import { getPreferences } from "@/lib/preferences";

export const dynamic = "force-dynamic";

const AI_LABELS = { anthropic: "Anthropic", openai: "OpenAI", heuristic: "Heuristic" } as const;

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const config = getConfig();
  const [repo, preferences] = await Promise.all([getRepository(), getPreferences()]);
  const projects = await repo.listProjects();
  const currentProjectId = projects.some((p) => p.id === preferences.projectId) ? preferences.projectId : null;
  const workspaceLabel =
    config.dataStore === "supabase" ? "Supabase" : config.demoMode ? "Demo (memory)" : "Local (memory)";

  return (
    <div className="min-h-screen pl-56">
      <Sidebar workspaceLabel={workspaceLabel} aiLabel={AI_LABELS[config.ai.provider]} />
      <Topbar
        projects={projects.map(({ id, key, name }) => ({ id, key, name }))}
        currentProjectId={currentProjectId}
        environment={preferences.environment}
        user={user}
        canSignOut={config.authEnabled}
        signOutAction={signOut}
      />
      <main className="min-w-0">{children}</main>
    </div>
  );
}
