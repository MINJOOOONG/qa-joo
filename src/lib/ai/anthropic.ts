import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { AppError } from "@/lib/errors";
import type { LlmProvider, StructuredRequest } from "./provider";

/** Models that accept server-side refusal fallbacks (`fallbacks: "default"`). */
const FALLBACK_MODELS = new Set(["claude-opus-5-5", "claude-opus-5", "claude-fable-5-1", "claude-sonnet-5-5"]);
/** Models that accept `output_config.effort`. */
const EFFORT_MODEL = /^claude-(opus|fable|mythos|sonnet-5)/;

export class AnthropicProvider implements LlmProvider {
  readonly name = "anthropic" as const;
  private readonly client: Anthropic;

  constructor(
    apiKey: string,
    readonly model: string,
    timeoutMs: number,
  ) {
    this.client = new Anthropic({ apiKey, timeout: timeoutMs, maxRetries: 2 });
  }

  async generate<T>(request: StructuredRequest<T>): Promise<T> {
    const useFallback = FALLBACK_MODELS.has(this.model);
    try {
      const message = await this.client.beta.messages.parse({
        model: this.model,
        max_tokens: request.maxTokens ?? 16_000,
        system: request.system,
        messages: [{ role: "user", content: request.prompt }],
        output_config: {
          format: betaZodOutputFormat(request.schema),
          ...(EFFORT_MODEL.test(this.model) ? { effort: request.effort ?? "medium" } : {}),
        },
        // If a safety classifier declines, Anthropic re-runs the request on its recommended fallback model.
        ...(useFallback ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
      });
      if (message.stop_reason === "refusal") {
        throw new AppError("upstream", "The AI provider declined this request.");
      }
      if (message.stop_reason === "max_tokens") {
        throw new AppError("upstream", "The AI response was cut off. Try generating fewer items.");
      }
      if (!message.parsed_output) {
        throw new AppError("upstream", "The AI response did not match the expected format.");
      }
      return message.parsed_output as T;
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (error instanceof Anthropic.AuthenticationError) {
        throw new AppError("not_configured", "ANTHROPIC_API_KEY was rejected by the Anthropic API.");
      }
      if (error instanceof Anthropic.RateLimitError) {
        throw new AppError("upstream", "Anthropic rate limit reached. Try again in a minute.");
      }
      if (error instanceof Anthropic.BadRequestError) {
        throw new AppError("upstream", `Anthropic rejected the request: ${error.message}`);
      }
      if (error instanceof Anthropic.APIConnectionTimeoutError) {
        throw new AppError("upstream", "The AI request timed out. Try again or reduce the number of cases.");
      }
      if (error instanceof Anthropic.APIError) {
        throw new AppError("upstream", `Anthropic API error${error.status ? ` (${error.status})` : ""}.`);
      }
      throw error;
    }
  }
}
