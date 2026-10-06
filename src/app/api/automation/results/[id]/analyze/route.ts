import { analyzeFailure } from "@/lib/ai/failure-analyzer";
import { getLlmProvider } from "@/lib/ai/provider";
import { errorResponse } from "@/lib/errors";
import { getServiceContext } from "@/lib/server-context";
import { analyzeAutomationFailure } from "@/lib/services/automation";

export const maxDuration = 120;

/** POST /api/automation/results/:id/analyze — AI failure triage, stored as a suggestion. */
export async function POST(_request: Request, { params }: RouteContext<"/api/automation/results/[id]/analyze">) {
  try {
    const ctx = await getServiceContext();
    const { id } = await params;
    const provider = getLlmProvider();
    const result = await analyzeAutomationFailure(ctx, { analyze: (context) => analyzeFailure(context, provider) }, id);
    return Response.json({ result });
  } catch (error) {
    return errorResponse(error);
  }
}
