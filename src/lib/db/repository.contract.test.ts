import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { MemoryRepository } from "./memory";
import type { Repository } from "./repository";
import { SupabaseRepository } from "./supabase";

/**
 * Both storage implementations must behave the same. The memory store always runs; the
 * Supabase store runs when SUPABASE_TEST_URL and SUPABASE_TEST_SERVICE_ROLE_KEY point at a
 * database with the migrations applied (see scripts/supabase-contract.sh).
 */
const targets: Array<[string, () => Repository]> = [["memory", () => new MemoryRepository()]];
if (process.env.SUPABASE_TEST_URL && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY) {
  targets.push(["supabase", () => new SupabaseRepository(process.env.SUPABASE_TEST_URL!, process.env.SUPABASE_TEST_SERVICE_ROLE_KEY!)]);
}

const uniqueKey = () => `C${randomUUID().replace(/[^A-Z0-9]/gi, "").slice(0, 7).toUpperCase()}`;

describe.each(targets)("%s repository contract", (_name, make) => {
  const repo = make();
  const created: string[] = [];

  afterAll(async () => {
    for (const id of created) await repo.deleteProject(id).catch(() => undefined);
  });

  async function project() {
    const p = await repo.createProject({
      key: uniqueKey(),
      name: "Contract",
      description: null,
      appUrl: "https://app.example.com",
      repoUrl: null,
      environment: "staging",
    });
    created.push(p.id);
    return p;
  }

  async function testCase(projectId: string, caseKey: string, overrides: Record<string, unknown> = {}) {
    return repo.createTestCase({
      projectId,
      sectionId: null,
      caseKey,
      title: `Case ${caseKey}`,
      description: null,
      preconditions: null,
      steps: ["Open the page", "Click submit"],
      expectedResult: "It works",
      type: "functional",
      priority: "high",
      automationStatus: "manual",
      source: "manual",
      reviewStatus: "approved",
      tags: ["smoke"],
      aiRationale: null,
      ...overrides,
    });
  }

  it("creates, reads and updates projects; keys are unique", async () => {
    const p = await project();
    expect(await repo.getProjectByKey(p.key.toLowerCase())).toMatchObject({ id: p.id, lastAnalysis: null });
    await expect(repo.createProject({ key: p.key, name: "Dup", description: null, appUrl: "https://x.dev", repoUrl: null, environment: "local" })).rejects.toMatchObject({ code: "conflict" });
    const summary = { analyzedAt: "2026-01-01T00:00:00.000Z", provider: "heuristic", model: null, sources: [], signals: { pages: 1, forms: 0, inputs: 0, buttons: 0, links: 0, routes: 0, apiEndpoints: 0 }, generatedCount: 3, warnings: [] };
    const updated = await repo.updateProject(p.id, { name: "Renamed", lastAnalysis: summary });
    expect(updated).toMatchObject({ name: "Renamed", key: p.key, appUrl: "https://app.example.com", lastAnalysis: { generatedCount: 3 } });
  });

  it("stores hierarchical sections and filters test cases", async () => {
    const p = await project();
    const parent = await repo.createSection({ projectId: p.id, parentId: null, name: "Campaign", sortOrder: 1 });
    const child = await repo.createSection({ projectId: p.id, parentId: parent.id, name: "Negative", sortOrder: 1 });
    expect((await repo.listSections(p.id)).map((s) => s.name)).toEqual(["Campaign", "Negative"]);
    const a = await testCase(p.id, `${p.key}-TC-001`, { sectionId: child.id, type: "negative", title: "Reject malformed URL" });
    const b = await testCase(p.id, `${p.key}-TC-002`, { source: "ai_generated", reviewStatus: "draft", tags: [] });
    await testCase(p.id, `${p.key}-TC-010`);
    await expect(testCase(p.id, `${p.key}-TC-001`)).rejects.toMatchObject({ code: "conflict" });

    expect((await repo.listTestCases({ projectId: p.id })).map((c) => c.caseKey)).toEqual([`${p.key}-TC-001`, `${p.key}-TC-002`, `${p.key}-TC-010`]);
    expect((await repo.listTestCases({ projectId: p.id, types: ["negative"] })).map((c) => c.id)).toEqual([a.id]);
    expect((await repo.listTestCases({ projectId: p.id, reviewStatuses: ["draft"] })).map((c) => c.id)).toEqual([b.id]);
    expect((await repo.listTestCases({ projectId: p.id, sectionId: null })).length).toBe(2);
    expect((await repo.listTestCases({ projectId: p.id, search: "malformed" })).map((c) => c.id)).toEqual([a.id]);
    expect((await repo.listTestCases({ projectId: p.id, search: "100%_,()" })).length).toBe(0);
    const special = await testCase(p.id, `${p.key}-TC-011`, { title: 'Accept 100% "quoted" (beta), a_b' });
    expect((await repo.listTestCases({ projectId: p.id, search: '100% "quoted" (beta), a_b' })).map((c) => c.id)).toEqual([special.id]);
    expect((await repo.listTestCases({ projectId: p.id, search: "a%b" })).length).toBe(0);
    await repo.deleteTestCase(special.id);
    expect((await repo.listTestCases({ ids: [] })).length).toBe(0);

    await repo.setLastResult(a.id, "failed", new Date().toISOString());
    expect((await repo.listTestCases({ projectId: p.id, lastResults: ["failed"] })).map((c) => c.id)).toEqual([a.id]);
    expect((await repo.listTestCases({ projectId: p.id, lastResults: ["untested"] })).length).toBe(2);
    expect(await repo.highestCaseNumber(p.id)).toBe(10);
    expect(await repo.getTestCase("not-a-uuid")).toBeNull();

    await repo.deleteSection(child.id);
    expect((await repo.getTestCase(a.id))?.sectionId).toBeNull();
    const patched = await repo.updateTestCase(a.id, { steps: ["Only step"], tags: ["x", "y"], description: "desc" });
    expect(patched).toMatchObject({ steps: ["Only step"], tags: ["x", "y"], description: "desc", caseKey: `${p.key}-TC-001` });
  });

  it("keeps one result per run and case, counting attempts", async () => {
    const p = await project();
    const c1 = await testCase(p.id, `${p.key}-TC-001`);
    const c2 = await testCase(p.id, `${p.key}-TC-002`);
    const run = await repo.createTestRun({ projectId: p.id, name: "Run", environment: "staging", build: "v1", description: null, createdBy: "QA" }, [c1.id, c1.id]);
    expect(await repo.listRunCases(run.id)).toHaveLength(1);
    expect(await repo.addRunCases(run.id, [c1.id, c2.id])).toBe(1);
    expect((await repo.listRunCases(run.id)).map((rc) => rc.sortOrder)).toEqual([1, 2]);

    const write = {
      testRunId: run.id,
      testCaseId: c1.id,
      status: "passed" as const,
      mode: "manual" as const,
      actualResult: null,
      comment: null,
      durationMs: 1200,
      tester: "QA",
      failureCategory: null,
      severity: null,
      evidence: { screenshotUrl: null, traceUrl: null, logUrl: null, networkLogUrl: null },
      automationResultId: null,
      executedAt: new Date().toISOString(),
    };
    expect((await repo.upsertResult(write)).attempts).toBe(1);
    const second = await repo.upsertResult({ ...write, status: "failed", failureCategory: "ui", severity: "major", actualResult: "broken" });
    expect(second).toMatchObject({ attempts: 2, status: "failed", failureCategory: "ui" });
    expect(await repo.listResults({ testRunId: run.id })).toHaveLength(1);
    expect(await repo.listResults({ testRunIds: [] })).toHaveLength(0);

    const completed = await repo.updateTestRun(run.id, { status: "completed", completedAt: new Date().toISOString() });
    expect(completed.status).toBe("completed");
    await repo.deleteTestCase(c1.id);
    expect(await repo.listResults({ testRunId: run.id })).toHaveLength(0);
    expect(await repo.listRunCases(run.id)).toHaveLength(1);
  });

  it("stores automation specs, runs, results and analysis", async () => {
    const p = await project();
    const c1 = await testCase(p.id, `${p.key}-TC-001`);
    const spec = await repo.createAutomationTest({
      projectId: p.id,
      testCaseId: c1.id,
      framework: "playwright",
      filePath: `tests/contract/${p.key}-TC-001.spec.ts`,
      testName: "spec",
      code: "test()",
      status: "draft",
      generatedBy: "heuristic",
      reviewNote: null,
      approvedAt: null,
    });
    await expect(repo.createAutomationTest({ ...spec, status: "draft" })).rejects.toMatchObject({ code: "conflict" });
    const approved = await repo.updateAutomationTest(spec.id, { status: "approved", approvedAt: new Date().toISOString() });
    expect(approved.status).toBe("approved");
    expect((await repo.listAutomationTests({ projectId: p.id, status: "approved", testCaseIds: [c1.id] })).map((t) => t.id)).toEqual([spec.id]);
    expect(await repo.listAutomationTests({ testCaseIds: [] })).toHaveLength(0);

    const run = await repo.createAutomationRun({
      projectId: p.id,
      testRunId: null,
      environment: "staging",
      targetUrl: "https://app.example.com",
      trigger: "manual",
      runner: "external",
      branch: null,
      commitSha: null,
      status: "queued",
      testCaseIds: [c1.id],
      externalUrl: null,
      error: null,
      startedAt: null,
      finishedAt: null,
    });
    expect((await repo.updateAutomationRun(run.id, { status: "running", commitSha: "abcdef1" })).status).toBe("running");
    const write = { automationRunId: run.id, testCaseId: c1.id, automationTestId: spec.id, status: "failed" as const, durationMs: 900, errorMessage: "boom", screenshotUrl: null, traceUrl: null, logUrl: null };
    const first = await repo.upsertAutomationResult(write);
    const analysis = { probableCause: "x", category: "ui" as const, confidence: "low" as const, suggestedNextStep: "y", suggestedRegressionCases: [], provider: "heuristic", analyzedAt: "now" };
    expect((await repo.setAutomationResultAnalysis(first.id, analysis)).analysis).toMatchObject({ category: "ui" });
    const again = await repo.upsertAutomationResult({ ...write, status: "passed", errorMessage: null });
    expect(again).toMatchObject({ id: first.id, status: "passed", analysis: null });
    expect(await repo.listAutomationResults({ automationRunId: run.id, statuses: ["passed"] })).toHaveLength(1);
    expect((await repo.listAutomationRuns({ projectId: p.id, statuses: ["running"] })).map((r) => r.id)).toEqual([run.id]);
  });

  it("logs activity and cascades project deletion", async () => {
    const p = await project();
    const c1 = await testCase(p.id, `${p.key}-TC-001`);
    await repo.addActivity({ projectId: p.id, actor: "QA", action: "test", entityType: "test_case", entityId: c1.id, message: "hello" });
    expect((await repo.listActivities({ projectId: p.id, limit: 5 }))[0]).toMatchObject({ message: "hello", entityId: c1.id });
    await repo.deleteProject(p.id);
    expect(await repo.getProject(p.id)).toBeNull();
    expect(await repo.getTestCase(c1.id)).toBeNull();
    const orphaned = await repo.listActivities({ limit: 50 });
    expect(orphaned.find((a) => a.message === "hello")?.projectId ?? null).toBeNull();
  });
});
