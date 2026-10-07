"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/auth";
import { getConfig } from "@/lib/env";
import { getLocale } from "@/lib/i18n/server";
import { localizeMessage } from "@/lib/i18n/server-messages";
import { safeRedirectPath } from "@/lib/safe-redirect";

export interface SignInState {
  error: string | null;
}

const signInSchema = z.object({
  email: z.email("Enter a valid email."),
  password: z.string().min(1, "Enter your password."),
  next: z.string().optional(),
});


export async function signIn(_state: SignInState, formData: FormData): Promise<SignInState> {
  if (!getConfig().authEnabled) redirect("/projects");
  const parsed = signInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: localizeMessage(parsed.error.issues[0]?.message ?? "Invalid input.", await getLocale()) };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) return { error: localizeMessage("Invalid email or password.", await getLocale()) };
  redirect(safeRedirectPath(parsed.data.next, "/projects"));
}

export async function signOut(): Promise<void> {
  if (getConfig().authEnabled) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }
  redirect("/login");
}
