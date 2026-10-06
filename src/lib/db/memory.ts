import { AppError, notFound } from "@/lib/errors";
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
import { caseKeyNumber } from "@/lib/domain/case-key";
import type {
  AutomationResultWrite,
  AutomationRunPatch,
  AutomationTestPatch,
  NewActivity,
  NewAutomationRun,
  NewAutomationTest,
  NewProject,
  NewSection,
  NewTestCase,
  NewTestRun,
  ProjectPatch,
  Repository,
  ResultWrite,
  SectionPatch,
  TestCaseFilter,
  TestCasePatch,
  TestRunPatch,
} from "./repository";

export interface MemoryData {
  projects: Project[];
  sections: Section[];
  testCases: TestCase[];
  testRuns: TestRun[];
  testRunCases: TestRunCase[];
  testResults: TestResult[];
  automationTests: AutomationTest[];
  automationRuns: AutomationRun[];
  automationResults: AutomationResult[];
  activities: Activity[];
}

export function emptyMemoryData(): MemoryData {
  return {
    projects: [],
    sections: [],
    testCases: [],
    testRuns: [],
    testRunCases: [],
    testResults: [],
    automationTests: [],
    automationRuns: [],
    automationResults: [],
    activities: [],
  };
}

const clone = <T>(value: T): T => structuredClone(value);
const newId = () => crypto.randomUUID();

/**
 * Timestamps are strictly increasing so that "latest first" ordering is stable even when
 * several writes land in the same millisecond (common in tests and seeding).
 */
let lastTimestamp = 0;
function now(): string {
  const current = Math.max(Date.now(), lastTimestamp + 1);
  lastTimestamp = current;
  return new Date(current).toISOString();
}

function byNewest<T extends { createdAt: string }>(a: T, b: T): number {
  return b.createdAt.localeCompare(a.createdAt);
}

export class MemoryRepository implements Repository {
  readonly kind = "memory" as const;
  private data: MemoryData;
  private readonly onChange?: (data: MemoryData) => void;

  constructor(initial: MemoryData = emptyMemoryData(), onChange?: (data: MemoryData) => void) {
    this.data = initial;
    this.onChange = onChange;
  }

  /** Read-only snapshot, used for persistence and tests. */
  snapshot(): MemoryData {
    return clone(this.data);
  }

  private commit() {
    this.onChange?.(this.data);
  }

  // Projects ---------------------------------------------------------------

  async listProjects() {
    return clone([...this.data.projects].sort((a, b) => a.name.localeCompare(b.name)));
  }

  async getProject(id: string) {
    return clone(this.data.projects.find((p) => p.id === id) ?? null);
  }

  async getProjectByKey(key: string) {
    return clone(this.data.projects.find((p) => p.key === key.toUpperCase()) ?? null);
  }

  async createProject(input: NewProject) {
    if (this.data.projects.some((p) => p.key === input.key)) {
      throw new AppError("conflict", `Project key ${input.key} is already in use.`);
    }
    const timestamp = now();
    const project: Project = { ...input, id: newId(), lastAnalysis: null, createdAt: timestamp, updatedAt: timestamp };
    this.data.projects.push(project);
    this.commit();
    return clone(project);
  }

  async updateProject(id: string, patch: ProjectPatch) {
    const project = this.data.projects.find((p) => p.id === id);
    if (!project) throw notFound("Project", id);
    Object.assign(project, patch, { updatedAt: now() });
    this.commit();
    return clone(project);
  }

  async deleteProject(id: string) {
    const caseIds = new Set(this.data.testCases.filter((c) => c.projectId === id).map((c) => c.id));
    const runIds = new Set(this.data.testRuns.filter((r) => r.projectId === id).map((r) => r.id));
    const automationRunIds = new Set(
      this.data.automationRuns.filter((r) => r.projectId === id).map((r) => r.id),
    );
    this.data.projects = this.data.projects.filter((p) => p.id !== id);
    this.data.sections = this.data.sections.filter((s) => s.projectId !== id);
    this.data.testCases = this.data.testCases.filter((c) => c.projectId !== id);
    this.data.testRuns = this.data.testRuns.filter((r) => r.projectId !== id);
    this.data.testRunCases = this.data.testRunCases.filter((rc) => !runIds.has(rc.testRunId));
    this.data.testResults = this.data.testResults.filter((r) => !runIds.has(r.testRunId));
    this.data.automationTests = this.data.automationTests.filter((t) => !caseIds.has(t.testCaseId));
    this.data.automationRuns = this.data.automationRuns.filter((r) => r.projectId !== id);
    this.data.automationResults = this.data.automationResults.filter(
      (r) => !automationRunIds.has(r.automationRunId),
    );
    for (const activity of this.data.activities) {
      if (activity.projectId === id) activity.projectId = null;
    }
    this.commit();
  }

