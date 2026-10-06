import { AppError } from "@/lib/errors";
import type { ExecutionMode, ResultStatus } from "./constants";
import type { TestResult, TestRun } from "./types";

/**
 * Result state machine for a single case inside a run.
 *
 *   untested ──record──▶ passed | failed | blocked | skipped
 *   any executed state ──re-test──▶ any executed state   (attempts += 1)
 *   any executed state ──reset──▶ untested
 *
 * Guards:
 * - a completed run is read-only until it is reopened
 * - resetting a case that was never executed is rejected (nothing to reset)
 * - an automated result never silently overwrites a newer manual verdict from the same run
 *   that a tester recorded after the automation run started
 */
export function assertCanRecordResult(params: {
  run: TestRun;
  current: TestResult | null;
  next: ResultStatus;
  mode: ExecutionMode;
  automationStartedAt?: string | null;
}): void {
  const { run, current, next, mode, automationStartedAt } = params;
  if (run.status === "completed") {
    throw new AppError("invalid_state", "This run is completed. Reopen it to change results.");
  }
  if (next === "untested" && (!current || current.status === "untested")) {
    throw new AppError("invalid_state", "This case has no result to reset.");
  }
  if (
    mode === "automated" &&
    current?.mode === "manual" &&
    current.status !== "untested" &&
    automationStartedAt &&
    current.executedAt &&
    current.executedAt > automationStartedAt
  ) {
    throw new AppError(
      "conflict",
      "A tester recorded a manual result after this automation run started; keeping the manual verdict.",
    );
  }
}
