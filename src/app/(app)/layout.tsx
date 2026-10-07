import { redirect } from "next/navigation";
import { Topbar } from "@/components/shell/topbar";
import { signOut } from "@/app/actions/auth";
import { getCurrentUser } from "@/lib/auth";
import { getConfig } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const config = getConfig();
  const workspace = config.dataStore === "supabase" ? "supabase" : config.demoMode ? "demo" : "local";

  return (
    <div className="min-h-screen">
      <Topbar
        workspace={workspace}
        aiProvider={config.ai.provider}
        user={user}
        canSignOut={config.authEnabled}
        signOutAction={signOut}
      />
      <main className="mx-auto min-w-0 max-w-7xl">{children}</main>
    </div>
  );
}
