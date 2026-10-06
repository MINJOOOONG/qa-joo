import { errorResponse } from "@/lib/errors";
import { getServiceContext } from "@/lib/server-context";
import { getAutomationRunDetail } from "@/lib/services/automation";

/** GET /api/automation/runs/:id — run status, per-case results and summary. */
export async function GET(_request: Request, { params }: RouteContext<"/api/automation/runs/[id]">) {
  try {
    const ctx = await getServiceContext();
    const { id } = await params;
    const detail = await getAutomationRunDetail(ctx, id);
    return Response.json({
      run: detail.run,
      summary: detail.summary,
      results: detail.rows.map((row) => ({
        testCaseId: row.testCase.id,
        caseKey: row.testCase.caseKey,
        title: row.testCase.title,
        result: row.result,
      })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
