import { parseJson, readVerifiedRunnerBody } from "@/lib/automation/verify-runner";
import { errorResponse } from "@/lib/errors";
import { getRunnerContext } from "@/lib/server-context";
import { applyRunnerCallback } from "@/lib/services/automation";

/** POST /api/automation/results — runner callback with status and per-case results (HMAC-signed). */
export async function POST(request: Request) {
  try {
    const body = await readVerifiedRunnerBody(request, 2_000_000);
    const { run, accepted, mirrored, dropped } = await applyRunnerCallback(await getRunnerContext(), parseJson(body));
    return Response.json({ run: { id: run.id, status: run.status }, accepted, mirrored, dropped });
  } catch (error) {
    return errorResponse(error);
  }
}
