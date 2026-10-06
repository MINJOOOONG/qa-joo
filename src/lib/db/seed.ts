import type { Repository } from "./repository";
import type { ServiceContext } from "@/lib/services/context";
import { createProject } from "@/lib/services/projects";
import { createSection } from "@/lib/services/sections";
import { createTestCase } from "@/lib/services/cases";
import { createTestRun, setRunStatus } from "@/lib/services/runs";
import { recordManualResult } from "@/lib/services/results";
import { automationFilePath } from "@/lib/automation/paths";
import type { CaseType, Priority } from "@/lib/domain/constants";

/**
 * Demo workspace for QA JOO, built around ReviewForge (a real side project whose public URL and
 * repository are configurable via DEMO_APP_URL / DEMO_REPO_URL). Only loaded when
 * QA_JOO_DEMO_MODE=true or via `npm run db:seed`. Results recorded here are illustrative.
 */

interface SeedCase {
  section: string;
  title: string;
  type: CaseType;
  priority: Priority;
  preconditions: string;
  steps: string[];
  expectedResult: string;
  tags: string[];
}

const CASES: SeedCase[] = [
  {
    section: "Campaign Analysis/Happy Path",
    title: "Analyze valid campaign URL",
    type: "functional",
    priority: "high",
    preconditions: "User is on the Campaign Analysis page.",
    steps: ["Enter a valid public campaign URL.", "Click Analyze.", "Wait for the analysis response."],
    expectedResult: "Campaign requirements are displayed successfully.",
    tags: ["campaign", "smoke"],
  },
  {
    section: "Campaign Analysis/Negative Cases",
    title: "Reject malformed URL",
    type: "negative",
    priority: "high",
    preconditions: "User is on the Campaign Analysis page.",
    steps: ["Enter `not-a-valid-url` in the Campaign URL field.", "Click the generate button."],
    expectedResult: "An inline error 'Enter a valid public campaign URL.' is shown and no request is sent.",
    tags: ["validation", "url"],
  },
  {
    section: "Campaign Analysis/Security",
    title: "Reject localhost",
    type: "security",
    priority: "high",
    preconditions: "User is on the Campaign Analysis page.",
    steps: ["Enter `http://localhost/brief` as the campaign URL.", "Click the generate button."],
    expectedResult: "The request is rejected with a message that the URL must be reachable from the public internet.",
    tags: ["ssrf", "security"],
  },
  {
    section: "Campaign Analysis/Security",
    title: "Reject private network IP",
    type: "security",
    priority: "high",
    preconditions: "User is on the Campaign Analysis page.",
    steps: ["Enter `http://192.168.0.10/brief` as the campaign URL.", "Click the generate button."],
    expectedResult: "The request is rejected and no outbound request reaches the private address.",
    tags: ["ssrf", "security"],
  },
  {
    section: "Reliability/Error Handling",
    title: "Handle upstream timeout",
    type: "error",
    priority: "medium",
    preconditions: "The campaign page takes longer than the reader timeout to respond.",
    steps: ["Submit a campaign URL whose server delays the response.", "Wait for the reader timeout."],
    expectedResult: "A clear timeout error is shown and the form can be submitted again.",
    tags: ["timeout", "resilience"],
  },
  {
    section: "Review Generation/Functional",
    title: "Generate application text",
    type: "functional",
    priority: "high",
    preconditions: "A campaign brief was analyzed successfully.",
    steps: ["Add applicant highlights.", "Click Create Application Messages.", "Review the generated message."],
    expectedResult: "A personalized application message grounded in the brief is displayed.",
    tags: ["generation"],
  },
  {
    section: "Compliance/Keyword",
    title: "Validate required keywords",
    type: "functional",
    priority: "high",
    preconditions: "A review draft was generated for a campaign with required keywords.",
    steps: ["Open the compliance check.", "Compare required keywords against the draft."],
    expectedResult: "Each required keyword is marked present or missing with its count.",
    tags: ["compliance", "keywords"],
  },
  {
    section: "Compliance/Media Rules",
    title: "Validate required photo count",
    type: "boundary",
    priority: "medium",
    preconditions: "Campaign requires a minimum number of photos.",
    steps: ["Upload one photo fewer than required.", "Generate the review.", "Open the compliance check."],
    expectedResult: "The photo-count rule is flagged as not met; uploading the exact minimum passes.",
    tags: ["compliance", "media", "boundary"],
  },
  {
    section: "Reliability/Error Handling",
    title: "Handle API 500",
    type: "error",
    priority: "high",
    preconditions: "The analysis API returns HTTP 500.",
    steps: ["Submit a valid campaign URL.", "Observe the UI when the API fails."],
    expectedResult: "The pipeline shows a readable error for the failed step instead of hanging.",
    tags: ["api", "resilience"],
  },
  {
    section: "Campaign Analysis/Negative Cases",
    title: "Prevent duplicate submission",
    type: "negative",
    priority: "medium",
    preconditions: "User is on the Campaign Analysis page.",
    steps: ["Enter a valid campaign URL.", "Double-click the generate button quickly."],
    expectedResult: "Only one analysis request is sent and the button is disabled while running.",
    tags: ["idempotency"],
  },
  {
    section: "Campaign Analysis/Security",
    title: "Rate limit repeated requests",
    type: "security",
    priority: "medium",
    preconditions: "Rate limiting is enabled on the analysis API.",
    steps: ["Send more analysis requests than the per-minute limit.", "Inspect the last response."],
    expectedResult: "Requests over the limit receive HTTP 429 with a retry hint.",
    tags: ["rate-limit", "security"],
  },
  {
    section: "Reliability/Error Handling",
    title: "Recover after failed request",
    type: "regression",
    priority: "medium",
    preconditions: "A previous analysis attempt failed.",
    steps: ["Trigger a failing analysis.", "Fix the input and submit again."],
    expectedResult: "The second submission succeeds and stale errors are cleared.",
    tags: ["recovery"],
  },
];

