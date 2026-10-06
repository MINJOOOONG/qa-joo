import { z } from "zod";
import {
  AUTOMATION_RESULT_STATUSES,
  AUTOMATION_STATUSES,
  CASE_TYPES,
  ENVIRONMENTS,
  FAILURE_CATEGORIES,
  PRIORITIES,
  RESULT_STATUSES,
  RUNNER_KINDS,
  SEVERITIES,
} from "./constants";

/** Turns "" and whitespace-only strings into null so optional form fields stay clean. */
const emptyToNull = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? null : value;

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export const httpUrlSchema = z
  .string()
  .trim()
  .max(2048, "URL is too long.")
  .refine(isHttpUrl, "Enter a valid http(s) URL.");

const GITHUB_REPO_PATTERN = /^https:\/\/github\.com\/[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}\/?$/;

export const githubRepoUrlSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/\.git$/, ""))
  .refine(
    (value) => GITHUB_REPO_PATTERN.test(value),
    "Use a GitHub repository URL like https://github.com/owner/repo.",
  );

/**
 * Evidence links are rendered as anchors, so only http(s) URLs and artifacts served by QA JOO
 * itself are accepted. This blocks `javascript:` and `data:` URLs from ever reaching the UI.
 */
export const evidenceUrlSchema = z.preprocess(
  emptyToNull,
  z
    .string()
    .trim()
    .max(2048)
    .refine(
      (value) => isHttpUrl(value) || /^\/api\/artifacts\/[A-Za-z0-9/_.-]+$/.test(value),
      "Evidence must be an http(s) URL.",
    )
    .nullable()
    .optional(),
);

const optionalText = (max: number) =>
  z.preprocess(emptyToNull, z.string().trim().max(max).nullable().optional());

export const projectKeySchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z][A-Z0-9]{1,9}$/, "Key must be 2-10 characters: letters and digits, starting with a letter.");

const projectFields = {
  name: z.string().trim().min(1, "Project name is required.").max(80),
  description: optionalText(2000),
  appUrl: z.preprocess(emptyToNull, httpUrlSchema.nullable().optional()),
  repoUrl: z.preprocess(emptyToNull, githubRepoUrlSchema.nullable().optional()),
  environment: z.enum(ENVIRONMENTS).default("staging"),
};

export const createProjectSchema = z
  .object({ ...projectFields, key: projectKeySchema })
  .refine((value) => Boolean(value.appUrl || value.repoUrl), {
    message: "Add an Application URL or a Repository URL so QA JOO has something to analyze.",
    path: ["appUrl"],
  });
export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const updateProjectSchema = z.object(projectFields).partial();
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

export const sectionInputSchema = z.object({
  projectId: z.string().min(1),
  parentId: z.preprocess(emptyToNull, z.string().nullable().optional()),
  name: z.string().trim().min(1, "Section name is required.").max(120),
});
export type SectionInput = z.infer<typeof sectionInputSchema>;

export const stepsSchema = z
  .array(z.string().trim().min(1).max(1000))
  .min(1, "Add at least one step.")
  .max(50, "A test case can have at most 50 steps.");

export const tagsSchema = z
  .array(
    z
      .string()
      .trim()
      .toLowerCase()
      .min(1)
      .max(40)
      .regex(/^[a-z0-9][a-z0-9_-]*$/, "Tags may contain letters, digits, '-' and '_'."),
  )
  .max(20)
  .transform((tags) => Array.from(new Set(tags)));

export const testCaseInputSchema = z.object({
  projectId: z.string().min(1),
  sectionId: z.preprocess(emptyToNull, z.string().nullable().optional()),
  title: z.string().trim().min(1, "Title is required.").max(200),
  description: optionalText(4000),
  preconditions: optionalText(2000),
  steps: stepsSchema,
  expectedResult: z.string().trim().min(1, "Expected result is required.").max(2000),
  type: z.enum(CASE_TYPES),
  priority: z.enum(PRIORITIES),
  automationStatus: z.enum(AUTOMATION_STATUSES).default("manual"),
  tags: tagsSchema.default([]),
});
export type TestCaseInput = z.infer<typeof testCaseInputSchema>;

export const testCaseUpdateSchema = testCaseInputSchema.omit({ projectId: true }).partial();
export type TestCaseUpdate = z.infer<typeof testCaseUpdateSchema>;

