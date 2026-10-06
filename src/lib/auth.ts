import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getConfig } from "@/lib/env";
import { AppError } from "@/lib/errors";
import type { CurrentUser } from "@/lib/domain/types";

export async function createSupabaseServerClient() {
  const config = getConfig();
  if (!config.supabase.url || !config.supabase.anonKey) {
    throw new AppError("not_configured", "Supabase Auth is not configured.");
  }
  const cookieStore = await cookies();
  return createServerClient(config.supabase.url, config.supabase.anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Server Components cannot write cookies; the proxy refreshes the session instead.
        }
      },
    },
  });
}

/**
 * Without Supabase Auth (local / demo mode) every request acts as a single local user.
 * With Supabase configured, the user comes from the verified Supabase session.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const config = getConfig();
  if (!config.authEnabled) {
    return config.demoMode
      ? { id: "demo-user", email: "demo@qa-joo.local", name: "Demo QA", isDemo: true }
      : { id: "local-user", email: "local@qa-joo.local", name: "Local QA", isDemo: true };
  }
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const metadataName = data.user.user_metadata?.name;
  return {
    id: data.user.id,
    email: data.user.email ?? "",
    name: typeof metadataName === "string" && metadataName ? metadataName : (data.user.email ?? "QA"),
    isDemo: false,
  };
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new AppError("unauthorized", "Sign in to continue.");
  return user;
}
