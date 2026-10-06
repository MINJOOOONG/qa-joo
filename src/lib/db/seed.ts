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
  /** Stable internal id used to attach specs and demo results (titles are Korean display text). */
  id: string;
  section: string;
  title: string;
  type: CaseType;
  priority: Priority;
  preconditions: string;
  steps: string[];
  expectedResult: string;
  tags: string[];
}

const ON_ANALYSIS_PAGE = "사용자가 캠페인 분석 페이지에 있다.";

const CASES: SeedCase[] = [
  {
    id: "analyze-valid-url",
    section: "캠페인 분석/정상 흐름",
    title: "유효한 캠페인 URL 분석",
    type: "functional",
    priority: "high",
    preconditions: ON_ANALYSIS_PAGE,
    steps: ["공개된 유효한 캠페인 URL을 입력한다.", "\"Analyze\" 버튼을 클릭한다.", "분석 응답을 기다린다."],
    expectedResult: "캠페인 요구사항이 정상적으로 표시된다.",
    tags: ["campaign", "smoke"],
  },
  {
    id: "reject-malformed-url",
    section: "캠페인 분석/부정 케이스",
    title: "잘못된 형식의 URL 입력 시 거부",
    type: "negative",
    priority: "high",
    preconditions: ON_ANALYSIS_PAGE,
    steps: ["\"Campaign URL\"에 \"not-a-valid-url\"을 입력한다.", "생성 버튼을 클릭한다."],
    expectedResult: "입력란에 'Enter a valid public campaign URL.' 오류가 표시되고 요청이 전송되지 않는다.",
    tags: ["validation", "url"],
  },
  {
    id: "reject-localhost",
    section: "캠페인 분석/보안",
    title: "localhost URL 입력 시 거부",
    type: "security",
    priority: "high",
    preconditions: ON_ANALYSIS_PAGE,
    steps: ["\"Campaign URL\"에 \"http://localhost/brief\"을 입력한다.", "생성 버튼을 클릭한다."],
    expectedResult: "공개 인터넷에서 접근 가능한 URL이어야 한다는 메시지와 함께 요청이 거부된다.",
    tags: ["ssrf", "security"],
  },
  {
    id: "reject-private-ip",
    section: "캠페인 분석/보안",
    title: "사설망 IP URL 입력 시 거부",
    type: "security",
    priority: "high",
    preconditions: ON_ANALYSIS_PAGE,
    steps: ["\"Campaign URL\"에 \"http://192.168.0.10/brief\"을 입력한다.", "생성 버튼을 클릭한다."],
    expectedResult: "요청이 거부되고 사설 주소로는 어떤 외부 요청도 나가지 않는다.",
    tags: ["ssrf", "security"],
  },
  {
    id: "upstream-timeout",
    section: "안정성/오류 처리",
    title: "외부 서비스 타임아웃 처리",
    type: "error",
    priority: "medium",
    preconditions: "캠페인 페이지의 응답이 리더 타임아웃보다 오래 걸린다.",
    steps: ["응답을 지연시키는 서버의 캠페인 URL을 제출한다.", "리더 타임아웃이 날 때까지 기다린다."],
    expectedResult: "명확한 타임아웃 오류가 표시되고 폼을 다시 제출할 수 있다.",
    tags: ["timeout", "resilience"],
  },
  {
    id: "generate-application",
    section: "후기 생성/기능",
    title: "신청 문구 생성",
    type: "functional",
    priority: "high",
    preconditions: "캠페인 브리프 분석이 성공한 상태다.",
    steps: ["신청자 강점을 추가한다.", "\"Create Application Messages\" 버튼을 클릭한다.", "생성된 문구를 확인한다."],
    expectedResult: "브리프 내용을 근거로 한 맞춤 신청 문구가 표시된다.",
    tags: ["generation"],
  },
  {
    id: "required-keywords",
    section: "미션 검수/키워드",
    title: "필수 키워드 포함 여부 검증",
    type: "functional",
    priority: "high",
    preconditions: "필수 키워드가 있는 캠페인의 후기 초안이 생성된 상태다.",
    steps: ["미션 검수 화면을 연다.", "필수 키워드와 초안을 비교한다."],
    expectedResult: "각 필수 키워드가 포함/누락으로 표시되고 등장 횟수가 함께 나온다.",
    tags: ["compliance", "keywords"],
  },
  {
    id: "photo-count",
    section: "미션 검수/사진 규칙",
    title: "필수 사진 개수 검증",
    type: "boundary",
    priority: "medium",
    preconditions: "캠페인에 최소 사진 개수 조건이 있다.",
    steps: ["필요한 개수보다 한 장 적게 사진을 업로드한다.", "후기를 생성한다.", "미션 검수 화면을 연다."],
    expectedResult: "사진 개수 규칙이 미충족으로 표시되고, 정확히 최소 개수를 올리면 통과한다.",
    tags: ["compliance", "media", "boundary"],
  },
  {
    id: "api-500",
    section: "안정성/오류 처리",
    title: "API 500 오류 처리",
    type: "error",
    priority: "high",
    preconditions: "분석 API가 HTTP 500을 반환한다.",
    steps: ["유효한 캠페인 URL을 제출한다.", "API가 실패할 때 화면 동작을 관찰한다."],
    expectedResult: "멈춰 있지 않고 실패한 단계에 대해 읽기 쉬운 오류가 표시된다.",
    tags: ["api", "resilience"],
  },
  {
    id: "duplicate-submit",
    section: "캠페인 분석/부정 케이스",
    title: "중복 제출 방지",
    type: "negative",
    priority: "medium",
    preconditions: ON_ANALYSIS_PAGE,
    steps: ["유효한 캠페인 URL을 입력한다.", "생성 버튼을 빠르게 두 번 클릭한다."],
    expectedResult: "분석 요청은 한 번만 전송되고 실행 중에는 버튼이 비활성화된다.",
    tags: ["idempotency"],
  },
  {
    id: "rate-limit",
    section: "캠페인 분석/보안",
    title: "반복 요청 속도 제한",
    type: "security",
    priority: "medium",
    preconditions: "분석 API에 속도 제한이 활성화되어 있다.",
    steps: ["분당 한도보다 많은 분석 요청을 보낸다.", "마지막 응답을 확인한다."],
    expectedResult: "한도를 넘은 요청은 재시도 안내와 함께 HTTP 429를 받는다.",
    tags: ["rate-limit", "security"],
  },
  {
    id: "recover-after-failure",
    section: "안정성/오류 처리",
    title: "요청 실패 후 복구",
    type: "regression",
    priority: "medium",
    preconditions: "이전 분석 시도가 실패한 상태다.",
    steps: ["실패하는 분석을 실행한다.", "입력을 고쳐 다시 제출한다."],
    expectedResult: "두 번째 제출이 성공하고 이전 오류 메시지가 사라진다.",
    tags: ["recovery"],
  },
];