  // Sections ---------------------------------------------------------------

  async listSections(projectId: string) {
    return clone(
      this.data.sections
        .filter((s) => s.projectId === projectId)
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    );
  }

  async getSection(id: string) {
    return clone(this.data.sections.find((s) => s.id === id) ?? null);
  }

  async createSection(input: NewSection) {
    const section: Section = { ...input, id: newId(), createdAt: now() };
    this.data.sections.push(section);
    this.commit();
    return clone(section);
  }

  async updateSection(id: string, patch: SectionPatch) {
    const section = this.data.sections.find((s) => s.id === id);
    if (!section) throw notFound("Section", id);
    Object.assign(section, patch);
    this.commit();
    return clone(section);
  }

  async deleteSection(id: string) {
    this.data.sections = this.data.sections.filter((s) => s.id !== id);
    for (const section of this.data.sections) {
      if (section.parentId === id) section.parentId = null;
    }
    for (const testCase of this.data.testCases) {
      if (testCase.sectionId === id) testCase.sectionId = null;
    }
    this.commit();
  }

  // Test cases -------------------------------------------------------------

  async listTestCases(filter: TestCaseFilter = {}) {
    const search = filter.search?.trim().toLowerCase();
    const ids = filter.ids ? new Set(filter.ids) : null;
    const rows = this.data.testCases.filter((c) => {
      if (filter.projectId && c.projectId !== filter.projectId) return false;
      if (filter.sectionId !== undefined && c.sectionId !== filter.sectionId) return false;
      if (ids && !ids.has(c.id)) return false;
      if (filter.types?.length && !filter.types.includes(c.type)) return false;
      if (filter.priorities?.length && !filter.priorities.includes(c.priority)) return false;
      if (filter.automationStatuses?.length && !filter.automationStatuses.includes(c.automationStatus)) return false;
      if (filter.sources?.length && !filter.sources.includes(c.source)) return false;
      if (filter.reviewStatuses?.length && !filter.reviewStatuses.includes(c.reviewStatus)) return false;
      if (filter.lastResults?.length && !filter.lastResults.includes(c.lastResult ?? "untested")) return false;
      if (search && !`${c.caseKey} ${c.title}`.toLowerCase().includes(search)) return false;
      return true;
    });
    rows.sort(
      (a, b) =>
        a.projectId.localeCompare(b.projectId) || caseKeyNumber(a.caseKey) - caseKeyNumber(b.caseKey),
    );
    return clone(rows);
  }

  async getTestCase(id: string) {
    return clone(this.data.testCases.find((c) => c.id === id) ?? null);
  }

  async listCaseKeys(projectId: string) {
    return this.data.testCases.filter((c) => c.projectId === projectId).map((c) => c.caseKey);
  }

