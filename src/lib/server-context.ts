import "server-only";
import { requireUser } from "@/lib/auth";
import { getRepository } from "@/lib/db";
import type { ServiceContext } from "@/lib/services/context";

/** Authenticated service context for Server Actions and Route Handlers. */
export async function getServiceContext(): Promise<ServiceContext> {
  const user = await requireUser();
  return { repo: await getRepository(), actor: user.name };
}

/** Context for machine callers (runners) that authenticated with the runner secret. */
export async function getRunnerContext(): Promise<ServiceContext> {
  return { repo: await getRepository(), actor: "QA JOO Runner" };
}
