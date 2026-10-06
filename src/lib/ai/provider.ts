import "server-only";
import type { z } from "zod";
import { getConfig } from "@/lib/env";
import { AnthropicProvider } from "./anthropic";
import { OpenAIProvider } from "./openai";

export interface StructuredRequest<T> {
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
  schemaName: string;
  maxTokens?: number;
  effort?: "low" | "medium" | "high";
}

/**
 * The one AI abstraction in QA JOO: "give me JSON matching this schema".
 * Every AI feature also has a deterministic heuristic path used when no provider is configured.
 */
export interface LlmProvider {
  readonly name: "anthropic" | "openai";
  readonly model: string;
  generate<T>(request: StructuredRequest<T>): Promise<T>;
}

export function getLlmProvider(): LlmProvider | null {
  const { ai } = getConfig();
  if (ai.provider === "anthropic" && ai.anthropicKey) {
    return new AnthropicProvider(ai.anthropicKey, ai.anthropicModel, ai.timeoutMs);
  }
  if (ai.provider === "openai" && ai.openaiKey) {
    return new OpenAIProvider(ai.openaiKey, ai.openaiModel, ai.timeoutMs);
  }
  return null;
}

export function describeProvider(provider: LlmProvider | null): { provider: string; model: string | null } {
  return provider ? { provider: provider.name, model: provider.model } : { provider: "heuristic", model: null };
}
