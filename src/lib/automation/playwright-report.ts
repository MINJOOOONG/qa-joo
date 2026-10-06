/**
 * Parses Playwright's JSON reporter output into per-spec results. Kept dependency-free so both
 * the runner CLI and unit tests can use it.
 */
export interface ParsedSpecResult {
  file: string;
  title: string;
  status: "passed" | "failed" | "skipped";
  durationMs: number;
  errorMessage: string | null;
  screenshotPath: string | null;
  tracePath: string | null;
}

interface JsonAttachment {
  name?: string;
  contentType?: string;
  path?: string;
}
interface JsonResult {
  status?: string;
  duration?: number;
  error?: { message?: string; stack?: string };
  errors?: Array<{ message?: string }>;
  attachments?: JsonAttachment[];
}
interface JsonTest {
  status?: string;
  results?: JsonResult[];
}
interface JsonSpec {
  title?: string;
  file?: string;
  tests?: JsonTest[];
}
interface JsonSuite {
  file?: string;
  specs?: JsonSpec[];
  suites?: JsonSuite[];
}
export interface PlaywrightJsonReport {
  suites?: JsonSuite[];
  errors?: Array<{ message?: string }>;
}

const ANSI = /\u001b\[[0-9;]*m/g;

export function stripAnsi(value: string): string {
  return value.replace(ANSI, "");
}

function collectSpecs(suite: JsonSuite, file: string | undefined, out: Array<{ file: string; spec: JsonSpec }>) {
  const current = suite.file ?? file ?? "";
  for (const spec of suite.specs ?? []) out.push({ file: spec.file ?? current, spec });
  for (const child of suite.suites ?? []) collectSpecs(child, current, out);
}

export function parsePlaywrightReport(report: PlaywrightJsonReport): ParsedSpecResult[] {
  const specs: Array<{ file: string; spec: JsonSpec }> = [];
  for (const suite of report.suites ?? []) collectSpecs(suite, undefined, specs);

  return specs.map(({ file, spec }) => {
    const test = spec.tests?.[0];
    const results = test?.results ?? [];
    const last = results[results.length - 1];
    const outcome = test?.status; // expected | unexpected | flaky | skipped
    const status: ParsedSpecResult["status"] =
      outcome === "skipped" ? "skipped" : outcome === "unexpected" ? "failed" : outcome === "expected" || outcome === "flaky" ? "passed" : last?.status === "passed" ? "passed" : "failed";
    const attachments = results.flatMap((result) => result.attachments ?? []);
    const screenshot = [...attachments].reverse().find((a) => a.name === "screenshot" || a.contentType?.startsWith("image/"));
    const trace = [...attachments].reverse().find((a) => a.name === "trace" || a.contentType === "application/zip");
    const message = last?.error?.message ?? last?.errors?.[0]?.message ?? null;
    return {
      file: file.replace(/\\/g, "/"),
      title: spec.title ?? "",
      status,
      durationMs: Math.round(results.reduce((sum, result) => sum + (result.duration ?? 0), 0)),
      errorMessage: status === "failed" ? stripAnsi(message ?? "Test failed without an error message.").slice(0, 8000) : null,
      screenshotPath: status === "failed" ? (screenshot?.path ?? null) : null,
      tracePath: status === "failed" ? (trace?.path ?? null) : null,
    };
  });
}
