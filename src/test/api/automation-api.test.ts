import { beforeEach, describe, expect, it, vi } from "vitest";
import { heuristicAutomationDraft } from "@/lib/ai/automation-generator";
import { signRequest } from "@/lib/automation/runner-auth";
import { MemoryRepository } from "@/lib/db/memory";
import { approveAutomation, generateAutomationForCase } from "@/lib/services/automation";
import { memoryContext, seedCase, seedProject } from "@/test/helpers";

const repo = new MemoryRepository();
vi.mock("@/lib/server-context", () => ({
  getServiceContext: async () => ({ repo, actor: "API Test" }),
  getRunnerContext: async () => ({ repo, actor: "QA JOO Runner" }),
}));
vi.mock("@/lib/security/safe-fetch", () => ({ safeFetch: async () => Promise.reject(new Error("offline")) }));

const { POST: postResults } = await import("@/app/api/automation/results/route");
const { POST: postRuns } = await import("@/app/api/automation/runs/route");
const { GET: getRun } = await import("@/app/api/automation/runs/[id]/route");
const { GET: getManifest } = await import("@/app/api/automation/runs/[id]/manifest/route");
const { POST: postGenerate } = await import("@/app/api/automation/generate/route");

const SECRET = "api-test-secret";
const json = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(`http://localhost${path}`, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
const signed = (path: string, body: unknown) => {
  const raw = JSON.stringify(body);
  return new Request(`http://localhost${path}`, { method: "POST", headers: { "content-type": "application/json", ...signRequest(SECRET, "POST", path, raw) }, body: raw });
};
const params = <T>(value: T) => ({ params: Promise.resolve(value) });

describe("automation API", () => {
  let projectId: string;
  let caseId: string;

  beforeEach(async () => {
    vi.stubEnv("RUNNER_CALLBACK_SECRET", SECRET);
    vi.stubEnv("AUTOMATION_RUNNER", "external");
    vi.stubEnv("ALLOW_PRIVATE_NETWORK_TARGETS", "false");
    const ctx = memoryContext(repo);
    const key = `K${Math.random().toString(36).slice(2, 7).toUpperCase().replace(/[^A-Z0-9]/g, "X")}`;
    const project = await seedProject(ctx, key);
    const testCase = await seedCase(ctx, project.id, { steps: ['Click "Analyze".'] });
    projectId = project.id;
    caseId = testCase.id;
  });

  async function approve() {
    const ctx = memoryContext(repo);
    const { automationTest } = await generateAutomationForCase(ctx, { fetchEntryPage: async () => null, generate: async (i) => heuristicAutomationDraft(i) }, caseId);
    await approveAutomation(ctx, automationTest.id);
  }

  it("POST /api/automation/generate validates input and returns a draft", async () => {
    expect((await postGenerate(json("/api/automation/generate", {}))).status).toBe(422);
    expect((await postGenerate(json("/api/automation/generate", { testCaseId: "missing" }))).status).toBe(404);
    const response = await postGenerate(json("/api/automation/generate", { testCaseId: caseId }));
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.automationTest).toMatchObject({ status: "draft", testCaseId: caseId });
    expect(body.lint.errors).toEqual([]);
  });

  it("POST /api/automation/runs validates and queues runs", async () => {
    expect((await postRuns(json("/api/automation/runs", {}))).status).toBe(422);
    expect((await postRuns(json("/api/automation/runs", { projectId }))).status).toBe(422);
    await approve();
    const response = await postRuns(json("/api/automation/runs", { projectId }));
    expect(response.status).toBe(201);
    const { run } = await response.json();
    expect(run).toMatchObject({ status: "queued", runner: "external", trigger: "manual" });

    const status = await getRun(new Request(`http://localhost/api/automation/runs/${run.id}`), params({ id: run.id }));
    expect(await status.json()).toMatchObject({ run: { id: run.id, status: "queued" }, summary: { total: 1, pending: 1 } });
  });

  it("signed run creation supports github and scheduled triggers", async () => {
    await approve();
    const project = await repo.getProject(projectId);
    const response = await postRuns(signed("/api/automation/runs", { projectKey: project!.key, trigger: "scheduled" }));
    expect(response.status).toBe(201);
    expect((await response.json()).run).toMatchObject({ trigger: "scheduled", runner: "external" });
    const forged = json("/api/automation/runs", { projectKey: project!.key, trigger: "github" }, { "x-qajoo-signature": `v1=${"0".repeat(64)}`, "x-qajoo-timestamp": String(Math.floor(Date.now() / 1000)) });
    expect((await postRuns(forged)).status).toBe(401);
  });

  it("runner endpoints require a valid HMAC signature", async () => {
    await approve();
    const { run } = await (await postRuns(json("/api/automation/runs", { projectId }))).json();
    const manifestPath = `/api/automation/runs/${run.id}/manifest`;
    expect((await getManifest(new Request(`http://localhost${manifestPath}`), params({ id: run.id }))).status).toBe(401);
    const manifest = await getManifest(new Request(`http://localhost${manifestPath}`, { headers: signRequest(SECRET, "GET", manifestPath) }), params({ id: run.id }));
    expect(manifest.status).toBe(200);
    expect((await manifest.json()).tests).toHaveLength(1);

    expect((await postResults(json("/api/automation/results", { automationRunId: run.id, status: "running" }))).status).toBe(401);
    expect((await postResults(signed("/api/automation/results", { automationRunId: run.id, status: "exploded" }))).status).toBe(422);
    expect((await postResults(signed("/api/automation/results", { automationRunId: run.id, results: [{ testCaseId: "nope", status: "passed" }] }))).status).toBe(422);

    const ok = await postResults(signed("/api/automation/results", { automationRunId: run.id, status: "passed", results: [{ testCaseId: caseId, status: "passed", durationMs: 2400 }] }));
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ run: { status: "passed" }, accepted: 1 });
    expect((await postResults(signed("/api/automation/results", { automationRunId: run.id, status: "failed" }))).status).toBe(409);
  });

  it("returns 503 when the runner secret is not configured", async () => {
    vi.stubEnv("RUNNER_CALLBACK_SECRET", "");
    const response = await postResults(signed("/api/automation/results", { automationRunId: "x", status: "running" }));
    expect(response.status).toBe(503);
  });
});
