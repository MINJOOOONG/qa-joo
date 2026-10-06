import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { AppError } from "@/lib/errors";
import { memoryContext, seedCase, seedProject } from "@/test/helpers";
import { createProject, deleteProject, getProjectOverview, updateProject } from "./projects";

describe("project CRUD", () => {
  it("creates a project with a normalized key and logs activity", async () => {
    const ctx = memoryContext();
    const project = await createProject(ctx, {
      name: "ReviewForge",
      key: "rf",
      appUrl: "https://reviewforge.example.com",
      repoUrl: "https://github.com/acme/reviewforge.git",
    });
    expect(project.key).toBe("RF");
    expect(project.repoUrl).toBe("https://github.com/acme/reviewforge");
    expect(project.environment).toBe("staging");
    expect((await ctx.repo.listActivities())[0].action).toBe("project.created");
  });

  it("rejects duplicate keys", async () => {
    const ctx = memoryContext();
    await seedProject(ctx, "RF");
    await expect(seedProject(ctx, "RF")).rejects.toMatchObject({ code: "conflict" });
  });

  it("requires an application or repository URL", async () => {
    const ctx = memoryContext();
    await expect(createProject(ctx, { name: "No target", key: "NT" })).rejects.toBeInstanceOf(ZodError);
    await expect(createProject(ctx, { name: "Repo only", key: "RO", repoUrl: "https://github.com/a/b" })).resolves.toBeTruthy();
  });

  it("validates URLs and keys", async () => {
    const ctx = memoryContext();
    await expect(createProject(ctx, { name: "x", key: "1BAD", appUrl: "https://a.com" })).rejects.toBeInstanceOf(ZodError);
    await expect(createProject(ctx, { name: "x", key: "OK", appUrl: "javascript:alert(1)" })).rejects.toBeInstanceOf(ZodError);
    await expect(createProject(ctx, { name: "x", key: "OK", repoUrl: "https://gitlab.com/a/b" })).rejects.toBeInstanceOf(ZodError);
  });

  it("updates settings but never leaves a project without a target", async () => {
    const ctx = memoryContext();
    const project = await seedProject(ctx);
    const updated = await updateProject(ctx, project.id, { name: "Renamed", environment: "production" });
    expect(updated).toMatchObject({ name: "Renamed", environment: "production", key: "RF" });
    await expect(updateProject(ctx, project.id, { appUrl: "" })).rejects.toBeInstanceOf(AppError);
  });

  it("deletes only with the matching key and cascades to cases", async () => {
    const ctx = memoryContext();
    const project = await seedProject(ctx);
    await seedCase(ctx, project.id);
    await expect(deleteProject(ctx, project.id, "NOPE")).rejects.toMatchObject({ code: "validation" });
    await deleteProject(ctx, project.id, "rf");
    expect(await ctx.repo.getProject(project.id)).toBeNull();
    expect(await ctx.repo.listTestCases({ projectId: project.id })).toHaveLength(0);
  });

  it("summarizes coverage for the overview", async () => {
    const ctx = memoryContext();
    const project = await seedProject(ctx);
    await seedCase(ctx, project.id);
    await seedCase(ctx, project.id, { title: "Draft" }, { source: "ai_generated" });
    const overview = await getProjectOverview(ctx, project);
    expect(overview).toMatchObject({ caseCount: 1, draftCount: 1, automatedCount: 0, automationCoverage: 0, latestRun: null });
  });
});
