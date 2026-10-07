import { redirect } from "next/navigation";
import { Topbar } from "@/components/shell/topbar";
import { signOut } from "@/app/actions/auth";
import { getCurrentUser } from "@/lib/auth";
import { getConfig } from "@/lib/env";

export const dynamic = "force-dynamic";

const AI_LABELS = { anthropic: "Anthropic", openai: "OpenAI", heuristic: "Heuristic" } as const;

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const config = getConfig();
  const workspaceLabel =
    config.dataStore === "supabase" ? "Supabase" : config.demoMode ? "Demo (memory)" : "Local (memory)";

  return (
    <div className="min-h-screen">
      <Topbar
        workspaceLabel={workspaceLabel}
        aiLabel={AI_LABELS[config.ai.provider]}
        user={user}
        canSignOut={config.authEnabled}
        signOutAction={signOut}
      />
      <main className="mx-auto min-w-0 max-w-7xl">{children}</main>
    </div>
  );
}
