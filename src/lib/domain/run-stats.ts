import type { ResultStatus } from "./constants";

export interface RunStats {
  total: number;
  passed: number;
  failed: number;
  blocked: number;
  skipped: number;
  untested: number;
  /** Cases with any result other than untested. */
  executed: number;
  /** executed / total, 0..1 */
  progress: number;
  /**
   * passed / (passed + failed + blocked), 0..1. Skipped cases are excluded because they were
   * intentionally not evaluated. `null` until at least one case has a verdict.
   */
  passRate: number | null;
}

/**
 * @param total number of cases in the run
 * @param statuses current result status of every case that has a result row
 */
export function computeRunStats(total: number, statuses: ReadonlyArray<ResultStatus>): RunStats {
  const counts = { passed: 0, failed: 0, blocked: 0, skipped: 0 };
  for (const status of statuses) {
    if (status !== "untested") counts[status] += 1;
  }
  const executed = Math.min(total, counts.passed + counts.failed + counts.blocked + counts.skipped);
  const verdicts = counts.passed + counts.failed + counts.blocked;
  return {
    total,
    ...counts,
    untested: Math.max(0, total - executed),
    executed,
    progress: total === 0 ? 0 : executed / total,
    passRate: verdicts === 0 ? null : counts.passed / verdicts,
  };
}

export function formatPercent(value: number | null, fallback = "—"): string {
  if (value === null || Number.isNaN(value)) return fallback;
  return `${Math.round(value * 100)}%`;
}

export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return "—";
  // One format everywhere: seconds with one decimal under a minute ("0.2s", "12.4s"), then "2m 5s".
  if (ms <= 0) return "0s";
  const seconds = Math.max(ms, 100) / 1000;
  if (seconds < 59.95) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${Math.round(seconds % 60)}s`;
}
