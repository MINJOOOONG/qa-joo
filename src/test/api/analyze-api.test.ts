import { describe, expect, it, vi } from "vitest";
import type { AppAnalysis } from "@/lib/analyzer/types";
import { MemoryRepository } from "@/lib/db/memory";
import { memoryContext, seedProject } from "@/test/helpers";

const repo = new MemoryRepository();
const app: AppAnalysis = {
  baseUrl: "https://app.example.com",
  mode: "http",
  warnings: [],
  pages: [
    {
      url: "https://app.example.com/",
      path: "/",
      title: "Shop",
      description: null,
      headings: ["Checkout"],
      internalLinks: [],
      navLabels: [],
      buttons: ["Pay"],
      forms: [{ name: "Checkout", action: null, method: "post", submitLabels: ["Pay"], fields: [{ tag: "input", name: "email", label: "Email", type: "email", required: true, placeholder: null, constraints: ["type=email"] }] }],
      looseFields: [],
      textSample: "",
      clientRendered: false,
    },
  ],
};

vi.mock("@/lib/server-context", () => ({ getServiceContext: async () => ({ repo, actor: "API Test" }) }));
vi.mock("@/lib/analyzer/app-analyzer", () => ({ analyzeApplication: async () => app }));
vi.mock("@/lib/analyzer/repo-analyzer", () => ({ analyzeRepository: async () => Promise.reject(new Error("unused")) }));

const { POST } = await import("@/app/api/projects/[id]/analyze/route");
const call = (id: string, body: unknown) =>
  POST(new Request(`http://localhost/api/projects/${id}/analyze`, { method: "POST", body: JSON.stringify(body) }), { params: Promise.resolve({ id }) });

describe("POST /api/projects/:id/analyze (TC generation API)", () => {
  it("validates the request body", async () => {
    const project = await seedProject(memoryContext(repo), "AA");
    expect((await call(project.id, { maxCases: 1000 })).status).toBe(422);
    expect((await call(project.id, { maxCases: "abc" })).status).toBe(422);
    expect((await call(project.id, { focus: "x".repeat(600) })).status).toBe(422);
    const malformed = await POST(new Request("http://localhost/api/projects/x/analyze", { method: "POST", body: "{not json" }), { params: Promise.resolve({ id: project.id }) });
    expect(malformed.status).toBe(400);
  });

  it("returns 404 for unknown projects", async () => {
    expect((await call("missing", {})).status).toBe(404);
  });

  it("creates AI drafts and returns the analysis summary", async () => {
    const project = await seedProject(memoryContext(repo), "BB");
    const response = await call(project.id, { maxCases: 6, focus: "checkout validation" });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.created).toBeGreaterThan(0);
    expect(body.created).toBeLessThanOrEqual(6);
    expect(body.summary).toMatchObject({ provider: "heuristic", signals: { forms: 1 } });
    const drafts = await repo.listTestCases({ projectId: project.id, reviewStatuses: ["draft"] });
    expect(drafts).toHaveLength(body.created);
    expect(drafts.some((c) => c.type === "negative" && c.title.includes("Email"))).toBe(true);
  });
});
