import { createClient, type PostgrestError, type SupabaseClient } from "@supabase/supabase-js";
import { AppError, notFound } from "@/lib/errors";
import { caseKeyNumber } from "@/lib/domain/case-key";
import type {
  Activity,
  AutomationResult,
  AutomationRun,
  AutomationTest,
  Evidence,
  Project,
  Section,
  TestCase,
  TestResult,
  TestRun,
  TestRunCase,
} from "@/lib/domain/types";
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

/* eslint-disable @typescript-eslint/no-explicit-any -- rows are untyped PostgREST JSON, mapped explicitly below */
type Row = Record<string, any>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Ids come from URLs; a malformed one is simply "not found" instead of a Postgres cast error. */
const isUuid = (value: string) => UUID_PATTERN.test(value);

const PAGE_SIZE = 1000;
const IN_CHUNK = 150;

function chunk<T>(items: T[], size = IN_CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function fail(error: PostgrestError, context: string): never {
  if (error.code === "22P02") throw new AppError("validation", `${context}: invalid identifier or value.`);
  if (error.code === "23505") throw new AppError("conflict", `${context}: a record with the same key already exists.`);
  if (error.code === "23503") throw new AppError("bad_request", `${context}: a referenced record does not exist.`);
  if (error.code === "23514") throw new AppError("validation", `${context}: value violates a database constraint.`);
  console.error(`[qa-joo] supabase error (${context})`, error);
  throw new AppError("upstream", `${context} failed. Check the database connection.`);
}

/** Strips `undefined` keys so partial updates never null out columns by accident. */
function compact(row: Row): Row {
  return Object.fromEntries(Object.entries(row).filter(([, value]) => value !== undefined));
}

const toProject = (r: Row): Project => ({
  id: r.id,
  key: r.key,
  name: r.name,
  description: r.description,
  appUrl: r.app_url,
  repoUrl: r.repo_url,
  environment: r.environment,
  lastAnalysis: r.last_analysis,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const fromProjectPatch = (p: ProjectPatch): Row =>
  compact({
    name: p.name,
    description: p.description,
    app_url: p.appUrl,
    repo_url: p.repoUrl,
    environment: p.environment,
    last_analysis: p.lastAnalysis,
  });

const toSection = (r: Row): Section => ({
  id: r.id,
  projectId: r.project_id,
  parentId: r.parent_id,
  name: r.name,
  sortOrder: r.sort_order,
  createdAt: r.created_at,
});

const toTestCase = (r: Row): TestCase => ({
  id: r.id,
  projectId: r.project_id,
  sectionId: r.section_id,
  caseKey: r.case_key,
  title: r.title,
  description: r.description,
  preconditions: r.preconditions,
  steps: Array.isArray(r.steps) ? r.steps : [],
  expectedResult: r.expected_result,
  type: r.type,
  priority: r.priority,
  automationStatus: r.automation_status,
  source: r.source,
  reviewStatus: r.review_status,
  tags: r.tags ?? [],
  aiRationale: r.ai_rationale,
  lastResult: r.last_result,
  lastResultAt: r.last_result_at,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const fromTestCasePatch = (p: TestCasePatch): Row =>
  compact({
    section_id: p.sectionId,
    title: p.title,
    description: p.description,
    preconditions: p.preconditions,
    steps: p.steps,
    expected_result: p.expectedResult,
    type: p.type,
    priority: p.priority,
    automation_status: p.automationStatus,
    review_status: p.reviewStatus,
    tags: p.tags,
    ai_rationale: p.aiRationale,
  });

const toTestRun = (r: Row): TestRun => ({
  id: r.id,
  projectId: r.project_id,
  name: r.name,
  environment: r.environment,
  build: r.build,
  description: r.description,
  status: r.status,
  createdBy: r.created_by,
  completedAt: r.completed_at,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const toRunCase = (r: Row): TestRunCase => ({
  id: r.id,
  testRunId: r.test_run_id,
  testCaseId: r.test_case_id,
  sortOrder: r.sort_order,
  createdAt: r.created_at,
});

const emptyEvidence: Evidence = { screenshotUrl: null, traceUrl: null, logUrl: null, networkLogUrl: null };

const toResult = (r: Row): TestResult => ({
  id: r.id,
  testRunId: r.test_run_id,
  testCaseId: r.test_case_id,
  status: r.status,
  mode: r.mode,
  actualResult: r.actual_result,
  comment: r.comment,
  durationMs: r.duration_ms,
  tester: r.tester,
  failureCategory: r.failure_category,
  severity: r.severity,
  evidence: { ...emptyEvidence, ...(r.evidence ?? {}) },
  automationResultId: r.automation_result_id,
  attempts: r.attempts,
  executedAt: r.executed_at,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const fromResult = (r: ResultWrite): Row => ({
  test_run_id: r.testRunId,
  test_case_id: r.testCaseId,
  status: r.status,
  mode: r.mode,
  actual_result: r.actualResult,
  comment: r.comment,
  duration_ms: r.durationMs,
  tester: r.tester,
  failure_category: r.failureCategory,
  severity: r.severity,
  evidence: r.evidence,
  automation_result_id: r.automationResultId,
  executed_at: r.executedAt,
});

const toAutomationTest = (r: Row): AutomationTest => ({
  id: r.id,
  projectId: r.project_id,
  testCaseId: r.test_case_id,
  framework: r.framework,
  filePath: r.file_path,
  testName: r.test_name,
  code: r.code,
  status: r.status,
  generatedBy: r.generated_by,
  reviewNote: r.review_note,
  approvedAt: r.approved_at,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const toAutomationRun = (r: Row): AutomationRun => ({
  id: r.id,
  projectId: r.project_id,
  testRunId: r.test_run_id,
  environment: r.environment,
  targetUrl: r.target_url,
  trigger: r.trigger,
  runner: r.runner,
  branch: r.branch,
  commitSha: r.commit_sha,
  status: r.status,
  testCaseIds: r.test_case_ids ?? [],
  externalUrl: r.external_url,
  error: r.error,
  startedAt: r.started_at,
  finishedAt: r.finished_at,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const toAutomationResult = (r: Row): AutomationResult => ({
  id: r.id,
  automationRunId: r.automation_run_id,
  testCaseId: r.test_case_id,
  automationTestId: r.automation_test_id,
  status: r.status,
  durationMs: r.duration_ms,
  errorMessage: r.error_message,
  screenshotUrl: r.screenshot_url,
  traceUrl: r.trace_url,
  logUrl: r.log_url,
  analysis: r.analysis,
  createdAt: r.created_at,
});

const toActivity = (r: Row): Activity => ({
  id: r.id,
  projectId: r.project_id,
  actor: r.actor,
  action: r.action,
  entityType: r.entity_type,
  entityId: r.entity_id,
  message: r.message,
  createdAt: r.created_at,
});

/**
 * Builds a quoted PostgREST filter value for a case-insensitive "contains" search:
 * LIKE wildcards are escaped first, then the value is double-quoted so reserved characters
 * (`,` `(` `)` `.` `:`) cannot break the `or=(...)` logic tree.
 */
export function ilikeValue(search: string): string {
  const pattern = `%${search.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
  return `"${pattern.replace(/["\\]/g, (char) => `\\${char}`)}"`;
}

export class SupabaseRepository implements Repository {
  readonly kind = "supabase" as const;
  private readonly db: SupabaseClient;

  constructor(url: string, serviceRoleKey: string) {
    this.db = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }

  /** Exposed for artifact storage, which uses the same service-role client. */
  get client(): SupabaseClient {
    return this.db;
  }

  // Projects ---------------------------------------------------------------

  async listProjects() {
    const { data, error } = await this.db.from("projects").select("*").order("name");
    if (error) fail(error, "List projects");
    return data.map(toProject);
  }

  async getProject(id: string) {
    if (!isUuid(id)) return null;
    const { data, error } = await this.db.from("projects").select("*").eq("id", id).maybeSingle();
    if (error) fail(error, "Get project");
    return data ? toProject(data) : null;
  }

  async getProjectByKey(key: string) {
    const { data, error } = await this.db.from("projects").select("*").eq("key", key.toUpperCase()).maybeSingle();
    if (error) fail(error, "Get project");
    return data ? toProject(data) : null;
  }

  async createProject(input: NewProject) {
    const { data, error } = await this.db
      .from("projects")
      .insert({
        key: input.key,
        name: input.name,
        description: input.description,
        app_url: input.appUrl,
        repo_url: input.repoUrl,
        environment: input.environment,
      })
      .select()
      .single();
    if (error) {
      if (error.code === "23505") throw new AppError("conflict", `Project key ${input.key} is already in use.`);
      fail(error, "Create project");
    }
    return toProject(data);
  }

  async updateProject(id: string, patch: ProjectPatch) {
    const { data, error } = await this.db
      .from("projects")
      .update(fromProjectPatch(patch))
      .eq("id", id)
      .select()
      .maybeSingle();
    if (error) fail(error, "Update project");
    if (!data) throw notFound("Project", id);
    return toProject(data);
  }

  async deleteProject(id: string) {
    const { error } = await this.db.from("projects").delete().eq("id", id);
    if (error) fail(error, "Delete project");
  }

  // Sections ---------------------------------------------------------------

  async listSections(projectId: string) {
    const { data, error } = await this.db
      .from("sections")
      .select("*")
      .eq("project_id", projectId)
      .order("sort_order")
      .order("name");
    if (error) fail(error, "List sections");
    return data.map(toSection);
  }

  async getSection(id: string) {
    if (!isUuid(id)) return null;
    const { data, error } = await this.db.from("sections").select("*").eq("id", id).maybeSingle();
    if (error) fail(error, "Get section");
    return data ? toSection(data) : null;
  }

  async createSection(input: NewSection) {
    const { data, error } = await this.db
      .from("sections")
      .insert({ project_id: input.projectId, parent_id: input.parentId, name: input.name, sort_order: input.sortOrder })
      .select()
      .single();
    if (error) fail(error, "Create section");
    return toSection(data);
  }

  async updateSection(id: string, patch: SectionPatch) {
    const { data, error } = await this.db
      .from("sections")
      .update(compact({ name: patch.name, parent_id: patch.parentId, sort_order: patch.sortOrder }))
      .eq("id", id)
      .select()
      .maybeSingle();
    if (error) fail(error, "Update section");
    if (!data) throw notFound("Section", id);
    return toSection(data);
  }

  async deleteSection(id: string) {
    const { error } = await this.db.from("sections").delete().eq("id", id);
    if (error) fail(error, "Delete section");
  }

  // Test cases -------------------------------------------------------------

  /** Reads every page of a query (PostgREST caps each response at `max_rows`). */
  private async fetchAll(make: () => any, context: string): Promise<Row[]> {
    const rows: Row[] = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await make().order("id").range(from, from + PAGE_SIZE - 1);
      if (error) fail(error, context);
      if (!data.length) return rows;
      rows.push(...data);
    }
  }

  async listTestCases(filter: TestCaseFilter = {}) {
    if (filter.projectId && !isUuid(filter.projectId)) return [];
    if (filter.sectionId && !isUuid(filter.sectionId)) return [];
    const build = (ids?: string[]) => {
      let query = this.db.from("test_cases").select("*");
      if (filter.projectId) query = query.eq("project_id", filter.projectId);
      if (filter.sectionId !== undefined) {
        query = filter.sectionId === null ? query.is("section_id", null) : query.eq("section_id", filter.sectionId);
      }
      if (ids) query = query.in("id", ids);
      if (filter.types?.length) query = query.in("type", filter.types);
      if (filter.priorities?.length) query = query.in("priority", filter.priorities);
      if (filter.automationStatuses?.length) query = query.in("automation_status", filter.automationStatuses);
      if (filter.sources?.length) query = query.in("source", filter.sources);
      if (filter.reviewStatuses?.length) query = query.in("review_status", filter.reviewStatuses);
      if (filter.lastResults?.length) {
        const values = filter.lastResults.filter((value) => value !== "untested");
        const clauses = values.length ? [`last_result.in.(${values.join(",")})`] : [];
        if (filter.lastResults.includes("untested")) clauses.push("last_result.is.null", "last_result.eq.untested");
        query = query.or(clauses.join(","));
      }
      const search = filter.search?.trim();
      if (search) {
        const pattern = ilikeValue(search);
        query = query.or(`case_key.ilike.${pattern},title.ilike.${pattern}`);
      }
      return query;
    };
    let rows: Row[];
    if (filter.ids) {
      const ids = Array.from(new Set(filter.ids.filter(isUuid)));
      rows = [];
      for (const part of chunk(ids)) rows.push(...(await this.fetchAll(() => build(part), "List test cases")));
    } else {
      rows = await this.fetchAll(() => build(), "List test cases");
    }
    return rows
      .map(toTestCase)
      .sort(
        (a, b) => a.projectId.localeCompare(b.projectId) || caseKeyNumber(a.caseKey) - caseKeyNumber(b.caseKey),
      );
  }

  async getTestCase(id: string) {
    if (!isUuid(id)) return null;
    const { data, error } = await this.db.from("test_cases").select("*").eq("id", id).maybeSingle();
    if (error) fail(error, "Get test case");
    return data ? toTestCase(data) : null;
  }

  async highestCaseNumber(projectId: string) {
    if (!isUuid(projectId)) return 0;
    const { data, error } = await this.db
      .from("test_cases")
      .select("case_number")
      .eq("project_id", projectId)
      .not("case_number", "is", null)
      .order("case_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) fail(error, "Read highest case key");
    return data ? Number(data.case_number) : 0;
  }

  async createTestCase(input: NewTestCase) {
    const { data, error } = await this.db
      .from("test_cases")
      .insert({
        project_id: input.projectId,
        section_id: input.sectionId,
        case_key: input.caseKey,
        title: input.title,
        description: input.description,
        preconditions: input.preconditions,
        steps: input.steps,
        expected_result: input.expectedResult,
        type: input.type,
        priority: input.priority,
        automation_status: input.automationStatus,
        source: input.source,
        review_status: input.reviewStatus,
        tags: input.tags,
        ai_rationale: input.aiRationale,
      })
      .select()
      .single();
    if (error) {
      if (error.code === "23505") {
        throw new AppError("conflict", `Case key ${input.caseKey} already exists in this project.`);
      }
      fail(error, "Create test case");
    }
    return toTestCase(data);
  }

  async updateTestCase(id: string, patch: TestCasePatch) {
    const { data, error } = await this.db
      .from("test_cases")
      .update(fromTestCasePatch(patch))
      .eq("id", id)
      .select()
      .maybeSingle();
    if (error) fail(error, "Update test case");
    if (!data) throw notFound("Test case", id);
    return toTestCase(data);
  }

  async setLastResult(id: string, status: TestCase["lastResult"], at: string | null) {
    const { error } = await this.db
      .from("test_cases")
      .update({ last_result: status, last_result_at: at })
      .eq("id", id);
    if (error) fail(error, "Update last result");
  }

  async deleteTestCase(id: string) {
    const { error } = await this.db.from("test_cases").delete().eq("id", id);
    if (error) fail(error, "Delete test case");
  }

  // Test runs --------------------------------------------------------------

  async listTestRuns(filter: { projectId?: string; status?: TestRun["status"] } = {}) {
    let query = this.db.from("test_runs").select("*");
    if (filter.projectId) query = query.eq("project_id", filter.projectId);
    if (filter.status) query = query.eq("status", filter.status);
    const { data, error } = await query.order("updated_at", { ascending: false }).limit(500);
    if (error) fail(error, "List test runs");
    return data.map(toTestRun);
  }

  async getTestRun(id: string) {
    if (!isUuid(id)) return null;
    const { data, error } = await this.db.from("test_runs").select("*").eq("id", id).maybeSingle();
    if (error) fail(error, "Get test run");
    return data ? toTestRun(data) : null;
  }

  async createTestRun(input: NewTestRun, caseIds: string[]) {
    const { data, error } = await this.db
      .from("test_runs")
      .insert({
        project_id: input.projectId,
        name: input.name,
        environment: input.environment,
        build: input.build,
        description: input.description,
        created_by: input.createdBy,
      })
      .select()
      .single();
    if (error) fail(error, "Create test run");
    try {
      await this.addRunCases(data.id, caseIds);
    } catch (cause) {
      // Keep the run and its case list consistent: no half-created runs.
      await this.db.from("test_runs").delete().eq("id", data.id);
      throw cause;
    }
    return toTestRun(data);
  }

  async updateTestRun(id: string, patch: TestRunPatch) {
    const { data, error } = await this.db
      .from("test_runs")
      .update(
        compact({
          name: patch.name,
          build: patch.build,
          description: patch.description,
          status: patch.status,
          completed_at: patch.completedAt,
          // Always present so an empty patch still "touches" the run (trigger sets the real value).
          updated_at: new Date().toISOString(),
        }),
      )
      .eq("id", id)
      .select()
      .maybeSingle();
    if (error) fail(error, "Update test run");
    if (!data) throw notFound("Test run", id);
    return toTestRun(data);
  }

  async deleteTestRun(id: string) {
    const { error } = await this.db.from("test_runs").delete().eq("id", id);
    if (error) fail(error, "Delete test run");
  }

  async listRunCases(testRunId: string) {
    const { data, error } = await this.db
      .from("test_run_cases")
      .select("*")
      .eq("test_run_id", testRunId)
      .order("sort_order");
    if (error) fail(error, "List run cases");
    return data.map(toRunCase);
  }

  async addRunCases(testRunId: string, caseIds: string[]) {
    const unique = Array.from(new Set(caseIds));
    if (unique.length === 0) return 0;
    const existing = await this.listRunCases(testRunId);
    const present = new Set(existing.map((row) => row.testCaseId));
    let sortOrder = existing.reduce((max, row) => Math.max(max, row.sortOrder), 0);
    const rows = unique
      .filter((id) => !present.has(id))
      .map((testCaseId) => ({ test_run_id: testRunId, test_case_id: testCaseId, sort_order: (sortOrder += 1) }));
    if (rows.length === 0) return 0;
    const { error } = await this.db
      .from("test_run_cases")
      .upsert(rows, { onConflict: "test_run_id,test_case_id", ignoreDuplicates: true });
    if (error) fail(error, "Add run cases");
    return rows.length;
  }

  // Results ----------------------------------------------------------------

  async listResults(filter: { testRunId?: string; testCaseId?: string; testRunIds?: string[] }) {
    if (filter.testRunId && !isUuid(filter.testRunId)) return [];
    if (filter.testCaseId && !isUuid(filter.testCaseId)) return [];
    const build = (runIds?: string[]) => {
      let query = this.db.from("test_results").select("*");
      if (filter.testRunId) query = query.eq("test_run_id", filter.testRunId);
      if (filter.testCaseId) query = query.eq("test_case_id", filter.testCaseId);
      if (runIds) query = query.in("test_run_id", runIds);
      return query;
    };
    if (!filter.testRunIds) return (await this.fetchAll(() => build(), "List results")).map(toResult);
    const rows: Row[] = [];
    for (const part of chunk(Array.from(new Set(filter.testRunIds.filter(isUuid))))) {
      rows.push(...(await this.fetchAll(() => build(part), "List results")));
    }
    return rows.map(toResult);
  }

  async getResult(testRunId: string, testCaseId: string) {
    if (!isUuid(testRunId) || !isUuid(testCaseId)) return null;
    const { data, error } = await this.db
      .from("test_results")
      .select("*")
      .eq("test_run_id", testRunId)
      .eq("test_case_id", testCaseId)
      .maybeSingle();
    if (error) fail(error, "Get result");
    return data ? toResult(data) : null;
  }

  async upsertResult(input: ResultWrite) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const existing = await this.getResult(input.testRunId, input.testCaseId);
      if (existing) {
        const { data, error } = await this.db
          .from("test_results")
          .update({ ...fromResult(input), attempts: existing.attempts + 1 })
          .eq("id", existing.id)
          .select()
          .single();
        if (error) fail(error, "Update result");
        return toResult(data);
      }
      const { data, error } = await this.db.from("test_results").insert(fromResult(input)).select().single();
      if (!error) return toResult(data);
      // Lost a race with a concurrent insert for the same run/case: retry as an update.
      if (error.code !== "23505") fail(error, "Record result");
    }
    throw new AppError("conflict", "Result was modified concurrently. Try again.");
  }

  // Automation tests -------------------------------------------------------

  async listAutomationTests(filter: { projectId?: string; status?: AutomationTest["status"]; testCaseIds?: string[] } = {}) {
    if (filter.projectId && !isUuid(filter.projectId)) return [];
    const build = () => {
      let query = this.db.from("automation_tests").select("*");
      if (filter.projectId) query = query.eq("project_id", filter.projectId);
      if (filter.status) query = query.eq("status", filter.status);
      return query;
    };
    const rows: Row[] = [];
    if (filter.testCaseIds) {
      for (const part of chunk(Array.from(new Set(filter.testCaseIds.filter(isUuid))))) {
        rows.push(...(await this.fetchAll(() => build().in("test_case_id", part), "List automation tests")));
      }
    } else {
      rows.push(...(await this.fetchAll(build, "List automation tests")));
    }
    return rows.map(toAutomationTest).sort((x, y) => y.updatedAt.localeCompare(x.updatedAt));
  }

  async getAutomationTest(id: string) {
    if (!isUuid(id)) return null;
    const { data, error } = await this.db.from("automation_tests").select("*").eq("id", id).maybeSingle();
    if (error) fail(error, "Get automation test");
    return data ? toAutomationTest(data) : null;
  }

  async getAutomationTestByCase(testCaseId: string) {
    if (!isUuid(testCaseId)) return null;
    const { data, error } = await this.db
      .from("automation_tests")
      .select("*")
      .eq("test_case_id", testCaseId)
      .maybeSingle();
    if (error) fail(error, "Get automation test");
    return data ? toAutomationTest(data) : null;
  }

  async createAutomationTest(input: NewAutomationTest) {
    const { data, error } = await this.db
      .from("automation_tests")
      .insert({
        project_id: input.projectId,
        test_case_id: input.testCaseId,
        framework: input.framework,
        file_path: input.filePath,
        test_name: input.testName,
        code: input.code,
        status: input.status,
        generated_by: input.generatedBy,
        review_note: input.reviewNote,
        approved_at: input.approvedAt,
      })
      .select()
      .single();
    if (error) {
      if (error.code === "23505") throw new AppError("conflict", "This test case already has an automation test.");
      fail(error, "Create automation test");
    }
    return toAutomationTest(data);
  }

  async updateAutomationTest(id: string, patch: AutomationTestPatch) {
    const { data, error } = await this.db
      .from("automation_tests")
      .update(
        compact({
          code: patch.code,
          status: patch.status,
          file_path: patch.filePath,
          test_name: patch.testName,
          review_note: patch.reviewNote,
          approved_at: patch.approvedAt,
          generated_by: patch.generatedBy,
        }),
      )
      .eq("id", id)
      .select()
      .maybeSingle();
    if (error) fail(error, "Update automation test");
    if (!data) throw notFound("Automation test", id);
    return toAutomationTest(data);
  }

  // Automation runs --------------------------------------------------------

  async listAutomationRuns(
    filter: { projectId?: string; testRunId?: string; statuses?: AutomationRun["status"][]; limit?: number } = {},
  ) {
    let query = this.db.from("automation_runs").select("*");
    if (filter.projectId) query = query.eq("project_id", filter.projectId);
    if (filter.testRunId) query = query.eq("test_run_id", filter.testRunId);
    if (filter.statuses?.length) query = query.in("status", filter.statuses);
    const { data, error } = await query.order("created_at", { ascending: false }).limit(filter.limit ?? 200);
    if (error) fail(error, "List automation runs");
    return data.map(toAutomationRun);
  }

  async getAutomationRun(id: string) {
    if (!isUuid(id)) return null;
    const { data, error } = await this.db.from("automation_runs").select("*").eq("id", id).maybeSingle();
    if (error) fail(error, "Get automation run");
    return data ? toAutomationRun(data) : null;
  }

  async createAutomationRun(input: NewAutomationRun) {
    const { data, error } = await this.db
      .from("automation_runs")
      .insert({
        project_id: input.projectId,
        test_run_id: input.testRunId,
        environment: input.environment,
        target_url: input.targetUrl,
        trigger: input.trigger,
        runner: input.runner,
        branch: input.branch,
        commit_sha: input.commitSha,
        status: input.status,
        test_case_ids: input.testCaseIds,
        external_url: input.externalUrl,
        error: input.error,
        started_at: input.startedAt,
        finished_at: input.finishedAt,
      })
      .select()
      .single();
    if (error) fail(error, "Create automation run");
    return toAutomationRun(data);
  }

  async updateAutomationRun(id: string, patch: AutomationRunPatch) {
    const { data, error } = await this.db
      .from("automation_runs")
      .update(
        compact({
          status: patch.status,
          branch: patch.branch,
          commit_sha: patch.commitSha,
          external_url: patch.externalUrl,
          error: patch.error,
          started_at: patch.startedAt,
          finished_at: patch.finishedAt,
        }),
      )
      .eq("id", id)
      .select()
      .maybeSingle();
    if (error) fail(error, "Update automation run");
    if (!data) throw notFound("Automation run", id);
    return toAutomationRun(data);
  }

  // Automation results -----------------------------------------------------

  async listAutomationResults(filter: {
    automationRunId?: string;
    testCaseId?: string;
    statuses?: AutomationResult["status"][];
    limit?: number;
  }) {
    let query = this.db.from("automation_results").select("*");
    if (filter.automationRunId) query = query.eq("automation_run_id", filter.automationRunId);
    if (filter.testCaseId) query = query.eq("test_case_id", filter.testCaseId);
    if (filter.statuses?.length) query = query.in("status", filter.statuses);
    const { data, error } = await query.order("created_at", { ascending: false }).limit(filter.limit ?? 1000);
    if (error) fail(error, "List automation results");
    return data.map(toAutomationResult);
  }

  async getAutomationResult(id: string) {
    if (!isUuid(id)) return null;
    const { data, error } = await this.db.from("automation_results").select("*").eq("id", id).maybeSingle();
    if (error) fail(error, "Get automation result");
    return data ? toAutomationResult(data) : null;
  }

  async upsertAutomationResult(input: AutomationResultWrite) {
    const { data, error } = await this.db
      .from("automation_results")
      .upsert(
        {
          automation_run_id: input.automationRunId,
          test_case_id: input.testCaseId,
          automation_test_id: input.automationTestId,
          status: input.status,
          duration_ms: input.durationMs,
          error_message: input.errorMessage,
          screenshot_url: input.screenshotUrl,
          trace_url: input.traceUrl,
          log_url: input.logUrl,
          analysis: null,
        },
        { onConflict: "automation_run_id,test_case_id" },
      )
      .select()
      .single();
    if (error) fail(error, "Save automation result");
    return toAutomationResult(data);
  }

  async setAutomationResultAnalysis(id: string, analysis: AutomationResult["analysis"]) {
    const { data, error } = await this.db
      .from("automation_results")
      .update({ analysis })
      .eq("id", id)
      .select()
      .maybeSingle();
    if (error) fail(error, "Save failure analysis");
    if (!data) throw notFound("Automation result", id);
    return toAutomationResult(data);
  }

  // Activity ---------------------------------------------------------------

  async listActivities(filter: { projectId?: string; limit?: number } = {}) {
    let query = this.db.from("activities").select("*");
    if (filter.projectId) query = query.eq("project_id", filter.projectId);
    const { data, error } = await query.order("created_at", { ascending: false }).limit(filter.limit ?? 50);
    if (error) fail(error, "List activity");
    return data.map(toActivity);
  }

  async addActivity(input: NewActivity) {
    const { data, error } = await this.db
      .from("activities")
      .insert({
        project_id: input.projectId,
        actor: input.actor,
        action: input.action,
        entity_type: input.entityType,
        entity_id: input.entityId,
        message: input.message,
      })
      .select()
      .single();
    if (error) fail(error, "Log activity");
    return toActivity(data);
  }
}
