import type {
  AutomationResultStatus,
  AutomationRunStatus,
  AutomationStatus,
  AutomationTestStatus,
  AutomationTrigger,
  CaseSource,
  CaseType,
  Environment,
  ExecutionMode,
  FailureCategory,
  Priority,
  ResultStatus,
  ReviewStatus,
  RunnerKind,
  Severity,
  TestRunStatus,
} from "./constants";

export type ISODate = string;

/** Compact record of what the analyzer found, persisted on the project. */
export interface AnalysisSummary {
  analyzedAt: ISODate;
  /** What the site is, in the language used at analysis time (absent on older analyses). */
  siteSummary?: string | null;
  provider: string;
  model: string | null;
  sources: Array<{
    kind: "application" | "repository";
    url: string;
    ok: boolean;
    note: string;
  }>;
  signals: {
    pages: number;
    forms: number;
    inputs: number;
    buttons: number;
    links: number;
    routes: number;
    apiEndpoints: number;
  };
  generatedCount: number;
  warnings: string[];
}

export interface Project {
  id: string;
  key: string;
  name: string;
  description: string | null;
  appUrl: string | null;
  repoUrl: string | null;
  environment: Environment;
  lastAnalysis: AnalysisSummary | null;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export interface Section {
  id: string;
  projectId: string;
  parentId: string | null;
  name: string;
  sortOrder: number;
  createdAt: ISODate;
}

export interface TestCase {
  id: string;
  projectId: string;
  sectionId: string | null;
  caseKey: string;
  title: string;
  description: string | null;
  preconditions: string | null;
  steps: string[];
  expectedResult: string;
  type: CaseType;
  priority: Priority;
  automationStatus: AutomationStatus;
  source: CaseSource;
  reviewStatus: ReviewStatus;
  tags: string[];
  /** Why the AI proposed this case. Only set for AI-generated cases. */
  aiRationale: string | null;
  lastResult: ResultStatus | null;
  lastResultAt: ISODate | null;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export interface TestRun {
  id: string;
  projectId: string;
  name: string;
  environment: Environment;
  build: string | null;
  description: string | null;
  status: TestRunStatus;
  createdBy: string;
  completedAt: ISODate | null;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export interface TestRunCase {
  id: string;
  testRunId: string;
  testCaseId: string;
  sortOrder: number;
  createdAt: ISODate;
}

export interface Evidence {
  screenshotUrl: string | null;
  traceUrl: string | null;
  logUrl: string | null;
  networkLogUrl: string | null;
}

export interface TestResult {
  id: string;
  testRunId: string;
  testCaseId: string;
  status: ResultStatus;
  mode: ExecutionMode;
  actualResult: string | null;
  comment: string | null;
  durationMs: number | null;
  tester: string | null;
  failureCategory: FailureCategory | null;
  severity: Severity | null;
  evidence: Evidence;
  automationResultId: string | null;
  attempts: number;
  executedAt: ISODate | null;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export interface AutomationTest {
  id: string;
  projectId: string;
  testCaseId: string;
  framework: "playwright";
  filePath: string;
  testName: string;
  code: string;
  status: AutomationTestStatus;
  /** Which generator produced the first draft (e.g. "anthropic", "heuristic"). */
  generatedBy: string | null;
  reviewNote: string | null;
  approvedAt: ISODate | null;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export interface AutomationRun {
  id: string;
  projectId: string;
  testRunId: string | null;
  environment: Environment;
  targetUrl: string;
  trigger: AutomationTrigger;
  runner: RunnerKind;
  branch: string | null;
  commitSha: string | null;
  status: AutomationRunStatus;
  testCaseIds: string[];
  externalUrl: string | null;
  error: string | null;
  startedAt: ISODate | null;
  finishedAt: ISODate | null;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export interface FailureAnalysis {
  probableCause: string;
  category: FailureCategory;
  confidence: "low" | "medium" | "high";
  suggestedNextStep: string;
  suggestedRegressionCases: Array<{
    title: string;
    type: CaseType;
    priority: Priority;
    steps: string[];
    expectedResult: string;
  }>;
  provider: string;
  analyzedAt: ISODate;
}

export interface AutomationResult {
  id: string;
  automationRunId: string;
  testCaseId: string;
  automationTestId: string | null;
  status: AutomationResultStatus;
  durationMs: number | null;
  errorMessage: string | null;
  screenshotUrl: string | null;
  traceUrl: string | null;
  logUrl: string | null;
  analysis: FailureAnalysis | null;
  createdAt: ISODate;
}

export interface Activity {
  id: string;
  projectId: string | null;
  actor: string;
  action: string;
  entityType: "project" | "section" | "test_case" | "test_run" | "test_result" | "automation_test" | "automation_run";
  entityId: string | null;
  message: string;
  createdAt: ISODate;
}

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  isDemo: boolean;
}
