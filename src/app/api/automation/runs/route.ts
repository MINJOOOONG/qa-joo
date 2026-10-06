import { getDispatcher } from "@/lib/automation/dispatch";
import { getConfig } from "@/lib/env";
import { errorResponse } from "@/lib/errors";
import { readJsonBody } from "@/lib/http";
import { getServiceContext } from "@/lib/server-context";
import { createAutomationRun } from "@/lib/services/automation";

/** POST /api/automation/runs — queue an automation run and hand it to the configured runner. */
export async function POST(request: Request) {
  try {
    const ctx = await getServiceContext();
    const config = getConfig();
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
