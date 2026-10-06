import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { memoryContext, seedCase, seedProject } from "@/test/helpers";
import { approveAllDrafts, createTestCase, deleteTestCase, duplicateTestCase, getCaseDetail, reviewTestCase, updateTestCase } from "./cases";
import { createSection, deleteSection } from "./sections";

describe("test cases", () => {
  it("assigns sequential keys per project", async () => {
    const ctx = memoryContext();
    const rf = await seedProject(ctx, "RF");
    const ab = await seedProject(ctx, "AB");
    const first = await seedCase(ctx, rf.id);
    const second = await seedCase(ctx, rf.id, { title: "Second" });
    const other = await seedCase(ctx, ab.id);
    expect([first.caseKey, second.caseKey, other.caseKey]).toEqual(["RF-TC-001", "RF-TC-002", "AB-TC-001"]);
    await deleteTestCase(ctx, second.id);
    expect((await seedCase(ctx, rf.id)).caseKey).toBe("RF-TC-002");
  });

  it("validates input", async () => {
    const ctx = memoryContext();
    const project = await seedProject(ctx);
    await expect(seedCase(ctx, project.id, { steps: [] })).rejects.toBeInstanceOf(ZodError);
    await expect(seedCase(ctx, project.id, { type: "exploratory" })).rejects.toBeInstanceOf(ZodError);
    await expect(seedCase(ctx, project.id, { tags: ["bad tag!"] })).rejects.toBeInstanceOf(ZodError);
  });

  it("rejects sections from another project", async () => {
    const ctx = memoryContext();
    const a = await seedProject(ctx, "AA");
    const b = await seedProject(ctx, "BB");
    const foreign = await createSection(ctx, { projectId: b.id, name: "Other" });
    await expect(seedCase(ctx, a.id, { sectionId: foreign.id })).rejects.toMatchObject({ code: "validation" });
  });

  it("stores AI output as drafts until a human approves or rejects", async () => {
    const ctx = memoryContext();
    const project = await seedProject(ctx);
    const draft = await seedCase(ctx, project.id, {}, { source: "ai_generated", aiRationale: "URL field found" });
    expect(draft).toMatchObject({ source: "ai_generated", reviewStatus: "draft", aiRationale: "URL field found" });
    expect((await reviewTestCase(ctx, draft.id, "approve")).reviewStatus).toBe("approved");
    await expect(reviewTestCase(ctx, draft.id, "reject")).rejects.toMatchObject({ code: "invalid_state" });
    await expect(createTestCase(ctx, { projectId: project.id, title: "x", steps: ["a"], expectedResult: "b", type: "smoke", priority: "low" }, { reviewStatus: "draft" })).rejects.toMatchObject({ code: "validation" });
  });

  it("approves all drafts (or a subset) in one go", async () => {
    const ctx = memoryContext();
    const project = await seedProject(ctx);
    const drafts = await Promise.all([1, 2, 3].map((n) => seedCase(ctx, project.id, { title: `Draft ${n}` }, { source: "ai_generated" })));
    expect(await approveAllDrafts(ctx, project.id, [drafts[0].id])).toBe(1);
    expect(await approveAllDrafts(ctx, project.id)).toBe(2);
    expect(await ctx.repo.listTestCases({ projectId: project.id, reviewStatuses: ["draft"] })).toHaveLength(0);
  });

  it("only becomes Automated through an approved Playwright spec", async () => {
    const ctx = memoryContext();
    const project = await seedProject(ctx);
    const testCase = await seedCase(ctx, project.id);
    await expect(updateTestCase(ctx, testCase.id, { automationStatus: "automated" })).rejects.toMatchObject({ code: "validation" });
    expect((await updateTestCase(ctx, testCase.id, { automationStatus: "candidate", title: "Renamed" })).title).toBe("Renamed");
  });

  it("duplicates a case with a new key", async () => {
    const ctx = memoryContext();
    const project = await seedProject(ctx);
    const original = await seedCase(ctx, project.id, { tags: ["smoke"] });
    const copy = await duplicateTestCase(ctx, original.id);
    expect(copy).toMatchObject({ caseKey: "RF-TC-002", title: `${original.title} (copy)`, tags: ["smoke"], source: "manual" });
  });

  it("keeps a duplicated AI draft behind the review gate", async () => {
    const ctx = memoryContext();
    const project = await seedProject(ctx);
    const draft = await createTestCase(
      ctx,
      { projectId: project.id, title: "AI", steps: ["a"], expectedResult: "b", type: "functional", priority: "medium" },
      { source: "ai_generated", aiRationale: "why" },
    );
    const copy = await duplicateTestCase(ctx, draft.id);
    expect(copy).toMatchObject({ source: "ai_generated", reviewStatus: "draft", aiRationale: "why" });
  });

  it("moves cases up when their section is deleted", async () => {
    const ctx = memoryContext();
    const project = await seedProject(ctx);
    const parent = await createSection(ctx, { projectId: project.id, name: "Campaign" });
    const child = await createSection(ctx, { projectId: project.id, parentId: parent.id, name: "Negative" });
    const testCase = await seedCase(ctx, project.id, { sectionId: child.id });
    await deleteSection(ctx, child.id);
    expect((await ctx.repo.getTestCase(testCase.id))?.sectionId).toBe(parent.id);
    const detail = await getCaseDetail(ctx, testCase.id);
    expect(detail.sectionPath).toBe("Campaign");
  });
});
