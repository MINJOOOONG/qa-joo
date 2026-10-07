import type { NextRequest } from "next/server";
import { localizedErrorResponse } from "@/lib/i18n/error-response";
import { getServiceContext } from "@/lib/server-context";

export async function GET(request: NextRequest) {
  try {
    const ctx = await getServiceContext();
    const term = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 100);
    if (term.length < 2) return Response.json({ hits: [] });
    const lower = term.toLowerCase();
    const [projects, cases, runs] = await Promise.all([
      ctx.repo.listProjects(),
      ctx.repo.listTestCases({ search: term, reviewStatuses: ["approved", "draft"] }),
      ctx.repo.listTestRuns(),
    ]);
    const projectById = new Map(projects.map((p) => [p.id, p]));
    const hits = [
      ...projects
        .filter((p) => `${p.key} ${p.name}`.toLowerCase().includes(lower))
        .slice(0, 5)
        .map((p) => ({ kind: "project", id: p.id, title: p.name, subtitle: p.key, href: `/projects/${p.key}` })),
      ...cases.slice(0, 8).map((c) => ({
        kind: "case",
        id: c.id,
        title: `${c.caseKey} ${c.title}`,
        subtitle: projectById.get(c.projectId)?.key ?? "",
        href: `/cases/${c.id}`,
      })),
      ...runs
        .filter((r) => r.name.toLowerCase().includes(lower))
        .slice(0, 5)
        .map((r) => ({
          kind: "run",
          id: r.id,
          title: r.name,
          subtitle: projectById.get(r.projectId)?.key ?? "",
          href: `/runs/${r.id}`,
        })),
    ];
    return Response.json({ hits });
  } catch (error) {
    return localizedErrorResponse(error);
  }
}
