"use server";

import { cookies } from "next/headers";
import { refresh } from "next/cache";
import { ENVIRONMENTS, type Environment } from "@/lib/domain/constants";
import { ENV_COOKIE, PROJECT_COOKIE } from "@/lib/preferences";

const ONE_YEAR = 60 * 60 * 24 * 365;

export async function setCurrentProject(projectId: string | null) {
  const store = await cookies();
  store.set(PROJECT_COOKIE, projectId ?? "all", { path: "/", maxAge: ONE_YEAR, sameSite: "lax", httpOnly: true });
  refresh();
}

export async function setCurrentEnvironment(environment: Environment) {
  if (!ENVIRONMENTS.includes(environment)) return;
  const store = await cookies();
  store.set(ENV_COOKIE, environment, { path: "/", maxAge: ONE_YEAR, sameSite: "lax", httpOnly: true });
  refresh();
}
