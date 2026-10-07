import Link from "next/link";
import { ExternalLink, FolderKanban, FolderGit2, Plus } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { EnvironmentBadge } from "@/components/common/badges";
import { Button } from "@/components/ui/button";
import { formatPercent } from "@/lib/domain/run-stats";
import { getServiceContext } from "@/lib/server-context";
import { formatRelative } from "@/lib/i18n/format";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t.projects.list.title };
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

const COVERS = [
  "from-violet-500 to-indigo-600",
  "from-sky-500 to-cyan-600",
  "from-emerald-500 to-teal-600",
  "from-amber-500 to-orange-600",
  "from-rose-500 to-pink-600",
  "from-slate-600 to-slate-800",
];

/** Stable cover colour per project key so a project keeps its look across visits. */
function coverFor(key: string): string {
  let hash = 0;
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return COVERS[hash % COVERS.length];
}

export default async function ProjectsPage() {
  const [ctx, { t, locale }] = await Promise.all([getServiceContext(), getI18n()]);
  const l = t.projects.list;
  const [projects, cases] = await Promise.all([ctx.repo.listProjects(), ctx.repo.listTestCases()]);
  const stats = new Map<string, { approved: number; drafts: number; automated: number }>();
  for (const c of cases) {
    const entry = stats.get(c.projectId) ?? { approved: 0, drafts: 0, automated: 0 };
    if (c.reviewStatus === "approved") entry.approved += 1;
    if (c.reviewStatus === "draft") entry.drafts += 1;
    if (c.reviewStatus === "approved" && c.automationStatus === "automated") entry.automated += 1;
    stats.set(c.projectId, entry);
  }

  return (
    <>
      <PageHeader
        title={l.title}
        description={l.description}
        actions={
          <Button asChild>
            <Link href="/projects/new">
              <Plus /> {l.newProject}
            </Link>
          </Button>
        }
      />
      <div className="p-6">
        {projects.length === 0 ? (
          <EmptyState
            icon={FolderKanban}
            title={l.emptyTitle}
            description={l.emptyDescription}
            action={
              <Button asChild>
                <Link href="/projects/new">
                  <Plus /> {l.newProject}
                </Link>
              </Button>
            }
          />
        ) : (
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4" data-testid="project-album">
            {projects.map((project) => {
              const s = stats.get(project.id) ?? { approved: 0, drafts: 0, automated: 0 };
              return (
                <li
                  key={project.id}
                  className="group relative flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-within:ring-2 focus-within:ring-ring"
                  data-testid="project-card"
                >
                  <div className={`relative flex aspect-[16/9] items-center justify-center bg-gradient-to-br ${coverFor(project.key)}`}>
                    <span className="font-mono text-4xl font-bold tracking-tight text-white/90 drop-shadow-sm">{project.key}</span>
                    <div className="absolute left-3 top-3">
                      <EnvironmentBadge environment={project.environment} />
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col gap-3 p-4">
                    <div>
                      <Link
                        href={`/projects/${project.key}`}
                        className="font-semibold leading-tight after:absolute after:inset-0 after:content-[''] hover:underline"
                      >
                        {project.name}
                      </Link>
                      {project.description ? (
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{project.description}</p>
                      ) : null}
                    </div>
                    <div className="space-y-1 text-xs">
                      {project.appUrl ? (
                        <a href={project.appUrl} target="_blank" rel="noreferrer" className="relative z-10 flex items-center gap-1 truncate text-muted-foreground hover:text-foreground">
                          <ExternalLink className="size-3 shrink-0" /> <span className="truncate">{hostOf(project.appUrl)}</span>
                        </a>
                      ) : null}
                      {project.repoUrl ? (
                        <a href={project.repoUrl} target="_blank" rel="noreferrer" className="relative z-10 flex items-center gap-1 truncate text-muted-foreground hover:text-foreground">
                          <FolderGit2 className="size-3 shrink-0" /> <span className="truncate">{project.repoUrl.replace("https://github.com/", "")}</span>
                        </a>
                      ) : null}
                    </div>
                    <dl className="mt-auto grid grid-cols-3 gap-2 border-t pt-3 text-center">
                      <div>
                        <dt className="text-[11px] text-muted-foreground">{l.cases}</dt>
                        <dd className="font-semibold tabular-nums">{s.approved}</dd>
                      </div>
                      <div>
                        <dt className="text-[11px] text-muted-foreground">{l.automated}</dt>
                        <dd className="font-semibold tabular-nums">{formatPercent(s.approved ? s.automated / s.approved : null)}</dd>
                      </div>
                      <div>
                        <dt className="text-[11px] text-muted-foreground">{l.analyzed}</dt>
                        <dd className="truncate text-xs font-medium">{formatRelative(project.lastAnalysis?.analyzedAt, locale)}</dd>
                      </div>
                    </dl>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
