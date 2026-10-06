/**
 * QA JOO Playwright runner.
 *
 *   npm run qa:runner -- --run <automationRunId> [--url https://qa-joo.example.com]
 *   npm run qa:runner -- --create --project RF [--trigger scheduled|github]
 *
 * Environment:
 *   QA_JOO_URL                      Base URL of QA JOO (default http://localhost:3000)
 *   RUNNER_CALLBACK_SECRET          Shared HMAC secret (required)
 *   PLAYWRIGHT_CHROMIUM_EXECUTABLE  Optional Chromium binary to use
 *   GITHUB_*                        Picked up automatically inside GitHub Actions
 *
 * The runner trusts only the manifest served by QA JOO (approved specs for this run), never
 * workflow inputs, and writes specs into an isolated workspace under .qa-joo-runs/<runId>/.
 */
import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { isSafeSpecPath } from "../src/lib/automation/paths";
import { parsePlaywrightReport, stripAnsi, type ParsedSpecResult, type PlaywrightJsonReport } from "../src/lib/automation/playwright-report";
import { signRequest } from "../src/lib/automation/runner-auth";

interface Manifest {
  automationRunId: string;
  project: { id: string; key: string; name: string };
  targetUrl: string;
  environment: string;
  tests: Array<{ testCaseId: string; caseKey: string; title: string; filePath: string; code: string }>;
}

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

let runId = argument("run") ?? process.env.QA_JOO_AUTOMATION_RUN_ID;
const baseUrl = (argument("url") ?? process.env.QA_JOO_URL ?? "http://localhost:3000").replace(/\/+$/, "");
const secret = process.env.RUNNER_CALLBACK_SECRET;
const root = process.cwd();

function log(message: string) {
  console.log(`[qa-joo-runner] ${message}`);
}

async function call<T>(method: "GET" | "POST", pathWithQuery: string, body?: string | Uint8Array, contentType = "application/json"): Promise<T> {
  const headers: Record<string, string> = { ...signRequest(secret!, method, pathWithQuery, body ?? "") };
  if (body !== undefined) headers["content-type"] = contentType;
  const response = await fetch(`${baseUrl}${pathWithQuery}`, { method, headers, body: body as BodyInit | undefined });
  const json = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
  if (!response.ok) throw new Error(`${method} ${pathWithQuery} failed (${response.status}): ${json.error?.message ?? "no details"}`);
  return json as T;
}

function ciContext() {
  const { GITHUB_SERVER_URL, GITHUB_REPOSITORY, GITHUB_RUN_ID, GITHUB_REF_NAME, GITHUB_SHA } = process.env;
  return {
    branch: GITHUB_REF_NAME ?? null,
    commitSha: GITHUB_SHA ?? null,
    externalUrl:
      GITHUB_SERVER_URL && GITHUB_REPOSITORY && GITHUB_RUN_ID
        ? `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}`
        : null,
  };
}

async function upload(file: string | null, name: string, contentType: string): Promise<string | null> {
  if (!file) return null;
  try {
    const bytes = new Uint8Array(await fs.readFile(file));
    const query = `/api/automation/artifacts?runId=${encodeURIComponent(runId!)}&name=${encodeURIComponent(name)}`;
    const { url } = await call<{ url: string }>("POST", query, bytes, contentType);
    return url.startsWith("/") ? `${baseUrl}${url}` : url;
  } catch (error) {
    log(`artifact upload failed for ${name}: ${(error as Error).message}`);
    return null;
  }
}

async function runPlaywright(configPath: string, logFile: string): Promise<number> {
  const out = createWriteStream(logFile);
  return new Promise((resolve) => {
    const child = spawn(process.platform === "win32" ? "npx.cmd" : "npx", ["playwright", "test", "--config", configPath], {
      cwd: root,
      env: { ...process.env, FORCE_COLOR: "0" },
    });
    child.stdout.on("data", (chunk) => {
      process.stdout.write(chunk);
      out.write(chunk);
    });
    child.stderr.on("data", (chunk) => {
      process.stderr.write(chunk);
      out.write(chunk);
    });
    child.on("close", (code) => {
      out.end();
      resolve(code ?? 1);
    });
  });
}

