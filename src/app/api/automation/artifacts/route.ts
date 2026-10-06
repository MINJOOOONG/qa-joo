import { MAX_ARTIFACT_BYTES, saveArtifact } from "@/lib/automation/artifacts";
import { readVerifiedRunnerBody } from "@/lib/automation/verify-runner";
import { AppError, errorResponse } from "@/lib/errors";
import { getRunnerContext } from "@/lib/server-context";

/**
 * POST /api/automation/artifacts?runId=…&name=… — raw artifact upload from a runner (HMAC-signed).
 * Returns the URL QA JOO serves the artifact from.
 */
export async function POST(request: Request) {
  try {
    const body = await readVerifiedRunnerBody(request, MAX_ARTIFACT_BYTES);
    const url = new URL(request.url);
    const runId = url.searchParams.get("runId") ?? "";
    const name = url.searchParams.get("name") ?? "artifact";
    const contentType = (request.headers.get("content-type") ?? "").split(";")[0].trim();
    const ctx = await getRunnerContext();
    const run = await ctx.repo.getAutomationRun(runId);
    if (!run) throw new AppError("not_found", "Automation run not found.");
    if (run.status !== "queued" && run.status !== "running") {
      throw new AppError("invalid_state", `Automation run is already ${run.status}.`);
    }
    return Response.json({ url: await saveArtifact(run.id, name, contentType, body) }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
