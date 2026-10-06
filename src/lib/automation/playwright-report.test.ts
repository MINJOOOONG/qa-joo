import { describe, expect, it } from "vitest";
import { parsePlaywrightReport, stripAnsi } from "./playwright-report";

const report = {
  suites: [
    {
      title: "reviewforge",
      file: "reviewforge/RF-TC-001.spec.ts",
      specs: [
        {
          title: "RF-TC-001 Analyze valid URL",
          file: "reviewforge/RF-TC-001.spec.ts",
          tests: [{ status: "expected", results: [{ status: "passed", duration: 2400, attachments: [] }] }],
        },
      ],
      suites: [
        {
          title: "nested",
          file: "reviewforge/RF-TC-003.spec.ts",
          specs: [
            {
              title: "RF-TC-003 Reject localhost",
              tests: [
                {
                  status: "unexpected",
                  results: [
                    {
                      status: "failed",
                      duration: 1800.4,
                      error: { message: "\u001b[31mError: expect(locator).toBeVisible() failed\u001b[39m" },
                      attachments: [
                        { name: "screenshot", contentType: "image/png", path: "/tmp/a/test-failed-1.png" },
                        { name: "trace", contentType: "application/zip", path: "/tmp/a/trace.zip" },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      file: "reviewforge/RF-TC-004.spec.ts",
      specs: [
        { title: "flaky", file: "reviewforge/RF-TC-004.spec.ts", tests: [{ status: "flaky", results: [{ status: "failed", duration: 100 }, { status: "passed", duration: 200 }] }] },
        { title: "skipped", file: "reviewforge/RF-TC-005.spec.ts", tests: [{ status: "skipped", results: [] }] },
      ],
    },
  ],
};

describe("parsePlaywrightReport", () => {
  const parsed = parsePlaywrightReport(report);

  it("maps every spec with its file", () => {
    expect(parsed.map((r) => [r.file, r.status])).toEqual([
      ["reviewforge/RF-TC-001.spec.ts", "passed"],
      ["reviewforge/RF-TC-003.spec.ts", "failed"],
      ["reviewforge/RF-TC-004.spec.ts", "passed"],
      ["reviewforge/RF-TC-005.spec.ts", "skipped"],
    ]);
  });

  it("keeps errors and artifacts only for failures", () => {
    expect(parsed[1]).toMatchObject({
      durationMs: 1800,
      errorMessage: "Error: expect(locator).toBeVisible() failed",
      screenshotPath: "/tmp/a/test-failed-1.png",
      tracePath: "/tmp/a/trace.zip",
    });
    expect(parsed[0]).toMatchObject({ errorMessage: null, screenshotPath: null, tracePath: null, durationMs: 2400 });
  });

  it("sums retry durations for flaky tests", () => {
    expect(parsed[2].durationMs).toBe(300);
  });

  it("strips ANSI codes", () => {
    expect(stripAnsi("\u001b[2mdim\u001b[22m")).toBe("dim");
  });
});

describe("aggregateByFile", () => {
  const base = { title: "t", durationMs: 10, errorMessage: null, screenshotPath: null, tracePath: null };
  it("fails a file when any of its tests failed", async () => {
    const { aggregateByFile } = await import("./playwright-report");
    const map = aggregateByFile([
      { ...base, file: "a.spec.ts", status: "passed" },
      { ...base, file: "a.spec.ts", status: "failed", errorMessage: "boom" },
      { ...base, file: "b.spec.ts", status: "skipped" },
    ]);
    expect(map.get("a.spec.ts")).toMatchObject({ status: "failed", errorMessage: "boom", durationMs: 20 });
    expect(map.get("b.spec.ts")?.status).toBe("skipped");
  });
});
