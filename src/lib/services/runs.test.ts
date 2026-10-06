import { describe, expect, it } from "vitest";
import { memoryContext, seedCase, seedProject } from "@/test/helpers";
import { recordManualResult } from "./results";
import { addCasesToRun, createTestRun, deleteTestRun, listRunSummaries, resolveCaseSelection } from "./runs";
import { createSection } from "./sections";

async function setup() {
  const ctx = memoryContext();
  const project = await seedProject(ctx);
  const campaign = await createSection(ctx, { projectId: project.id, name: "Campaign" });
  const negative = await createSection(ctx, { projectId: project.id, parentId: campaign.id, name: "Negative" });
  const other = await createSection(ctx, { projectId: project.id, name: "Compliance" });
  const happy = await seedCase(ctx, project.id, { sectionId: campaign.id, type: "functional", priority: "high" });
  const reject = await seedCase(ctx, project.id, { sectionId: negative.id, type: "negative", priority: "high", title: "Reject URL" });
  const keyword = await seedCase(ctx, project.id, { sectionId: other.id, type: "functional", priority: "low", title: "Keywords" });
  const draft = await seedCase(ctx, project.id, { sectionId: campaign.id, title: "AI draft" }, { source: "ai_generated" });
  return { ctx, project, sections: { campaign, negative, other }, cases: { happy, reject, keyword, draft } };
}

describe("test runs", () => {
  it("selects all approved cases and never includes AI drafts", async () => {
    const { ctx, project, cases } = await setup();
    const ids = await resolveCaseSelection(ctx, project.id, { mode: "all" });
    expect(ids).toHaveLength(3);
    expect(ids).not.toContain(cases.draft.id);
  });

  it("filters by section subtree, type and priority", async () => {
    const { ctx, project, sections, cases } = await setup();
    const bySection = await resolveCaseSelection(ctx, project.id, { mode: "filter", sectionIds: [sections.campaign.id], types: [], priorities: [], automationStatuses: [] });
    expect(bySection.sort()).toEqual([cases.happy.id, cases.reject.id].sort());
    const byType = await resolveCaseSelection(ctx, project.id, { mode: "filter", sectionIds: [], types: ["negative"], priorities: [], automationStatuses: [] });
    expect(byType).toEqual([cases.reject.id]);
    const byPriority = await resolveCaseSelection(ctx, project.id, { mode: "filter", sectionIds: [], types: [], priorities: ["low"], automationStatuses: [] });
    expect(byPriority).toEqual([cases.keyword.id]);
  });

  it("refuses empty selections", async () => {
    const { ctx, project } = await setup();
    await expect(
      createTestRun(ctx, { projectId: project.id, name: "Empty", environment: "staging", selection: { mode: "filter", sectionIds: [], types: ["security"], priorities: [], automationStatuses: [] } }),
    ).rejects.toMatchObject({ code: "validation" });
  });

  it("adds cases without duplicates and rejects drafts", async () => {
    const { ctx, project, cases } = await setup();
    const run = await createTestRun(ctx, { projectId: project.id, name: "Pick", environment: "staging", selection: { mode: "manual", caseIds: [cases.happy.id] } });
    expect(await addCasesToRun(ctx, run.id, [cases.happy.id, cases.reject.id])).toBe(1);
    expect(await addCasesToRun(ctx, run.id, [cases.reject.id])).toBe(0);
    expect(await ctx.repo.listRunCases(run.id)).toHaveLength(2);
    await expect(addCasesToRun(ctx, run.id, [cases.draft.id])).rejects.toMatchObject({ code: "validation" });
  });

  it("summarizes runs and refreshes last results when a run is deleted", async () => {
    const { ctx, project, cases } = await setup();
    const run = await createTestRun(ctx, { projectId: project.id, name: "Smoke", environment: "production", selection: { mode: "all" } });
    await recordManualResult(ctx, { testRunId: run.id, testCaseId: cases.happy.id, status: "passed" });
    const [summary] = await listRunSummaries(ctx, { projectId: project.id });
    expect(summary.stats).toMatchObject({ total: 3, passed: 1, untested: 2 });
    await deleteTestRun(ctx, run.id);
    expect((await ctx.repo.getTestCase(cases.happy.id))?.lastResult).toBeNull();
  });
});
