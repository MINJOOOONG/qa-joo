import { analyzeApplication } from "@/lib/analyzer/app-analyzer";
import { analyzeRepository } from "@/lib/analyzer/repo-analyzer";
import { getLlmProvider } from "@/lib/ai/provider";
import { generateTestCases } from "@/lib/ai/test-case-generator";
import { getConfig } from "@/lib/env";
import { errorResponse } from "@/lib/errors";
import { readJsonBody } from "@/lib/http";
import { getServiceContext } from "@/lib/server-context";
import { runProjectAnalysis } from "@/lib/services/analysis";

// Analysis crawls pages, reads a repository and waits for the model: allow a long request.
export const maxDuration = 300;

/** POST /api/projects/:id/analyze — analyze the connected sources and save AI draft test cases. */
export async function POST(request: Request, { params }: RouteContext<"/api/projects/[id]/analyze">) {
  try {
    const ctx = await getServiceContext();
    const { id } = await params;
    const body = await readJsonBody(request);
    const config = getConfig();
    const provider = getLlmProvider();
    const result = await runProjectAnalysis(
      ctx,
      {
        analyzeApplication: (url) =>
          analyzeApplication(url, {
            allowPrivate: config.analyzer.allowPrivateTargets,
            browser: config.analyzer.browserMode,
          }),
        analyzeRepository: (url) => analyzeRepository(url, { githubToken: config.analyzer.githubToken }),
        generate: (input) => generateTestCases(input, provider),
      },
      { ...body, projectId: id },
      body.mode === "gaps" ? "gaps" : "analyze",
    );
    return Response.json({
      created: result.created.length,
      caseIds: result.created.map((c) => c.id),
      summary: result.summary,
      notes: result.notes,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
