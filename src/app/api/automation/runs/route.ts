import { z } from "zod";
import { getDispatcher } from "@/lib/automation/dispatch";
import { SIGNATURE_HEADER } from "@/lib/automation/runner-auth";
import { parseJson, readVerifiedRunnerBody } from "@/lib/automation/verify-runner";
import { getConfig } from "@/lib/env";
import { AppError, errorResponse } from "@/lib/errors";
import { readJsonBody } from "@/lib/http";
import { getRunnerContext, getServiceContext } from "@/lib/server-context";
import { createAutomationRun } from "@/lib/services/automation";

const runnerCreateSchema = z.object({
  projectKey: z.string().min(2).max(10),
  trigger: z.enum(["github", "scheduled"]),
  testRunId: z.string().optional(),
  environment: z.enum(["local", "development", "staging", "production"]).optional(),
});

/**
 * POST /api/automation/runs — queue an automation run.
 * - From the UI (session): the run is handed to the configured runner (local / GitHub / external).
 * - From a runner (HMAC-signed, e.g. a scheduled GitHub workflow): the run is created with
 *   trigger github|scheduled and the calling runner executes it itself.
 */
export async function POST(request: Request) {
  try {
    const config = getConfig();
    if (request.headers.get(SIGNATURE_HEADER)) {
      const body = runnerCreateSchema.parse(parseJson(await readVerifiedRunnerBody(request, 50_000)));
      const ctx = await getRunnerContext();
      const project = await ctx.repo.getProjectByKey(body.projectKey);
      if (!project) throw new AppError("not_found", `Project ${body.projectKey} was not found.`);
      const run = await createAutomationRun(
        ctx,
        { projectId: project.id, testRunId: body.testRunId, environment: body.environment },
        {
          defaultRunner: "external",
          allowPrivateTargets: config.analyzer.allowPrivateTargets,
          dispatch: async () => ({ externalUrl: null, note: "Executed by the calling runner." }),
          trigger: body.trigger,
        },
      );
      return Response.json({ run }, { status: 201 });
    }

    const ctx = await getServiceContext();
    const run = await createAutomationRun(ctx, await readJsonBody(request), {
      defaultRunner: config.runner.mode,
      allowPrivateTargets: config.analyzer.allowPrivateTargets,
      dispatch: getDispatcher(),
    });
    return Response.json({ run }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
