import { AppError, notFound } from "@/lib/errors";
import { sectionInputSchema } from "@/lib/domain/schemas";
import type { Section } from "@/lib/domain/types";
import { logActivity } from "./activity";
import type { ServiceContext } from "./context";

export async function createSection(ctx: ServiceContext, raw: unknown): Promise<Section> {
  const input = sectionInputSchema.parse(raw);
  const project = await ctx.repo.getProject(input.projectId);
  if (!project) throw notFound("Project", input.projectId);
  const siblings = (await ctx.repo.listSections(project.id)).filter(
    (s) => s.parentId === (input.parentId ?? null),
  );
  if (input.parentId) {
    const parent = await ctx.repo.getSection(input.parentId);
    if (!parent || parent.projectId !== project.id) {
      throw new AppError("validation", "Parent section must belong to the same project.");
    }
  }
  if (siblings.some((s) => s.name.toLowerCase() === input.name.toLowerCase())) {
    throw new AppError("conflict", `A section named "${input.name}" already exists here.`);
  }
  const section = await ctx.repo.createSection({
    projectId: project.id,
    parentId: input.parentId ?? null,
    name: input.name,
    sortOrder: siblings.reduce((max, s) => Math.max(max, s.sortOrder), 0) + 1,
  });
  await logActivity(ctx, {
    projectId: project.id,
    action: "section.created",
    entityType: "section",
    entityId: section.id,
    message: `Added section ${section.name}`,
  });
  return section;
}

export async function renameSection(ctx: ServiceContext, id: string, name: string): Promise<Section> {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 120) throw new AppError("validation", "Section name must be 1-120 characters.");
  const section = await ctx.repo.getSection(id);
  if (!section) throw notFound("Section", id);
  return ctx.repo.updateSection(id, { name: trimmed });
}

/** Deletes a section; its child sections and test cases move up to the deleted section's parent. */
export async function deleteSection(ctx: ServiceContext, id: string): Promise<void> {
  const section = await ctx.repo.getSection(id);
  if (!section) throw notFound("Section", id);
  const sections = await ctx.repo.listSections(section.projectId);
  for (const child of sections.filter((s) => s.parentId === id)) {
    await ctx.repo.updateSection(child.id, { parentId: section.parentId });
  }
  const cases = await ctx.repo.listTestCases({ projectId: section.projectId, sectionId: id });
  for (const testCase of cases) {
    await ctx.repo.updateTestCase(testCase.id, { sectionId: section.parentId });
  }
  await ctx.repo.deleteSection(id);
  await logActivity(ctx, {
    projectId: section.projectId,
    action: "section.deleted",
    entityType: "section",
    entityId: id,
    message: `Deleted section ${section.name}; ${cases.length} case(s) moved up`,
  });
}

/** Finds a top-level (or child) section by name, creating it when missing. Used by AI generation. */
export async function ensureSectionPath(ctx: ServiceContext, projectId: string, path: string[]): Promise<string | null> {
  let parentId: string | null = null;
  const names = path.map((part) => part.trim()).filter(Boolean).slice(0, 3);
  if (names.length === 0) return null;
  const sections = await ctx.repo.listSections(projectId);
  for (const name of names) {
    const existing = sections.find(
      (s) => s.parentId === parentId && s.name.toLowerCase() === name.toLowerCase(),
    );
    if (existing) {
      parentId = existing.id;
      continue;
    }
    const siblings = sections.filter((s) => s.parentId === parentId);
    const created = await ctx.repo.createSection({
      projectId,
      parentId,
      name: name.slice(0, 120),
      sortOrder: siblings.reduce((max, s) => Math.max(max, s.sortOrder), 0) + 1,
    });
    sections.push(created);
    parentId = created.id;
  }
  return parentId;
}
