import {
  AUTOMATION_STATUSES,
  CASE_SOURCES,
  CASE_TYPES,
  PRIORITIES,
  RESULT_STATUSES,
  REVIEW_STATUSES,
  type AutomationStatus,
  type CaseSource,
  type CaseType,
  type Priority,
  type ResultStatus,
  type ReviewStatus,
} from "@/lib/domain/constants";

export type CaseSearchParams = Record<string, string | string[] | undefined>;

export interface CaseQuery {
  project: string | null;
  section: string | null;
  type: CaseType | null;
  priority: Priority | null;
  automation: AutomationStatus | null;
  result: ResultStatus | null;
  source: CaseSource | null;
  review: ReviewStatus | null;
  q: string;
  caseId: string | null;
}

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? null;
function pick<T extends string>(value: string | null, allowed: readonly T[]): T | null {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

export function parseCaseQuery(params: CaseSearchParams): CaseQuery {
  return {
    project: one(params.project),
    section: one(params.section),
    type: pick(one(params.type), CASE_TYPES),
    priority: pick(one(params.priority), PRIORITIES),
    automation: pick(one(params.automation), AUTOMATION_STATUSES),
    result: pick(one(params.result), RESULT_STATUSES),
    source: pick(one(params.source), CASE_SOURCES),
    review: pick(one(params.review), REVIEW_STATUSES),
    q: (one(params.q) ?? "").slice(0, 100),
    caseId: one(params.case),
  };
}

/** Builds a URL for the current explorer with some params replaced (null removes a param). */
export function hrefWith(basePath: string, params: CaseSearchParams, changes: Record<string, string | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const v = one(value);
    if (v) search.set(key, v);
  }
  for (const [key, value] of Object.entries(changes)) {
    if (value === null) search.delete(key);
    else search.set(key, value);
  }
  const query = search.toString();
  return query ? `${basePath}?${query}` : basePath;
}
