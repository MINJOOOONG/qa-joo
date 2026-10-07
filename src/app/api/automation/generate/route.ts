import { generateAutomationDraft } from "@/lib/ai/automation-generator";
import { getLlmProvider } from "@/lib/ai/provider";
import { parsePage } from "@/lib/analyzer/html";
import { generateAutomationRequestSchema } from "@/lib/domain/schemas";
import { getConfig } from "@/lib/env";
import { readJsonBody } from "@/lib/http";
import { safeFetch } from "@/lib/security/safe-fetch";
import { localizedErrorResponse } from "@/lib/i18n/error-response";
import { getServiceContext } from "@/lib/server-context";
import { generateAutomationForCase } from "@/lib/services/automation";

export const maxDuration = 120;

/** POST /api/automation/generate — Test case → Playwright draft (saved as draft, never executed). */
export async function POST(request: Request) {
  try {
    const ctx = await getServiceContext();
    const { testCaseId } = generateAutomationRequestSchema.parse(await readJsonBody(request));
    const config = getConfig();
    const provider = getLlmProvider();
    const result = await generateAutomationForCase(
      ctx,
      {
        fetchEntryPage: async (appUrl) => {
          const response = await safeFetch(appUrl, {
            allowPrivate: config.analyzer.allowPrivateTargets,
            accept: ["text/html", "application/xhtml+xml"],
            maxBytes: 1_500_000,
          });
          return response.status < 400 ? parsePage(response.body, response.url) : null;
        },
        generate: (input) => generateAutomationDraft(input, provider),
      },
      testCaseId,
    );
    return Response.json(result, { status: 201 });
  } catch (error) {
    return localizedErrorResponse(error);
  }
}
