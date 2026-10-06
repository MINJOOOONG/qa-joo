import { redirect } from "next/navigation";
import { FlaskConical } from "lucide-react";
import { getConfig } from "@/lib/env";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (!getConfig().authEnabled) redirect("/dashboard");
  const { next } = await searchParams;
  return (
    <div className="flex min-h-screen items-center justify-center bg-subtle px-4">
      <div className="w-full max-w-sm rounded-lg border bg-background p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded bg-primary text-white">
            <FlaskConical className="size-4" />
          </span>
          <span className="text-lg font-semibold tracking-tight">QA JOO</span>
        </div>
        <h1 className="text-base font-semibold">Sign in</h1>
        <p className="mb-4 text-[13px] text-muted-foreground">
          Use an account created in your Supabase project (Authentication → Users).
        </p>
        <LoginForm next={typeof next === "string" ? next : undefined} />
      </div>
    </div>
  );
}
