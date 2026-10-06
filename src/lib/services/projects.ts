import { AppError, notFound } from "@/lib/errors";
import {
  createProjectSchema,
  updateProjectSchema,
  type CreateProjectInput,
  type UpdateProjectInput,
} from "@/lib/domain/schemas";
import type { Project } from "@/lib/domain/types";
import { computeRunStats } from "@/lib/domain/run-stats";
import { logActivity } from "./activity";
import type { ServiceContext } from "./context";

export async function createProject(ctx: ServiceContext, raw: unknown): Promise<Project> {
  const input: CreateProjectInput = createProjectSchema.parse(raw);
  if (await ctx.repo.getProjectByKey(input.key)) {
    throw new AppError("conflict", `Project key ${input.key} is already in use.`, { key: "Key is already in use." });
  }
  const project = await ctx.repo.createProject({
    key: input.key,
    name: input.name,
    description: input.description ?? null,
    appUrl: input.appUrl ?? null,
    repoUrl: input.repoUrl ?? null,
    environment: input.environment,
  });
  await logActivity(ctx, {
    projectId: project.id,
    action: "project.created",
    entityType: "project",
    entityId: project.id,
    message: `Created project ${project.name} (${project.key})`,
  });
  return project;
}

export async function updateProject(ctx: ServiceContext, id: string, raw: unknown): Promise<Project> {
  const input: UpdateProjectInput = updateProjectSchema.parse(raw);
  const current = await ctx.repo.getProject(id);
  if (!current) throw notFound("Project", id);
  const next = {
    appUrl: input.appUrl === undefined ? current.appUrl : input.appUrl,
    repoUrl: input.repoUrl === undefined ? current.repoUrl : input.repoUrl,
  };
  if (!next.appUrl && !next.repoUrl) {
    throw new AppError("validation", "A project needs an Application URL or a Repository URL.", {
      appUrl: "Add an Application URL or a Repository URL.",
    });
  }
  const project = await ctx.repo.updateProject(id, {
    name: input.name,
    description: input.description,
    appUrl: input.appUrl,
    repoUrl: input.repoUrl,
    environment: input.environment,
  });
  await logActivity(ctx, {
    projectId: id,
    action: "project.updated",
    entityType: "project",
    entityId: id,
    message: `Updated project settings for ${project.name}`,
  });
  return project;
}

export async function deleteProject(ctx: ServiceContext, id: string, confirmKey: string): Promise<void> {
  const project = await ctx.repo.getProject(id);
  if (!project) throw notFound("Project", id);
  if (confirmKey.trim().toUpperCase() !== project.key) {
    throw new AppError("validation", `Type ${project.key} to confirm deletion.`, { confirmKey: "Key does not match." });
  }
  await ctx.repo.deleteProject(id);
  await logActivity(ctx, {
    projectId: null,
    action: "project.deleted",
    entityType: "project",
    entityId: id,
    message: `Deleted project ${project.name} (${project.key})`,
  });
}

export interface ProjectOverview {
  project: Project;
  caseCount: number;
  draftCount: number;
  automatedCount: number;
  automationCoverage: number | null;
  latestRun: { id: string; name: string; updatedAt: string; passRate: number | null; progress: number } | null;
  activeRuns: number;
}

export async function getProjectOverview(ctx: ServiceContext, project: Project): Promise<ProjectOverview> {
  const [cases, runs] = await Promise.all([
    ctx.repo.listTestCases({ projectId: project.id }),
    ctx.repo.listTestRuns({ projectId: project.id }),
  ]);
  const approved = cases.filter((c) => c.reviewStatus === "approved");
  const automated = approved.filter((c) => c.automationStatus === "automated").length;
  const latest = runs[0] ?? null;
  let latestRun: ProjectOverview["latestRun"] = null;
  if (latest) {
    const [runCases, results] = await Promise.all([
      ctx.repo.listRunCases(latest.id),
      ctx.repo.listResults({ testRunId: latest.id }),
    ]);
    const stats = computeRunStats(runCases.length, results.map((r) => r.status));
    latestRun = {
      id: latest.id,
      name: latest.name,
      updatedAt: latest.updatedAt,
      passRate: stats.passRate,
      progress: stats.progress,
    };
  }
  return {
    project,
    caseCount: approved.length,
    draftCount: cases.filter((c) => c.reviewStatus === "draft").length,
    automatedCount: automated,
    automationCoverage: approved.length ? automated / approved.length : null,
    latestRun,
    activeRuns: runs.filter((r) => r.status === "active").length,
  };
}
