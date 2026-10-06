import "server-only";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import type { LlmProvider, StructuredRequest } from "./provider";

/** Minimal OpenAI Chat Completions client using JSON-schema response format. */
export class OpenAIProvider implements LlmProvider {
  readonly name = "openai" as const;

  constructor(
    private readonly apiKey: string,
    readonly model: string,
    private readonly timeoutMs: number,
  ) {}

  async generate<T>(request: StructuredRequest<T>): Promise<T> {
    const { $schema: _ignored, ...schema } = z.toJSONSchema(request.schema) as Record<string, unknown>;
    void _ignored;
    let response: Response;
    try {
      response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        signal: AbortSignal.timeout(this.timeoutMs),
        headers: { authorization: `Bearer ${this.apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          model: this.model,
          max_completion_tokens: request.maxTokens ?? 16_000,
          messages: [
            { role: "system", content: request.system },
            { role: "user", content: request.prompt },
          ],
          response_format: {
            type: "json_schema",
            json_schema: { name: request.schemaName, schema, strict: false },
          },
        }),
      });
    } catch (error) {
      if ((error as Error).name === "TimeoutError") throw new AppError("upstream", "The AI request timed out.");
      throw new AppError("upstream", "Could not reach the OpenAI API.");
    }
    if (response.status === 401) throw new AppError("not_configured", "OPENAI_API_KEY was rejected by the OpenAI API.");
    if (response.status === 429) throw new AppError("upstream", "OpenAI rate limit reached. Try again in a minute.");
    if (!response.ok) throw new AppError("upstream", `OpenAI API error (${response.status}).`);

    const body = (await response.json()) as {
      choices?: Array<{ finish_reason?: string; message?: { content?: string | null; refusal?: string | null } }>;
    };
    const choice = body.choices?.[0];
    if (choice?.message?.refusal) throw new AppError("upstream", "The AI provider declined this request.");
    if (choice?.finish_reason === "length") throw new AppError("upstream", "The AI response was cut off.");
    try {
      return request.schema.parse(JSON.parse(choice?.message?.content ?? ""));
    } catch {
      throw new AppError("upstream", "The AI response did not match the expected format.");
    }
  }
}
