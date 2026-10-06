import { describe, expect, it } from "vitest";
import { computeRunStats, formatDuration, formatPercent } from "./run-stats";

describe("computeRunStats", () => {
  it("handles an empty run", () => {
    expect(computeRunStats(0, [])).toMatchObject({ total: 0, executed: 0, progress: 0, passRate: null, untested: 0 });
  });

  it("counts statuses and treats missing results as untested", () => {
    const stats = computeRunStats(10, ["passed", "passed", "failed", "blocked", "skipped", "untested"]);
    expect(stats).toMatchObject({ passed: 2, failed: 1, blocked: 1, skipped: 1, untested: 5, executed: 5 });
    expect(stats.progress).toBeCloseTo(0.5);
  });

  it("excludes skipped cases from the pass rate", () => {
    const stats = computeRunStats(4, ["passed", "passed", "failed", "skipped"]);
    expect(stats.passRate).toBeCloseTo(2 / 3);
  });

  it("returns a null pass rate until something has a verdict", () => {
    expect(computeRunStats(3, ["skipped"]).passRate).toBeNull();
  });

  it("never reports more executed cases than exist", () => {
    const stats = computeRunStats(1, ["passed", "passed"]);
    expect(stats.executed).toBe(1);
    expect(stats.untested).toBe(0);
    expect(stats.progress).toBe(1);
  });

  it("formats percentages and durations", () => {
    expect(formatPercent(0.923)).toBe("92%");
    expect(formatPercent(null)).toBe("—");
    expect(formatDuration(850)).toBe("850ms");
    expect(formatDuration(2400)).toBe("2.4s");
    expect(formatDuration(125_000)).toBe("2m 5s");
    expect(formatDuration(null)).toBe("—");
  });
});