export const caseSelectionSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("all") }),
  z.object({
    mode: z.literal("filter"),
    sectionIds: z.array(z.string()).max(500).default([]),
    types: z.array(z.enum(CASE_TYPES)).default([]),
    priorities: z.array(z.enum(PRIORITIES)).default([]),
    automationStatuses: z.array(z.enum(AUTOMATION_STATUSES)).default([]),
  }),
  z.object({
    mode: z.literal("manual"),
    caseIds: z.array(z.string()).min(1, "Select at least one test case.").max(2000),
  }),
]);
export type CaseSelection = z.infer<typeof caseSelectionSchema>;

export const createRunSchema = z.object({
  projectId: z.string().min(1, "Select a project."),
  name: z.string().trim().min(1, "Run name is required.").max(160),
  environment: z.enum(ENVIRONMENTS),
  build: optionalText(80),
  description: optionalText(2000),
  selection: caseSelectionSchema,
});
export type CreateRunInput = z.infer<typeof createRunSchema>;

export const evidenceSchema = z
  .object({
    screenshotUrl: evidenceUrlSchema,
    traceUrl: evidenceUrlSchema,
    logUrl: evidenceUrlSchema,
    networkLogUrl: evidenceUrlSchema,
  })
  .partial();

export const recordResultSchema = z
  .object({
    testRunId: z.string().min(1),
    testCaseId: z.string().min(1),
    status: z.enum(RESULT_STATUSES),
    actualResult: optionalText(4000),
    comment: optionalText(4000),
    durationMs: z.coerce.number().int().min(0).max(24 * 60 * 60 * 1000).nullable().optional(),
    failureCategory: z.preprocess(emptyToNull, z.enum(FAILURE_CATEGORIES).nullable().optional()),
    severity: z.preprocess(emptyToNull, z.enum(SEVERITIES).nullable().optional()),
    evidence: evidenceSchema.default({}),
  })
  .superRefine((value, ctx) => {
    if (value.status === "failed") {
      if (!value.failureCategory) {
        ctx.addIssue({ code: "custom", path: ["failureCategory"], message: "Failure category is required." });
      }
      if (!value.severity) {
        ctx.addIssue({ code: "custom", path: ["severity"], message: "Severity is required." });
      }
      if (!value.actualResult) {
        ctx.addIssue({ code: "custom", path: ["actualResult"], message: "Describe the actual result." });
      }
    }
    if (value.status === "blocked" && !value.comment) {
      ctx.addIssue({ code: "custom", path: ["comment"], message: "Explain what is blocking this test." });
    }
  });
export type RecordResultInput = z.infer<typeof recordResultSchema>;

export const generateCasesRequestSchema = z.object({
  projectId: z.string().min(1),
  maxCases: z.coerce.number().int().min(4).max(40).default(12),
  focus: optionalText(500),
});
export type GenerateCasesRequest = z.infer<typeof generateCasesRequestSchema>;

export const generateAutomationRequestSchema = z.object({
  testCaseId: z.string().min(1),
});

export const createAutomationRunSchema = z.object({
  projectId: z.string().min(1),
  testRunId: z.preprocess(emptyToNull, z.string().nullable().optional()),
  testCaseIds: z.array(z.string().min(1)).max(500).optional(),
  environment: z.enum(ENVIRONMENTS).optional(),
  targetUrl: z.preprocess(emptyToNull, httpUrlSchema.nullable().optional()),
  runner: z.enum(RUNNER_KINDS).optional(),
});
export type CreateAutomationRunInput = z.infer<typeof createAutomationRunSchema>;

export const automationResultItemSchema = z.object({
  testCaseId: z.string().min(1),
  status: z.enum(AUTOMATION_RESULT_STATUSES),
  durationMs: z.number().int().min(0).max(6 * 60 * 60 * 1000).nullable().optional(),
  errorMessage: z.string().max(20_000).nullable().optional(),
  screenshotUrl: evidenceUrlSchema,
  traceUrl: evidenceUrlSchema,
  logUrl: evidenceUrlSchema,
});
export type AutomationResultItem = z.infer<typeof automationResultItemSchema>;

export const automationCallbackSchema = z.object({
  automationRunId: z.string().min(1),
  status: z.enum(["running", "passed", "failed", "cancelled"]).optional(),
  branch: z.string().max(255).nullable().optional(),
  commitSha: z
    .string()
    .regex(/^[0-9a-f]{7,40}$/i, "commitSha must be a git SHA.")
    .nullable()
    .optional(),
  externalUrl: z.preprocess(emptyToNull, httpUrlSchema.nullable().optional()),
  error: z.string().max(4000).nullable().optional(),
  results: z.array(automationResultItemSchema).max(1000).default([]),
});
export type AutomationCallback = z.infer<typeof automationCallbackSchema>;
