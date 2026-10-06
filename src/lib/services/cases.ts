import { AppError, notFound } from "@/lib/errors";
import { nextCaseKey } from "@/lib/domain/case-key";
import { testCaseInputSchema, testCaseUpdateSchema, type TestCaseInput } from "@/lib/domain/schemas";
import type { CaseSource, ReviewStatus } from "@/lib/domain/constants";
import type {
  AutomationResult,
  AutomationTest,
  Project,
  Section,
  TestCase,
  TestResult,
  TestRun,
} from "@/lib/domain/types";
import { sectionPaths } from "@/lib/domain/sections";
import { logActivity } from "./activity";
import type { ServiceContext } from "./context";

interface CreateOptions {
  source?: CaseSource;
  reviewStatus?: ReviewStatus;
  aiRationale?: string | null;
  /** Skip the activity entry (bulk AI generation logs one summary entry instead). */
  silent?: boolean;
}

async function assertSectionInProject(ctx: ServiceContext, projectId: string, sectionId: string | null | undefined) {
  if (!sectionId) return;
  const section = await ctx.repo.getSection(sectionId);
  if (!section || section.projectId !== projectId) {
    throw new AppError("validation", "Section does not belong to this project.", { sectionId: "Invalid section." });
  }
}

/**
 * Creates a test case with the next free key (e.g. RF-TC-013). Keys are derived from the highest
 * key in use; if another writer takes the same key concurrently the unique constraint rejects it
 * and we retry with a fresh key.
 */
export async function createTestCase(ctx: ServiceContext, raw: unknown, options: CreateOptions = {}): Promise<TestCase> {
  const input: TestCaseInput = testCaseInputSchema.parse(raw);
  const project = await ctx.repo.getProject(input.projectId);
  if (!project) throw notFound("Project", input.projectId);
  await assertSectionInProject(ctx, project.id, input.sectionId);

  const source = options.source ?? "manual";
  const reviewStatus = options.reviewStatus ?? (source === "ai_generated" ? "draft" : "approved");
  if (reviewStatus === "draft" && source !== "ai_generated") {
    throw new AppError("validation", "Only AI-generated cases start as drafts.");
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const caseKey = nextCaseKey(project.key, await ctx.repo.listCaseKeys(project.id));
    try {
      const testCase = await ctx.repo.createTestCase({
        projectId: project.id,
        sectionId: input.sectionId ?? null,
        caseKey,
        title: input.title,
        description: input.description ?? null,
        preconditions: input.preconditions ?? null,
        steps: input.steps,
        expectedResult: input.expectedResult,
        type: input.type,
        priority: input.priority,
        automationStatus: input.automationStatus,
        source,
        reviewStatus,
        tags: input.tags,
        aiRationale: options.aiRationale ?? null,
      });
      if (!options.silent) {
        await logActivity(ctx, {
          projectId: project.id,
          action: "test_case.created",
          entityType: "test_case",
          entityId: testCase.id,
          message: `Created ${testCase.caseKey} ${testCase.title}`,
        });
      }
      return testCase;
    } catch (error) {
      if (error instanceof AppError && error.code === "conflict" && attempt < 4) continue;
      throw error;
    }
  }
  throw new AppError("conflict", "Could not allocate a case key. Try again.");
}

export async function updateTestCase(ctx: ServiceContext, id: string, raw: unknown): Promise<TestCase> {
  const current = await ctx.repo.getTestCase(id);
  if (!current) throw notFound("Test case", id);
  const patch = testCaseUpdateSchema.parse(raw);
  await assertSectionInProject(ctx, current.projectId, patch.sectionId);
  if (patch.automationStatus === "automated" && current.automationStatus !== "automated") {
    const automation = await ctx.repo.getAutomationTestByCase(id);
    if (automation?.status !== "approved") {
      throw new AppError("validation", "A case becomes Automated only after its Playwright draft is approved.", {
        automationStatus: "Approve an automation draft first.",
      });
    }
  }
  const updated = await ctx.repo.updateTestCase(id, {
    ...patch,
    sectionId: patch.sectionId === undefined ? undefined : (patch.sectionId ?? null),
    description: patch.description === undefined ? undefined : (patch.description ?? null),
    preconditions: patch.preconditions === undefined ? undefined : (patch.preconditions ?? null),
  });
  await logActivity(ctx, {
    projectId: updated.projectId,
    action: "test_case.updated",
    entityType: "test_case",
    entityId: id,
    message: `Edited ${updated.caseKey} ${updated.title}`,
  });
  return updated;
}

