export const ENVIRONMENTS = ["local", "development", "staging", "production"] as const;
export type Environment = (typeof ENVIRONMENTS)[number];

export const CASE_TYPES = [
  "functional",
  "regression",
  "smoke",
  "e2e",
  "api",
  "integration",
  "negative",
  "boundary",
  "security",
  "error",
] as const;
export type CaseType = (typeof CASE_TYPES)[number];

export const PRIORITIES = ["critical", "high", "medium", "low"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const AUTOMATION_STATUSES = ["manual", "candidate", "automated"] as const;
export type AutomationStatus = (typeof AUTOMATION_STATUSES)[number];

export const CASE_SOURCES = ["manual", "ai_generated"] as const;
export type CaseSource = (typeof CASE_SOURCES)[number];

/** Review gate for test cases. AI output always starts as `draft` ("AI Draft"). */
export const REVIEW_STATUSES = ["draft", "approved", "rejected"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const RESULT_STATUSES = ["untested", "passed", "failed", "blocked", "skipped"] as const;
export type ResultStatus = (typeof RESULT_STATUSES)[number];
export type ExecutedResultStatus = Exclude<ResultStatus, "untested">;

export const FAILURE_CATEGORIES = [
  "ui",
  "api",
  "backend",
  "data",
  "network",
  "environment",
  "automation_script",
  "unknown",
] as const;
export type FailureCategory = (typeof FAILURE_CATEGORIES)[number];

export const SEVERITIES = ["critical", "major", "minor", "trivial"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const EXECUTION_MODES = ["manual", "automated"] as const;
export type ExecutionMode = (typeof EXECUTION_MODES)[number];

export const TEST_RUN_STATUSES = ["active", "completed"] as const;
export type TestRunStatus = (typeof TEST_RUN_STATUSES)[number];

export const AUTOMATION_TEST_STATUSES = ["draft", "approved", "rejected"] as const;
export type AutomationTestStatus = (typeof AUTOMATION_TEST_STATUSES)[number];

export const AUTOMATION_RUN_STATUSES = ["queued", "running", "passed", "failed", "cancelled"] as const;
export type AutomationRunStatus = (typeof AUTOMATION_RUN_STATUSES)[number];

export const AUTOMATION_RESULT_STATUSES = ["passed", "failed", "skipped"] as const;
export type AutomationResultStatus = (typeof AUTOMATION_RESULT_STATUSES)[number];

export const AUTOMATION_TRIGGERS = ["manual", "github", "scheduled"] as const;
export type AutomationTrigger = (typeof AUTOMATION_TRIGGERS)[number];

export const RUNNER_KINDS = ["local", "github", "external"] as const;
export type RunnerKind = (typeof RUNNER_KINDS)[number];

export const ENVIRONMENT_LABELS: Record<Environment, string> = {
  local: "Local",
  development: "Development",
  staging: "Staging",
  production: "Production",
};

export const CASE_TYPE_LABELS: Record<CaseType, string> = {
  functional: "Functional",
  regression: "Regression",
  smoke: "Smoke",
  e2e: "E2E",
  api: "API",
  integration: "Integration",
  negative: "Negative",
  boundary: "Boundary",
  security: "Security",
  error: "Error Handling",
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

export const AUTOMATION_STATUS_LABELS: Record<AutomationStatus, string> = {
  manual: "Manual",
  candidate: "Candidate",
  automated: "Automated",
};

export const RESULT_STATUS_LABELS: Record<ResultStatus, string> = {
  untested: "Untested",
  passed: "Passed",
  failed: "Failed",
  blocked: "Blocked",
  skipped: "Skipped",
};

export const FAILURE_CATEGORY_LABELS: Record<FailureCategory, string> = {
  ui: "UI",
  api: "API",
  backend: "Backend",
  data: "Data",
  network: "Network",
  environment: "Environment",
  automation_script: "Automation Script",
  unknown: "Unknown",
};

export const SEVERITY_LABELS: Record<Severity, string> = {
  critical: "Critical",
  major: "Major",
  minor: "Minor",
  trivial: "Trivial",
};

export const AUTOMATION_RUN_STATUS_LABELS: Record<AutomationRunStatus, string> = {
  queued: "Queued",
  running: "Running",
  passed: "Passed",
  failed: "Failed",
  cancelled: "Cancelled",
};

export const AUTOMATION_TRIGGER_LABELS: Record<AutomationTrigger, string> = {
  manual: "Manual",
  github: "GitHub",
  scheduled: "Scheduled",
};

/** Types that are not happy-path. AI generation must include a share of these. */
export const UNHAPPY_CASE_TYPES: readonly CaseType[] = ["negative", "boundary", "security", "error"];
