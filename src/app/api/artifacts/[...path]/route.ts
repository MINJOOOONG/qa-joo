import { loadArtifact } from "@/lib/automation/artifacts";
import { localizedErrorResponse } from "@/lib/i18n/error-response";
import { getServiceContext } from "@/lib/server-context";

/** GET /api/artifacts/<runId>/<file> — serves stored screenshots, traces and logs to signed-in users. */
export async function GET(_request: Request, { params }: RouteContext<"/api/artifacts/[...path]">) {
  try {
    await getServiceContext();
    const { path } = await params;
    const artifact = await loadArtifact(path.join("/"));
    if (artifact.kind === "redirect") return Response.redirect(artifact.url, 302);
    return new Response(Buffer.from(artifact.bytes), {
      headers: {
        "content-type": artifact.contentType,
        "cache-control": "private, max-age=3600",
        "x-content-type-options": "nosniff",
        // Artifacts are untrusted output of the app under test: never let HTML artifacts run scripts here.
        "content-security-policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
        ...(artifact.contentType === "application/zip" ? { "content-disposition": `attachment; filename="${path.at(-1)}"` } : {}),
      },
    });
  } catch (error) {
    return localizedErrorResponse(error);
  }
}