const DRAFTS: SeedCase[] = [
  {
    id: "keep-input-after-failure",
    section: "캠페인 분석/부정 케이스",
    title: "분석 실패 후 입력값 유지",
    type: "negative",
    priority: "low",
    preconditions: ON_ANALYSIS_PAGE,
    steps: ["캠페인 URL과 강점을 입력한다.", "분석 오류를 발생시킨다.", "입력 필드를 확인한다."],
    expectedResult: "입력했던 값이 유지되어 다시 입력하지 않고 재시도할 수 있다.",
    tags: ["ux"],
  },
  {
    id: "max-length-url",
    section: "캠페인 분석/경계값",
    title: "최대 길이 URL 허용",
    type: "boundary",
    priority: "low",
    preconditions: ON_ANALYSIS_PAGE,
    steps: ["길이가 정확히 2048자인 유효한 URL을 입력한다.", "생성 버튼을 클릭한다."],
    expectedResult: "클라이언트 검증에서 URL이 허용되고, 2049자 URL은 거부된다.",
    tags: ["boundary", "url"],
  },
];

/** Approved Playwright specs for the demo cases. They target the project's Application URL. */
const AUTOMATION: Record<string, string> = {
  "reject-malformed-url": `import { test, expect } from "@playwright/test";

test("잘못된 형식의 URL 입력 시 거부", async ({ page }) => {
  await page.goto("/");
  await page.locator("#campaign-url").fill("not-a-valid-url");
  await page.locator("button.generate-button").click();
  await expect(page.locator(".form-error")).toContainText("Enter a valid public campaign URL.");
});
`,
  "reject-localhost": `import { test, expect } from "@playwright/test";

test("localhost URL 입력 시 거부", async ({ page }) => {
  await page.goto("/");
  await page.locator("#campaign-url").fill("http://localhost/brief");
  await page.locator("button.generate-button").click();
  await expect(page.locator(".pipeline-errors")).toContainText("accessible from the public internet", {
    timeout: 20_000,
  });
});
`,
  "reject-private-ip": `import { test, expect } from "@playwright/test";

test("사설망 IP URL 입력 시 거부", async ({ page }) => {
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

  const caseIdById = new Map<string, string>();
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
        automationStatus: AUTOMATION[seed.id] ? "candidate" : "manual",
      },
      {
        source: isDraft ? "ai_generated" : "manual",
        reviewStatus: isDraft ? "draft" : "approved",
        aiRationale: isDraft ? "데모용 AI 초안입니다. Analyze Project를 실행하면 실제 앱에서 초안을 생성합니다." : null,
        silent: true,
      },
    );
    caseIdById.set(seed.id, testCase.id);
  }

  const now = new Date().toISOString();
  for (const [id, code] of Object.entries(AUTOMATION)) {
    const testCaseId = caseIdById.get(id)!;
    const testCase = (await repo.getTestCase(testCaseId))!;
    await repo.createAutomationTest({
      projectId: project.id,
      testCaseId,
      framework: "playwright",
      filePath: automationFilePath(project.name, testCase.caseKey),
      testName: testCase.title,
      code,
      status: "approved",
      generatedBy: "demo-seed",
      reviewNote: "데모 설정 중 승인됨.",
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
    ["analyze-valid-url", { status: "passed", durationMs: 132_000 }],
    ["generate-application", { status: "passed", durationMs: 210_000 }],
    ["required-keywords", { status: "passed", durationMs: 88_000 }],
    [
      "photo-count",
      {
        status: "failed",
        durationMs: 154_000,
        failureCategory: "ui",
        severity: "major",
        actualResult: "데모 데이터: 실패 분류 항목을 보여주기 위한 예시 실패입니다.",
        comment: "데모 시드가 만든 예시 결과입니다.",
      },
    ],
    [
      "rate-limit",
      { status: "blocked", comment: "속도 제한이 켜진 스테이징 API 키가 필요합니다 (데모 데이터)." },
    ],
  ];
  for (const [id, verdict] of verdicts) {
    await recordManualResult(ctx, { testRunId: regression.id, testCaseId: caseIdById.get(id)!, ...verdict });
  }
}
