import "server-only";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { getConfig } from "@/lib/env";
import { AppError } from "@/lib/errors";
import type { AutomationRun, Project } from "@/lib/domain/types";

export interface DispatchResult {
  externalUrl: string | null;
  note: string;
}

export type Dispatcher = (run: AutomationRun, project: Project) => Promise<DispatchResult>;

/**
 * Starts the Playwright runner for a queued automation run.
 * - local:    spawns `npm run qa:runner` on this machine (dev / self-hosted only)
 * - github:   triggers .github/workflows/qa-automation.yml via workflow_dispatch
 * - external: does nothing; an operator or scheduler starts the runner with the run id
 */
export function getDispatcher(): Dispatcher {
  const config = getConfig();
  return async (run, project) => {
    if (run.runner === "external") {
      return { externalUrl: null, note: "Waiting for an external runner to pick up this run." };
    }
    if (!config.runner.callbackSecret) {
      throw new AppError("not_configured", "Set RUNNER_CALLBACK_SECRET so runners can report results.");
    }
    if (run.runner === "github") {
      const { token, repository, workflow, ref } = config.runner.github;
      if (!token || !repository) {
        throw new AppError("not_configured", "Set GITHUB_DISPATCH_TOKEN and GITHUB_DISPATCH_REPOSITORY to use the GitHub runner.");
      }
      const response = await fetch(`https://api.github.com/repos/${repository}/actions/workflows/${workflow}/dispatches`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          accept: "application/vnd.github+json",
          "x-github-api-version": "2022-11-28",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          ref,
          inputs: {
            automation_run_id: run.id,
            project: project.key,
            target_url: run.targetUrl,
            test_run_id: run.testRunId ?? "",
            test_case_ids: run.testCaseIds.join(","),
          },
        }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) {
        throw new AppError("upstream", `GitHub rejected the workflow dispatch (HTTP ${response.status}).`);
      }
      return {
        externalUrl: `https://github.com/${repository}/actions/workflows/${workflow}`,
        note: "Dispatched to GitHub Actions.",
      };
    }

    // Local runner: a detached child process so the request returns immediately.
    const workspace = path.resolve(".qa-joo-runs", run.id);
    fs.mkdirSync(workspace, { recursive: true });
    const log = fs.openSync(path.join(workspace, "runner.log"), "a");
    // Only what the runner needs: no database keys, AI keys or dispatch tokens.
    const env: Record<string, string | undefined> = {
      QA_JOO_URL: config.publicUrl,
      RUNNER_CALLBACK_SECRET: config.runner.callbackSecret,
    };
    for (const key of ["PATH", "HOME", "TMPDIR", "LANG", "PLAYWRIGHT_BROWSERS_PATH", "PLAYWRIGHT_CHROMIUM_EXECUTABLE", "SystemRoot"]) {
      if (process.env[key] !== undefined) env[key] = process.env[key];
    }
    const tsx = path.join(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs");
    const child = spawn(process.execPath, [tsx, path.join("runner", "qa-runner.ts"), "--run", run.id], {
      cwd: process.cwd(),
      detached: true,
      stdio: ["ignore", log, log],
      env: env as NodeJS.ProcessEnv,
    });
    child.unref();
    return { externalUrl: null, note: `Local runner started (pid ${child.pid}).` };
  };
}