const DRAFTS: SeedCase[] = [
  {
    section: "Campaign Analysis/Negative Cases",
    title: "Preserve form input after a failed analysis",
    type: "negative",
    priority: "low",
    preconditions: "User is on the Campaign Analysis page.",
    steps: ["Fill in the campaign URL and highlights.", "Trigger an analysis error.", "Inspect the form fields."],
    expectedResult: "Previously entered values are kept so the user can retry without retyping.",
    tags: ["ux"],
  },
  {
    section: "Campaign Analysis/Boundary",
    title: "Accept a URL at the maximum supported length",
    type: "boundary",
    priority: "low",
    preconditions: "User is on the Campaign Analysis page.",
    steps: ["Enter a valid URL of exactly 2048 characters.", "Click the generate button."],
    expectedResult: "The URL is accepted by client validation; a 2049-character URL is rejected.",
    tags: ["boundary", "url"],
  },
];

/** Approved Playwright specs for the demo cases. They target the project's Application URL. */
const AUTOMATION: Record<string, string> = {
  "Reject malformed URL": `import { test, expect } from "@playwright/test";

test("Reject malformed URL", async ({ page }) => {
  await page.goto("/");
  await page.locator("#campaign-url").fill("not-a-valid-url");
  await page.locator("button.generate-button").click();
  await expect(page.locator(".form-error")).toContainText("Enter a valid public campaign URL.");
});
`,
  "Reject localhost": `import { test, expect } from "@playwright/test";

test("Reject localhost", async ({ page }) => {
  await page.goto("/");
  await page.locator("#campaign-url").fill("http://localhost/brief");
  await page.locator("button.generate-button").click();
  await expect(page.locator(".pipeline-errors")).toContainText("accessible from the public internet", {
    timeout: 20_000,
  });
});
`,
  "Reject private network IP": `import { test, expect } from "@playwright/test";

test("Reject private network IP", async ({ page }) => {
  await page.goto("/");
  await page.locator("#campaign-url").fill("http://192.168.0.10/brief");
  await page.locator("button.generate-button").click();
  await expect(page.locator(".pipeline-errors")).toContainText("accessible from the public internet", {
    timeout: 20_000,
  });
});
`,
};

