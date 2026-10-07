import { AppError, errorMessage, notFound } from "@/lib/errors";
import { generateCasesRequestSchema } from "@/lib/domain/schemas";
import type { AnalysisSummary, TestCase } from "@/lib/domain/types";
import type { ProjectAnalysis } from "@/lib/analyzer/types";
import type { Locale } from "@/lib/i18n/config";
import type { GenerationInput, GenerationOutput } from "@/lib/ai/test-case-generator";
import { createTestCase } from "./cases";
import { logActivity } from "./activity";
import type { ServiceContext } from "./context";
import { ensureSectionPath } from "./sections";

/** Side-effecting collaborators, injected so the workflow can be unit-tested without network. */
export interface AnalysisDeps {
  analyzeApplication(url: string): Promise<ProjectAnalysis["app"]>;
  analyzeRepository(url: string): Promise<ProjectAnalysis["repo"]>;
  generate(input: GenerationInput): Promise<GenerationOutput>;
}

export interface AnalyzeResult {
  created: TestCase[];
  summary: AnalysisSummary;
  notes: string | null;
}

export async function runProjectAnalysis(
  ctx: ServiceContext,
  deps: AnalysisDeps,
  raw: unknown,
  mode: "analyze" | "gaps" = "analyze",
  /** UI language at generation time (callers read it from the request); drafts are written in it. */
  locale: Locale = "ko",
): Promise<AnalyzeResult> {
  const input = generateCasesRequestSchema.parse(raw);
  const project = await ctx.repo.getProject(input.projectId);
  if (!project) throw notFound("Project", input.projectId);
  if (!project.appUrl && !project.repoUrl) {
    throw new AppError("validation", "Connect an Application URL or a Repository URL before analyzing.");
  }

  const analysis: ProjectAnalysis = { app: null, repo: null, errors: [] };
  await Promise.all([
    project.appUrl
      ? deps.analyzeApplication(project.appUrl).then(
          (app) => (analysis.app = app),
          (error) => analysis.errors.push({ kind: "application", message: errorMessage(error) }),
        )
      : null,
    project.repoUrl
      ? deps.analyzeRepository(project.repoUrl).then(
          (repo) => (analysis.repo = repo),
          (error) => analysis.errors.push({ kind: "repository", message: errorMessage(error) }),
        )
      : null,
  ]);
  if (!analysis.app && !analysis.repo) {
    throw new AppError(
      "upstream",
      `Analysis failed: ${analysis.errors.map((e) => `${e.kind}: ${e.message}`).join(" ")}`,
    );
  }

  const existing = await ctx.repo.listTestCases({ projectId: project.id, reviewStatuses: ["approved", "draft"] });
  const recentFailures = existing.filter((c) => c.lastResult === "failed").map((c) => `${c.caseKey} ${c.title}`);
  const generation = await deps.generate({
    projectName: project.name,
    projectDescription: project.description,
    analysis,
    existingTitles: existing.map((c) => c.title),
    recentFailures,
    focus: input.focus ?? null,
    maxCases: input.maxCases,
    mode,
    locale,
  });

  const created: TestCase[] = [];
  for (const draft of generation.cases) {
    const sectionId = await ensureSectionPath(ctx, project.id, [draft.area, draft.subarea]);
    created.push(
      await createTestCase(
        ctx,
        {
          projectId: project.id,
          sectionId,
          title: draft.title,
          preconditions: draft.preconditions,
          steps: draft.steps,
          expectedResult: draft.expectedResult,
          type: draft.type,
          priority: draft.priority,
          tags: draft.tags,
        },
        { source: "ai_generated", reviewStatus: "approved", aiRationale: draft.rationale || null, silent: true },
      ),
    );
  }

  const pages = analysis.app?.pages ?? [];
  const summary: AnalysisSummary = {
    analyzedAt: new Date().toISOString(),
    siteSummary: generation.siteSummary,
    provider: generation.provider,
    model: generation.model,
    sources: [
      ...(project.appUrl
        ? [
            {
              kind: "application" as const,
              url: project.appUrl,
              ok: Boolean(analysis.app),
              note: analysis.app
                ? `${pages.length} page(s) analyzed (${analysis.app.mode})`
                : (analysis.errors.find((e) => e.kind === "application")?.message ?? "Failed"),
            },
          ]
        : []),
      ...(project.repoUrl
        ? [
            {
              kind: "repository" as const,
              url: project.repoUrl,
              ok: Boolean(analysis.repo),
              note: analysis.repo
                ? `${analysis.repo.framework ?? "Unknown stack"}, ${analysis.repo.routes.length} route(s), ${analysis.repo.apiEndpoints.length} API endpoint(s)`
                : (analysis.errors.find((e) => e.kind === "repository")?.message ?? "Failed"),
            },
          ]
        : []),
    ],
    signals: {
      pages: pages.length,
      forms: pages.reduce((sum, page) => sum + page.forms.length, 0),
      inputs: pages.reduce((sum, page) => sum + page.looseFields.length + page.forms.reduce((s, f) => s + f.fields.length, 0), 0),
      buttons: pages.reduce((sum, page) => sum + page.buttons.length, 0),
      links: pages.reduce((sum, page) => sum + page.internalLinks.length, 0),
      routes: analysis.repo?.routes.length ?? 0,
      apiEndpoints: analysis.repo?.apiEndpoints.length ?? 0,
    },
    generatedCount: created.length,
    warnings: [...(analysis.app?.warnings ?? []), ...(analysis.repo?.warnings ?? []), ...generation.warnings].slice(0, 10),
  };
  await ctx.repo.updateProject(project.id, { lastAnalysis: summary });
  await logActivity(ctx, {
    projectId: project.id,
    action: mode === "gaps" ? "analysis.gaps" : "analysis.completed",
    entityType: "project",
    entityId: project.id,
    message:
      mode === "gaps"
        ? `AI suggested ${created.length} missing regression case(s) for review`
        : `Analyzed ${project.name}; ${created.length} AI draft test case(s) await review`,
  });
  return { created, summary, notes: generation.notes };
}
