import "server-only";
import { notFound } from "next/navigation";
import { getServiceContext } from "@/lib/server-context";

export async function loadProject(key: string) {
  const ctx = await getServiceContext();
  const project = await ctx.repo.getProjectByKey(decodeURIComponent(key));
  if (!project) notFound();
  return { ctx, project };
}
