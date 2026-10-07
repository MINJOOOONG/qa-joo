import type {
  AutomationResultStatus,
  AutomationRunStatus,
  AutomationStatus,
  AutomationTestStatus,
  CaseSource,
  CaseType,
  Priority,
  ResultStatus,
  ReviewStatus,
  TestRunStatus,
} from "@/lib/domain/constants";
import type {
  Activity,
  AutomationResult,
  AutomationRun,
  AutomationTest,
  Project,
  Section,
  TestCase,
  TestResult,
  TestRun,
  TestRunCase,
} from "@/lib/domain/types";

type Timestamps = "id" | "createdAt" | "updatedAt";

export type NewProject = Omit<Project, Timestamps | "lastAnalysis">;
export type ProjectPatch = Partial<Omit<Project, Timestamps | "key">>;

export type NewSection = Omit<Section, "id" | "createdAt">;
export type SectionPatch = Partial<Pick<Section, "name" | "parentId" | "sortOrder">>;

export type NewTestCase = Omit<TestCase, Timestamps | "lastResult" | "lastResultAt">;
export type TestCasePatch = Partial<Omit<TestCase, Timestamps | "projectId" | "caseKey" | "source">>;

export interface TestCaseFilter {
  projectId?: string;
  sectionId?: string | null;
  ids?: string[];
  types?: CaseType[];
  priorities?: Priority[];
  automationStatuses?: AutomationStatus[];
  lastResults?: Array<ResultStatus>;
  sources?: CaseSource[];
  reviewStatuses?: ReviewStatus[];
  search?: string;
}

export type NewTestRun = Omit<TestRun, Timestamps | "completedAt" | "status">;
export type TestRunPatch = Partial<Pick<TestRun, "name" | "build" | "description" | "status" | "completedAt">>;

export type ResultWrite = Omit<TestResult, Timestamps | "attempts">;

export type NewAutomationTest = Omit<AutomationTest, Timestamps>;
export type AutomationTestPatch = Partial<
  Pick<AutomationTest, "code" | "status" | "filePath" | "testName" | "reviewNote" | "approvedAt" | "generatedBy">
>;

export type NewAutomationRun = Omit<AutomationRun, Timestamps>;
export type AutomationRunPatch = Partial<
  Pick<
    AutomationRun,
    "status" | "branch" | "commitSha" | "externalUrl" | "error" | "startedAt" | "finishedAt"
  >
>;

export type AutomationResultWrite = Omit<AutomationResult, "id" | "createdAt" | "analysis">;

export type NewActivity = Omit<Activity, "id" | "createdAt">;

/**
 * Storage boundary for QA JOO. Two implementations exist:
 * - `MemoryRepository` for demo mode, local use without Supabase, and unit tests
 * - `SupabaseRepository` for Postgres via Supabase
 *
 * Business rules (validation, state transitions, key generation) live in `lib/services`,
 * so both stores behave identically. Implementations only enforce storage constraints
 * (unique keys, foreign keys) and must throw `AppError("conflict")` on unique violations.
 */
export interface Repository {
  readonly kind: "memory" | "supabase";

  listProjects(): Promise<Project[]>;
  getProject(id: string): Promise<Project | null>;
  getProjectByKey(key: string): Promise<Project | null>;
  createProject(input: NewProject): Promise<Project>;
  updateProject(id: string, patch: ProjectPatch): Promise<Project>;
  deleteProject(id: string): Promise<void>;

  listSections(projectId: string): Promise<Section[]>;
  getSection(id: string): Promise<Section | null>;
  createSection(input: NewSection): Promise<Section>;
  updateSection(id: string, patch: SectionPatch): Promise<Section>;
  deleteSection(id: string): Promise<void>;

  listTestCases(filter?: TestCaseFilter): Promise<TestCase[]>;
  getTestCase(id: string): Promise<TestCase | null>;
  /**
   * Highest case-key sequence ever used in the project: the larger of the highest existing key
   * and the project's high-water mark (bumped on every create, never lowered by deletes), so
   * deleted keys are never handed out again. 0 for a project that never had cases.
   */
  highestCaseNumber(projectId: string): Promise<number>;
  /** Normalized titles of generated cases the user deleted; generation never suggests them again. */
  listDismissedCaseTitles(projectId: string): Promise<string[]>;
  /** Remembers dismissed titles (already normalized); duplicates are ignored. */
  addDismissedCaseTitles(projectId: string, normalizedTitles: string[]): Promise<void>;
  createTestCase(input: NewTestCase): Promise<TestCase>;
  updateTestCase(id: string, patch: TestCasePatch): Promise<TestCase>;
  setLastResult(id: string, status: ResultStatus | null, at: string | null): Promise<void>;
  deleteTestCase(id: string): Promise<void>;

  listTestRuns(filter?: { projectId?: string; status?: TestRunStatus }): Promise<TestRun[]>;
  getTestRun(id: string): Promise<TestRun | null>;
  createTestRun(input: NewTestRun, caseIds: string[]): Promise<TestRun>;
  updateTestRun(id: string, patch: TestRunPatch): Promise<TestRun>;
  deleteTestRun(id: string): Promise<void>;
  listRunCases(testRunId: string): Promise<TestRunCase[]>;
  /** Adds cases to a run, ignoring ones already present. Returns how many were added. */
  addRunCases(testRunId: string, caseIds: string[]): Promise<number>;

  listResults(filter: { testRunId?: string; testCaseId?: string; testRunIds?: string[] }): Promise<TestResult[]>;
  getResult(testRunId: string, testCaseId: string): Promise<TestResult | null>;
  /** Insert-or-update keyed on (testRunId, testCaseId); increments `attempts` on update. */
  upsertResult(input: ResultWrite): Promise<TestResult>;

  listAutomationTests(filter?: {
    projectId?: string;
    status?: AutomationTestStatus;
    testCaseIds?: string[];
  }): Promise<AutomationTest[]>;
  getAutomationTest(id: string): Promise<AutomationTest | null>;
  getAutomationTestByCase(testCaseId: string): Promise<AutomationTest | null>;
  createAutomationTest(input: NewAutomationTest): Promise<AutomationTest>;
  updateAutomationTest(id: string, patch: AutomationTestPatch): Promise<AutomationTest>;

  listAutomationRuns(filter?: {
    projectId?: string;
    testRunId?: string;
    statuses?: AutomationRunStatus[];
    limit?: number;
  }): Promise<AutomationRun[]>;
  getAutomationRun(id: string): Promise<AutomationRun | null>;
  createAutomationRun(input: NewAutomationRun): Promise<AutomationRun>;
  updateAutomationRun(id: string, patch: AutomationRunPatch): Promise<AutomationRun>;

  listAutomationResults(filter: {
    automationRunId?: string;
    testCaseId?: string;
    statuses?: AutomationResultStatus[];
    limit?: number;
  }): Promise<AutomationResult[]>;
  getAutomationResult(id: string): Promise<AutomationResult | null>;
  /** Insert-or-update keyed on (automationRunId, testCaseId). */
  upsertAutomationResult(input: AutomationResultWrite): Promise<AutomationResult>;
  setAutomationResultAnalysis(id: string, analysis: AutomationResult["analysis"]): Promise<AutomationResult>;

  listActivities(filter?: { projectId?: string; limit?: number }): Promise<Activity[]>;
  addActivity(input: NewActivity): Promise<Activity>;
}
