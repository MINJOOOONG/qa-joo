import { readVerifiedRunnerBody } from "@/lib/automation/verify-runner";
import { errorResponse } from "@/lib/errors";
import { getRunnerContext } from "@/lib/server-context";
import { buildRunnerManifest } from "@/lib/services/automation";

/** GET /api/automation/runs/:id/manifest — approved specs for a runner (HMAC-signed request). */
export async function GET(request: Request, { params }: RouteContext<"/api/automation/runs/[id]/manifest">) {
  try {
    await readVerifiedRunnerBody(request, 0);
    const { id } = await params;
    return Response.json(await buildRunnerManifest(await getRunnerContext(), id));
  } catch (error) {
    return errorResponse(error);
  }
}
