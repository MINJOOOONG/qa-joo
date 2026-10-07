import { z } from "zod";
import { CASE_TYPES, FAILURE_CATEGORIES, PRIORITIES } from "@/lib/domain/constants";
import type { Locale } from "@/lib/i18n/config";

/*
 * Output contracts for AI calls. They are deliberately plain (no length refinements) so they can be
 * used as provider-side JSON schemas; results are normalized and re-validated by QA JOO afterwards.
 */

const CASE_DESCRIPTIONS: Record<Locale, { title: string; subarea: string; steps: string }> = {
  ko: {
    title: "Specific Korean test case title, e.g. '잘못된 형식의 캠페인 URL 입력 시 거부'",
    subarea: "Optional sub-section in Korean such as '부정 케이스'; empty string if none",
    steps: "Concrete, observable steps in Korean a tester can follow",
  },
  en: {
    title: "Imperative, specific test case title, e.g. 'Reject malformed campaign URL'",
    subarea: "Optional sub-section such as 'Negative Cases'; empty string if none",
    steps: "Concrete, observable steps a tester can follow",
  },
};

function caseSchemaFor(locale: Locale) {
  const d = CASE_DESCRIPTIONS[locale];
  return z.object({
    title: z.string().describe(d.title),
    area: z.string().describe("Top-level feature area, used as the section name"),
    subarea: z.string().describe(d.subarea),
    type: z.enum(CASE_TYPES),
    priority: z.enum(PRIORITIES),
    preconditions: z.string(),
    steps: z.array(z.string()).describe(d.steps),
    expectedResult: z.string(),
    tags: z.array(z.string()),
    rationale: z.string().describe("Which evidence from the analysis motivated this case"),
  });
}

function casesSchemaFor(locale: Locale) {
  return z.object({
    cases: z.array(caseSchemaFor(locale)),
    coverageNotes: z.string().describe("Short note on what is covered and what could not be inferred"),
    siteSummary: z
      .string()
      .describe(
        locale === "en"
          ? "3-4 plain sentences describing what this website/product is, who it is for and its main features"
          : "이 사이트/제품이 무엇이고 누구를 위한 것이며 주요 기능이 무엇인지 3~4문장의 쉬운 한국어로 요약",
      ),
  });
}

/** Korean (default) output contract. */
export const generatedCaseSchema = caseSchemaFor("ko");
export type GeneratedCase = z.infer<typeof generatedCaseSchema>;

export const generatedCasesSchema = casesSchemaFor("ko");
const generatedCasesSchemaEn = casesSchemaFor("en");

/** The case-generation contract whose descriptions ask for the given language. */
export function generatedCasesSchemaFor(locale: Locale): typeof generatedCasesSchema {
  return locale === "en" ? generatedCasesSchemaEn : generatedCasesSchema;
}

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
