import { z } from "zod";
import { CASE_TYPES, FAILURE_CATEGORIES, PRIORITIES } from "@/lib/domain/constants";

/*
 * Output contracts for AI calls. They are deliberately plain (no length refinements) so they can be
 * used as provider-side JSON schemas; results are normalized and re-validated by QA JOO afterwards.
 */

export const generatedCaseSchema = z.object({
  title: z.string().describe("Imperative, specific test case title, e.g. 'Reject malformed campaign URL'"),
  area: z.string().describe("Top-level feature area, used as the section name"),
  subarea: z.string().describe("Optional sub-section such as 'Negative Cases'; empty string if none"),
  type: z.enum(CASE_TYPES),
  priority: z.enum(PRIORITIES),
  preconditions: z.string(),
  steps: z.array(z.string()).describe("Concrete, observable steps a tester can follow"),
  expectedResult: z.string(),
  tags: z.array(z.string()),
  rationale: z.string().describe("Which evidence from the analysis motivated this case"),
});
export type GeneratedCase = z.infer<typeof generatedCaseSchema>;

export const generatedCasesSchema = z.object({
  cases: z.array(generatedCaseSchema),
  coverageNotes: z.string().describe("Short note on what is covered and what could not be inferred"),
});

export const automationDraftSchema = z.object({
  code: z.string().describe("Complete Playwright TypeScript spec file"),
  assumptions: z.array(z.string()).describe("Selectors or behaviors the reviewer must verify"),
});
export type AutomationDraftOutput = z.infer<typeof automationDraftSchema>;

export const failureAnalysisSchema = z.object({
  probableCause: z.string(),
  category: z.enum(FAILURE_CATEGORIES),
  confidence: z.enum(["low", "medium", "high"]),
  suggestedNextStep: z.string(),
  suggestedRegressionCases: z.array(
    z.object({
      title: z.string(),
      type: z.enum(CASE_TYPES),
      priority: z.enum(PRIORITIES),
      steps: z.array(z.string()),
      expectedResult: z.string(),
    }),
  ),
});
export type FailureAnalysisOutput = z.infer<typeof failureAnalysisSchema>;
