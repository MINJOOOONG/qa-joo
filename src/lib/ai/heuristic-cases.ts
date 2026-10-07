import { UNHAPPY_CASE_TYPES } from "@/lib/domain/constants";
import type { ProjectAnalysis } from "@/lib/analyzer/types";
import type { Locale } from "@/lib/i18n/config";
import { englishGapCases, englishHeuristicCases } from "./heuristic-cases-en";
import { koreanGapCases, koreanHeuristicCases, SUBAREAS } from "./heuristic-cases-ko";
import type { GeneratedCase } from "./schemas";

export { SUBAREAS };

/**
 * Deterministic test-case generator used when no AI provider is configured, and to top up AI
 * output that lacks unhappy-path coverage. Every case is derived from a concrete signal found by
 * the analyzer (a field, a button, a route, a repository hint), and says so in its rationale.
 *
 * Cases are written in the UI language at generation time (Korean by default, or English).
 * Steps follow fixed phrasings that the Playwright draft generator understands in both languages.
 */
export function heuristicTestCases(
  projectName: string,
  analysis: ProjectAnalysis,
  maxCases: number,
  locale: Locale = "ko",
): GeneratedCase[] {
  const cases = locale === "en" ? englishHeuristicCases(projectName, analysis) : koreanHeuristicCases(projectName, analysis);
  return balanceCases(dedupeCases(cases), maxCases);
}

/**
 * Candidates for "fill gaps" without an AI provider: gap-only cases (linked pages, back/refresh,
 * keyboard-only, mobile layout, whitespace input, …) first, then any step-1 case that is still
 * missing. The caller dedupes against existing and dismissed titles and balances the result.
 */
export function heuristicGapCandidates(projectName: string, analysis: ProjectAnalysis, locale: Locale = "ko"): GeneratedCase[] {
  const gaps = locale === "en" ? englishGapCases(projectName, analysis) : koreanGapCases(projectName, analysis);
  const base = locale === "en" ? englishHeuristicCases(projectName, analysis) : koreanHeuristicCases(projectName, analysis);
  return dedupeCases([...gaps, ...base]);
}

/** Normalized form used to compare case titles (case/punctuation-insensitive). Idempotent. */
export const normalizeTitle = (title: string) => title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

export function dedupeCases(cases: GeneratedCase[], existingTitles: string[] = []): GeneratedCase[] {
  const seen = new Set(existingTitles.map(normalizeTitle));
  const result: GeneratedCase[] = [];
  for (const testCase of cases) {
    const key = normalizeTitle(testCase.title);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(testCase);
  }
  return result;
}

export function unhappyShare(cases: GeneratedCase[]): number {
  if (cases.length === 0) return 0;
  return cases.filter((c) => UNHAPPY_CASE_TYPES.includes(c.type)).length / cases.length;
}

/**
 * Picks up to `max` cases so that at least ~40% are unhappy-path and every unhappy type that has
 * a candidate is represented, while keeping smoke/happy-path coverage first.
 */
export function balanceCases(cases: GeneratedCase[], max: number): GeneratedCase[] {
  if (cases.length <= max) return orderCases(cases);
  const selected: GeneratedCase[] = [];
  const take = (predicate: (c: GeneratedCase) => boolean, limit: number) => {
    for (const c of cases) {
      if (selected.length >= max || limit <= 0) return;
      if (!selected.includes(c) && predicate(c)) {
        selected.push(c);
        limit -= 1;
      }
    }
  };
  for (const type of UNHAPPY_CASE_TYPES) take((c) => c.type === type, 1);
  take((c) => c.type === "smoke" && c.priority === "critical", 1);
  take((c) => c.type === "functional", 2);
  const unhappyTarget = Math.ceil(max * 0.4);
  take((c) => UNHAPPY_CASE_TYPES.includes(c.type), Math.max(0, unhappyTarget - selected.filter((c) => UNHAPPY_CASE_TYPES.includes(c.type)).length));
  take(() => true, max);
  return orderCases(selected);
}

const SUBAREA_RANK: string[][] = [
  ["smoke", SUBAREAS.smoke],
  ["happy path", SUBAREAS.happy],
  ["functional", "기능"],
  ["negative cases", SUBAREAS.negative],
  ["boundary", SUBAREAS.boundary],
  ["security", SUBAREAS.security],
  ["error handling", SUBAREAS.error],
  ["navigation", "내비게이션"],
  ["usability", "사용성"],
];

/** Groups cases by area (first-seen order), then smoke → happy path → negative → boundary → security → error. */
export function orderCases(cases: GeneratedCase[]): GeneratedCase[] {
  const areaOrder = new Map<string, number>();
  for (const c of cases) if (!areaOrder.has(c.area)) areaOrder.set(c.area, areaOrder.size);
  const rank = (c: GeneratedCase) => {
    const index = SUBAREA_RANK.findIndex((names) => names.includes(c.subarea.toLowerCase()));
    return index === -1 ? SUBAREA_RANK.length : index;
  };
  return cases
    .map((c, index) => ({ c, index }))
    .sort((a, b) => areaOrder.get(a.c.area)! - areaOrder.get(b.c.area)! || rank(a.c) - rank(b.c) || a.index - b.index)
    .map(({ c }) => c);
}