export async function seedDemoWorkspace(
  repo: Repository,
  options: { appUrl: string; repoUrl: string },
): Promise<void> {
  const ctx: ServiceContext = { repo, actor: "Demo QA" };
  if (await repo.getProjectByKey("RF")) return;

  const project = await createProject(ctx, {
    name: "ReviewForge",
    key: "RF",
    description:
      "Creator assistant for local experience campaigns: reads a campaign brief, writes the application, and checks the review against the mission.",
    appUrl: options.appUrl,
    repoUrl: options.repoUrl,
    environment: "staging",
  });

  const sectionIds = new Map<string, string>();
  const ensureSection = async (path: string) => {
    let parentId: string | null = null;
    let key = "";
    for (const name of path.split("/")) {
      key = key ? `${key}/${name}` : name;
      const existing = sectionIds.get(key);
      if (existing) {
        parentId = existing;
        continue;
      }
      const section = await createSection(ctx, { projectId: project.id, parentId, name });
      sectionIds.set(key, section.id);
      parentId = section.id;
    }
    return parentId;
  };

  const caseIdByTitle = new Map<string, string>();
  for (const seed of [...CASES, ...DRAFTS]) {
    const isDraft = DRAFTS.includes(seed);
    const testCase = await createTestCase(
      ctx,
      {
        projectId: project.id,
        sectionId: await ensureSection(seed.section),
        title: seed.title,
        preconditions: seed.preconditions,
        steps: seed.steps,
        expectedResult: seed.expectedResult,
        type: seed.type,
        priority: seed.priority,
        tags: seed.tags,
        automationStatus: AUTOMATION[seed.title] ? "candidate" : "manual",
      },
      {
        source: isDraft ? "ai_generated" : "manual",
        reviewStatus: isDraft ? "draft" : "approved",
        aiRationale: isDraft ? "Seeded demo draft. Run Analyze Project to generate real drafts from the app." : null,
        silent: true,
      },
    );
    caseIdByTitle.set(seed.title, testCase.id);
  }

  const now = new Date().toISOString();
  for (const [title, code] of Object.entries(AUTOMATION)) {
    const testCaseId = caseIdByTitle.get(title)!;
    const testCase = (await repo.getTestCase(testCaseId))!;
    await repo.createAutomationTest({
      projectId: project.id,
      testCaseId,
      framework: "playwright",
      filePath: automationFilePath(project.name, testCase.caseKey),
      testName: title,
      code,
      status: "approved",
      generatedBy: "demo-seed",
      reviewNote: "Approved during demo setup.",
      approvedAt: now,
    });
    await repo.updateTestCase(testCaseId, { automationStatus: "automated" });
  }

  const smoke = await createTestRun(ctx, {
    projectId: project.id,
    name: "ReviewForge Smoke v0.8.1",
    environment: "production",
    build: "v0.8.1",
    description: "Post-deploy smoke check (demo data).",
    selection: { mode: "filter", sectionIds: [], types: ["functional"], priorities: ["high"], automationStatuses: [] },
  });
  const smokeCases = await repo.listRunCases(smoke.id);
  for (const rc of smokeCases) {
    await recordManualResult(ctx, { testRunId: smoke.id, testCaseId: rc.testCaseId, status: "passed", durationMs: 95_000 });
  }
  await setRunStatus(ctx, smoke.id, "completed");

  const regression = await createTestRun(ctx, {
    projectId: project.id,
    name: "ReviewForge Release Regression",
    environment: "staging",
    build: "v0.8.2",
    description: "Full regression before the v0.8.2 release (demo data).",
    selection: { mode: "all" },
  });
  const verdicts: Array<[string, Record<string, unknown>]> = [
    ["Analyze valid campaign URL", { status: "passed", durationMs: 132_000 }],
    ["Generate application text", { status: "passed", durationMs: 210_000 }],
    ["Validate required keywords", { status: "passed", durationMs: 88_000 }],
    [
      "Validate required photo count",
      {
        status: "failed",
        durationMs: 154_000,
        failureCategory: "ui",
        severity: "major",
        actualResult: "Demo data: an example failure that illustrates the triage fields.",
        comment: "Illustrative result created by the demo seed.",
      },
    ],
    [
      "Rate limit repeated requests",
      { status: "blocked", comment: "Needs a staging API key with rate limiting enabled (demo data)." },
    ],
  ];
  for (const [title, verdict] of verdicts) {
    await recordManualResult(ctx, { testRunId: regression.id, testCaseId: caseIdByTitle.get(title)!, ...verdict });
  }
}