async function main() {
  if (!secret) throw new Error("RUNNER_CALLBACK_SECRET is required.");
  if (process.argv.includes("--create")) {
    const projectKey = argument("project") ?? process.env.QA_JOO_PROJECT_KEY;
    const trigger = argument("trigger") === "scheduled" ? "scheduled" : "github";
    if (!projectKey || !/^[A-Z][A-Z0-9]{1,9}$/.test(projectKey)) throw new Error("Pass a project key with --project <KEY>.");
    const { run } = await call<{ run: { id: string } }>("POST", "/api/automation/runs", JSON.stringify({ projectKey, trigger }));
    runId = run.id;
    log(`created automation run ${runId} (${trigger}) for ${projectKey}`);
  }
  if (!runId || !/^[A-Za-z0-9-]{8,64}$/.test(runId)) throw new Error("Pass a valid automation run id with --run <id>.");

  const manifest = await call<Manifest>("GET", `/api/automation/runs/${runId}/manifest`);
  log(`${manifest.tests.length} approved spec(s) for ${manifest.project.key} against ${manifest.targetUrl}`);
  await call("POST", "/api/automation/results", JSON.stringify({ automationRunId: runId, status: "running", ...ciContext() }));

  const workspace = path.join(root, ".qa-joo-runs", runId);
  await fs.rm(path.join(workspace, "tests"), { recursive: true, force: true });
  await fs.rm(path.join(workspace, "artifacts"), { recursive: true, force: true });
  await fs.mkdir(workspace, { recursive: true });
  const specs = manifest.tests.filter((test) => isSafeSpecPath(test.filePath));
  for (const test of specs) {
    const target = path.join(workspace, test.filePath);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, test.code);
  }

  const origin = new URL(manifest.targetUrl).origin;
  const executable = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
  const configPath = path.join(workspace, "playwright.config.mjs");
  await fs.writeFile(
    configPath,
    `export default ${JSON.stringify(
      {
        testDir: "./tests",
        outputDir: "./artifacts",
        timeout: 30_000,
        expect: { timeout: 7_000 },
        retries: 0,
        workers: 2,
        reporter: [["list"], ["json", { outputFile: path.join(workspace, "report.json") }]],
        use: {
          baseURL: origin,
          headless: true,
          screenshot: "only-on-failure",
          trace: "retain-on-failure",
          ...(executable ? { launchOptions: { executablePath: executable } } : {}),
        },
      },
      null,
      2,
    )};\n`,
  );

  const logFile = path.join(workspace, "playwright.log");
  const exitCode = await runPlaywright(configPath, logFile);
  log(`playwright exited with code ${exitCode}`);

  let parsed: ParsedSpecResult[] = [];
  let reportErrors: string[] = [];
  try {
    const report = JSON.parse(await fs.readFile(path.join(workspace, "report.json"), "utf8")) as PlaywrightJsonReport;
    parsed = parsePlaywrightReport(report);
    reportErrors = (report.errors ?? []).map((error) => stripAnsi(error.message ?? "")).filter(Boolean);
  } catch {
    reportErrors = ["Playwright did not produce a JSON report."];
  }
  const logUrl = await upload(logFile, "playwright-log", "text/plain");

  const results = [];
  for (const test of manifest.tests) {
    const relative = test.filePath.replace(/^tests\//, "");
    const outcome = parsed.find((result) => result.file.endsWith(relative));
    if (!outcome || !isSafeSpecPath(test.filePath)) {
      results.push({
        testCaseId: test.testCaseId,
        status: "failed" as const,
        durationMs: 0,
        errorMessage: reportErrors[0]?.slice(0, 8000) ?? "The spec did not run (check for syntax errors).",
        logUrl,
      });
      continue;
    }
    results.push({
      testCaseId: test.testCaseId,
      status: outcome.status,
      durationMs: outcome.durationMs,
      errorMessage: outcome.errorMessage,
      screenshotUrl: await upload(outcome.screenshotPath, `${test.caseKey}-screenshot`, "image/png"),
      traceUrl: await upload(outcome.tracePath, `${test.caseKey}-trace`, "application/zip"),
      logUrl: outcome.status === "failed" ? logUrl : null,
    });
  }
  const failed = results.filter((result) => result.status === "failed").length;
  await call(
    "POST",
    "/api/automation/results",
    JSON.stringify({ automationRunId: runId, status: failed ? "failed" : "passed", ...ciContext(), results }),
  );
  log(`reported ${results.length} result(s): ${results.length - failed} passed, ${failed} failed`);
}

main().catch(async (error: Error) => {
  log(`fatal: ${error.message}`);
  if (runId && secret) {
    await call(
      "POST",
      "/api/automation/results",
      JSON.stringify({ automationRunId: runId, status: "failed", error: error.message.slice(0, 4000), ...ciContext() }),
    ).catch(() => undefined);
  }
  process.exitCode = 1;
});
