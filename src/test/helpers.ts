import { MemoryRepository } from "@/lib/db/memory";
import type { Repository } from "@/lib/db/repository";
import type { ServiceContext } from "@/lib/services/context";
import { createProject } from "@/lib/services/projects";
import { createTestCase } from "@/lib/services/cases";
import type { CaseType } from "@/lib/domain/constants";

export function memoryContext(repo: Repository = new MemoryRepository()): ServiceContext {
  return { repo, actor: "Test QA" };
}

export async function seedProject(ctx: ServiceContext, key = "RF", overrides: Record<string, unknown> = {}) {
  return createProject(ctx, {
    name: `Project ${key}`,
    key,
    appUrl: "https://app.example.com/",
    environment: "staging",
    ...overrides,
  });
}

export async function seedCase(
  ctx: ServiceContext,
  projectId: string,
  overrides: Record<string, unknown> = {},
  options: Parameters<typeof createTestCase>[2] = {},
) {
  return createTestCase(
    ctx,
    {
      projectId,
      title: "Analyze valid campaign URL",
      steps: ["Enter a valid URL.", "Click Analyze."],
      expectedResult: "Requirements are displayed.",
      type: "functional" satisfies CaseType,
      priority: "high",
      ...overrides,
    },
    options,
  );
}