  async createTestCase(input: NewTestCase) {
    if (this.data.testCases.some((c) => c.projectId === input.projectId && c.caseKey === input.caseKey)) {
      throw new AppError("conflict", `Case key ${input.caseKey} already exists in this project.`);
    }
    const timestamp = now();
    const testCase: TestCase = {
      ...input,
      id: newId(),
      lastResult: null,
      lastResultAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.data.testCases.push(testCase);
    this.commit();
    return clone(testCase);
  }

  async updateTestCase(id: string, patch: TestCasePatch) {
    const testCase = this.data.testCases.find((c) => c.id === id);
    if (!testCase) throw notFound("Test case", id);
    Object.assign(testCase, patch, { updatedAt: now() });
    this.commit();
    return clone(testCase);
  }

  async setLastResult(id: string, status: TestCase["lastResult"], at: string | null) {
    const testCase = this.data.testCases.find((c) => c.id === id);
    if (!testCase) return;
    testCase.lastResult = status;
    testCase.lastResultAt = at;
    this.commit();
  }

  async deleteTestCase(id: string) {
    const automationTestIds = new Set(
      this.data.automationTests.filter((t) => t.testCaseId === id).map((t) => t.id),
    );
    this.data.testCases = this.data.testCases.filter((c) => c.id !== id);
    this.data.testRunCases = this.data.testRunCases.filter((rc) => rc.testCaseId !== id);
    this.data.testResults = this.data.testResults.filter((r) => r.testCaseId !== id);
    this.data.automationTests = this.data.automationTests.filter((t) => !automationTestIds.has(t.id));
    this.data.automationResults = this.data.automationResults.filter((r) => r.testCaseId !== id);
    this.commit();
  }

  // Test runs --------------------------------------------------------------

  async listTestRuns(filter: { projectId?: string; status?: TestRun["status"] } = {}) {
    return clone(
      this.data.testRuns
        .filter((r) => (!filter.projectId || r.projectId === filter.projectId) && (!filter.status || r.status === filter.status))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    );
  }

  async getTestRun(id: string) {
    return clone(this.data.testRuns.find((r) => r.id === id) ?? null);
  }

  async createTestRun(input: NewTestRun, caseIds: string[]) {
    const timestamp = now();
    const run: TestRun = {
      ...input,
      id: newId(),
      status: "active",
      completedAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.data.testRuns.push(run);
    await this.addRunCases(run.id, caseIds);
    this.commit();
    return clone(run);
  }

  async updateTestRun(id: string, patch: TestRunPatch) {
    const run = this.data.testRuns.find((r) => r.id === id);
    if (!run) throw notFound("Test run", id);
    Object.assign(run, patch, { updatedAt: now() });
    this.commit();
    return clone(run);
  }

  async deleteTestRun(id: string) {
    this.data.testRuns = this.data.testRuns.filter((r) => r.id !== id);
    this.data.testRunCases = this.data.testRunCases.filter((rc) => rc.testRunId !== id);
    this.data.testResults = this.data.testResults.filter((r) => r.testRunId !== id);
    for (const automationRun of this.data.automationRuns) {
      if (automationRun.testRunId === id) automationRun.testRunId = null;
    }
    this.commit();
  }

  async listRunCases(testRunId: string) {
    return clone(
      this.data.testRunCases.filter((rc) => rc.testRunId === testRunId).sort((a, b) => a.sortOrder - b.sortOrder),
    );
  }

  async addRunCases(testRunId: string, caseIds: string[]) {
    const existing = this.data.testRunCases.filter((rc) => rc.testRunId === testRunId);
    const present = new Set(existing.map((rc) => rc.testCaseId));
    let sortOrder = existing.reduce((max, rc) => Math.max(max, rc.sortOrder), 0);
    let added = 0;
    for (const testCaseId of caseIds) {
      if (present.has(testCaseId)) continue;
      present.add(testCaseId);
      sortOrder += 1;
      added += 1;
      this.data.testRunCases.push({ id: newId(), testRunId, testCaseId, sortOrder, createdAt: now() });
    }
    if (added) this.commit();
    return added;
  }

  // Results ----------------------------------------------------------------

  async listResults(filter: { testRunId?: string; testCaseId?: string; testRunIds?: string[] }) {
    const runIds = filter.testRunIds ? new Set(filter.testRunIds) : null;
    return clone(
      this.data.testResults.filter(
        (r) =>
          (!filter.testRunId || r.testRunId === filter.testRunId) &&
          (!filter.testCaseId || r.testCaseId === filter.testCaseId) &&
          (!runIds || runIds.has(r.testRunId)),
      ),
    );
  }

  async getResult(testRunId: string, testCaseId: string) {
    return clone(
      this.data.testResults.find((r) => r.testRunId === testRunId && r.testCaseId === testCaseId) ?? null,
    );
  }

  async upsertResult(input: ResultWrite) {
    const timestamp = now();
    const existing = this.data.testResults.find(
      (r) => r.testRunId === input.testRunId && r.testCaseId === input.testCaseId,
    );
    if (existing) {
      Object.assign(existing, input, { attempts: existing.attempts + 1, updatedAt: timestamp });
      this.commit();
      return clone(existing);
    }
    const result: TestResult = { ...input, id: newId(), attempts: 1, createdAt: timestamp, updatedAt: timestamp };
    this.data.testResults.push(result);
    this.commit();
    return clone(result);
  }

  // Automation tests -------------------------------------------------------

  async listAutomationTests(filter: { projectId?: string; status?: AutomationTest["status"]; testCaseIds?: string[] } = {}) {
    const ids = filter.testCaseIds ? new Set(filter.testCaseIds) : null;
    return clone(
      this.data.automationTests
        .filter(
          (t) =>
            (!filter.projectId || t.projectId === filter.projectId) &&
            (!filter.status || t.status === filter.status) &&
            (!ids || ids.has(t.testCaseId)),
        )
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    );
  }

  async getAutomationTest(id: string) {
    return clone(this.data.automationTests.find((t) => t.id === id) ?? null);
  }

  async getAutomationTestByCase(testCaseId: string) {
    return clone(this.data.automationTests.find((t) => t.testCaseId === testCaseId) ?? null);
  }

  async createAutomationTest(input: NewAutomationTest) {
    if (this.data.automationTests.some((t) => t.testCaseId === input.testCaseId)) {
      throw new AppError("conflict", "This test case already has an automation test.");
    }
    const timestamp = now();
    const test: AutomationTest = { ...input, id: newId(), createdAt: timestamp, updatedAt: timestamp };
    this.data.automationTests.push(test);
    this.commit();
    return clone(test);
  }

  async updateAutomationTest(id: string, patch: AutomationTestPatch) {
    const test = this.data.automationTests.find((t) => t.id === id);
    if (!test) throw notFound("Automation test", id);
    Object.assign(test, patch, { updatedAt: now() });
    this.commit();
    return clone(test);
  }

  // Automation runs --------------------------------------------------------

  async listAutomationRuns(
    filter: { projectId?: string; testRunId?: string; statuses?: AutomationRun["status"][]; limit?: number } = {},
  ) {
    const rows = this.data.automationRuns
      .filter(
        (r) =>
          (!filter.projectId || r.projectId === filter.projectId) &&
          (!filter.testRunId || r.testRunId === filter.testRunId) &&
          (!filter.statuses?.length || filter.statuses.includes(r.status)),
      )
      .sort(byNewest);
    return clone(filter.limit ? rows.slice(0, filter.limit) : rows);
  }

  async getAutomationRun(id: string) {
    return clone(this.data.automationRuns.find((r) => r.id === id) ?? null);
  }

  async createAutomationRun(input: NewAutomationRun) {
    const timestamp = now();
    const run: AutomationRun = { ...input, id: newId(), createdAt: timestamp, updatedAt: timestamp };
    this.data.automationRuns.push(run);
    this.commit();
    return clone(run);
  }

  async updateAutomationRun(id: string, patch: AutomationRunPatch) {
    const run = this.data.automationRuns.find((r) => r.id === id);
    if (!run) throw notFound("Automation run", id);
    Object.assign(run, patch, { updatedAt: now() });
    this.commit();
    return clone(run);
  }

  // Automation results -----------------------------------------------------

  async listAutomationResults(filter: {
    automationRunId?: string;
    testCaseId?: string;
    statuses?: AutomationResult["status"][];
    limit?: number;
  }) {
    const rows = this.data.automationResults
      .filter(
        (r) =>
          (!filter.automationRunId || r.automationRunId === filter.automationRunId) &&
          (!filter.testCaseId || r.testCaseId === filter.testCaseId) &&
          (!filter.statuses?.length || filter.statuses.includes(r.status)),
      )
      .sort(byNewest);
    return clone(filter.limit ? rows.slice(0, filter.limit) : rows);
  }

  async getAutomationResult(id: string) {
    return clone(this.data.automationResults.find((r) => r.id === id) ?? null);
  }

  async upsertAutomationResult(input: AutomationResultWrite) {
    const existing = this.data.automationResults.find(
      (r) => r.automationRunId === input.automationRunId && r.testCaseId === input.testCaseId,
    );
    if (existing) {
      Object.assign(existing, input, { analysis: null });
      this.commit();
      return clone(existing);
    }
    const result: AutomationResult = { ...input, id: newId(), analysis: null, createdAt: now() };
    this.data.automationResults.push(result);
    this.commit();
    return clone(result);
  }

  async setAutomationResultAnalysis(id: string, analysis: AutomationResult["analysis"]) {
    const result = this.data.automationResults.find((r) => r.id === id);
    if (!result) throw notFound("Automation result", id);
    result.analysis = analysis;
    this.commit();
    return clone(result);
  }

  // Activity ---------------------------------------------------------------

  async listActivities(filter: { projectId?: string; limit?: number } = {}) {
    const rows = this.data.activities
      .filter((a) => !filter.projectId || a.projectId === filter.projectId)
      .sort(byNewest);
    return clone(rows.slice(0, filter.limit ?? 50));
  }

  async addActivity(input: NewActivity) {
    const activity: Activity = { ...input, id: newId(), createdAt: now() };
    this.data.activities.push(activity);
    if (this.data.activities.length > 2000) this.data.activities.splice(0, this.data.activities.length - 2000);
    this.commit();
    return clone(activity);
  }
}