export async function duplicateTestCase(ctx: ServiceContext, id: string): Promise<TestCase> {
  const source = await ctx.repo.getTestCase(id);
  if (!source) throw notFound("Test case", id);
  return createTestCase(ctx, {
    projectId: source.projectId,
    sectionId: source.sectionId,
    title: `${source.title} (copy)`.slice(0, 200),
    description: source.description,
    preconditions: source.preconditions,
    steps: source.steps,
    expectedResult: source.expectedResult,
    type: source.type,
    priority: source.priority,
    automationStatus: source.automationStatus === "automated" ? "candidate" : source.automationStatus,
    tags: source.tags,
  });
}

export async function deleteTestCase(ctx: ServiceContext, id: string): Promise<void> {
  const testCase = await ctx.repo.getTestCase(id);
  if (!testCase) throw notFound("Test case", id);
  await ctx.repo.deleteTestCase(id);
  await logActivity(ctx, {
    projectId: testCase.projectId,
    action: "test_case.deleted",
    entityType: "test_case",
    entityId: id,
    message: `Deleted ${testCase.caseKey} ${testCase.title}`,
  });
}

/** Human review gate for AI drafts: approve keeps the case in the suite, reject hides it. */
export async function reviewTestCase(
  ctx: ServiceContext,
  id: string,
  decision: "approve" | "reject",
): Promise<TestCase> {
  const testCase = await ctx.repo.getTestCase(id);
  if (!testCase) throw notFound("Test case", id);
  if (testCase.reviewStatus !== "draft") {
    throw new AppError("invalid_state", `${testCase.caseKey} is not an AI draft.`);
  }
  const updated = await ctx.repo.updateTestCase(id, {
    reviewStatus: decision === "approve" ? "approved" : "rejected",
  });
  await logActivity(ctx, {
    projectId: testCase.projectId,
    action: decision === "approve" ? "test_case.approved" : "test_case.rejected",
    entityType: "test_case",
    entityId: id,
    message: `${decision === "approve" ? "Approved" : "Rejected"} AI draft ${testCase.caseKey} ${testCase.title}`,
  });
  return updated;
}

export async function approveAllDrafts(ctx: ServiceContext, projectId: string, ids?: string[]): Promise<number> {
  const drafts = await ctx.repo.listTestCases({ projectId, reviewStatuses: ["draft"], ids });
  for (const draft of drafts) {
    await ctx.repo.updateTestCase(draft.id, { reviewStatus: "approved" });
  }
  if (drafts.length) {
    await logActivity(ctx, {
      projectId,
      action: "test_case.approved_bulk",
      entityType: "test_case",
      entityId: null,
      message: `Approved ${drafts.length} AI draft test case(s)`,
    });
  }
  return drafts.length;
}

export interface CaseHistoryEntry {
  run: TestRun;
  result: TestResult | null;
}

export interface CaseDetail {
  testCase: TestCase;
  project: Project;
  sectionPath: string | null;
  sections: Section[];
  history: CaseHistoryEntry[];
  automation: AutomationTest | null;
  automationResults: AutomationResult[];
}

export async function getCaseDetail(ctx: ServiceContext, id: string): Promise<CaseDetail> {
  const testCase = await ctx.repo.getTestCase(id);
  if (!testCase) throw notFound("Test case", id);
  const [project, sections, results, automation, automationResults, runs] = await Promise.all([
    ctx.repo.getProject(testCase.projectId),
    ctx.repo.listSections(testCase.projectId),
    ctx.repo.listResults({ testCaseId: id }),
    ctx.repo.getAutomationTestByCase(id),
    ctx.repo.listAutomationResults({ testCaseId: id, limit: 10 }),
    ctx.repo.listTestRuns({ projectId: testCase.projectId }),
  ]);
  if (!project) throw notFound("Project", testCase.projectId);
  const resultByRun = new Map(results.map((r) => [r.testRunId, r]));
  const runIdsWithCase = new Set<string>();
  for (const run of runs) {
    if (resultByRun.has(run.id)) runIdsWithCase.add(run.id);
  }
  // Include runs that contain the case but have no result yet (untested).
  for (const run of runs) {
    if (runIdsWithCase.has(run.id)) continue;
    const runCases = await ctx.repo.listRunCases(run.id);
    if (runCases.some((rc) => rc.testCaseId === id)) runIdsWithCase.add(run.id);
  }
  const history = runs
    .filter((run) => runIdsWithCase.has(run.id))
    .map((run) => ({ run, result: resultByRun.get(run.id) ?? null }))
    .sort((a, b) => (b.result?.updatedAt ?? b.run.createdAt).localeCompare(a.result?.updatedAt ?? a.run.createdAt));
  return {
    testCase,
    project,
    sectionPath: testCase.sectionId ? (sectionPaths(sections).get(testCase.sectionId) ?? null) : null,
    sections,
    history,
    automation,
    automationResults,
  };
}
