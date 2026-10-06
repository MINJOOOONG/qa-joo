import Link from "next/link";
import { ExternalLink, FolderKanban, FolderGit2, Plus } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { EnvironmentBadge } from "@/components/common/badges";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatPercent } from "@/lib/domain/run-stats";
import { getServiceContext } from "@/lib/server-context";
import { formatRelative } from "@/lib/utils";

export const metadata = { title: "Projects" };

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export default async function ProjectsPage() {
  const ctx = await getServiceContext();
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
        title="Projects"
        description="Each project connects a live application and/or a GitHub repository to a test suite."
        actions={
          <Button asChild>
            <Link href="/projects/new">
              <Plus /> New Project
            </Link>
          </Button>
        }
      />
      <div className="p-6">
        {projects.length === 0 ? (
          <EmptyState
            icon={FolderKanban}
            title="No projects yet"
            description="Create a project, paste your application URL, and let QA JOO draft the first test cases."
            action={
              <Button asChild>
                <Link href="/projects/new">
                  <Plus /> New Project
                </Link>
              </Button>
            }
          />
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Key</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Application</TableHead>
                  <TableHead>Repository</TableHead>
                  <TableHead>Environment</TableHead>
                  <TableHead className="text-right">Cases</TableHead>
                  <TableHead className="text-right">AI Drafts</TableHead>
                  <TableHead className="text-right">Automated</TableHead>
                  <TableHead>Last analyzed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((project) => {
                  const s = stats.get(project.id) ?? { approved: 0, drafts: 0, automated: 0 };
                  return (
                    <TableRow key={project.id}>
                      <TableCell className="font-mono text-xs text-muted-foreground">{project.key}</TableCell>
                      <TableCell>
                        <Link href={`/projects/${project.key}`} className="font-medium hover:underline">
                          {project.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-xs">
                        {project.appUrl ? (
                          <a href={project.appUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
                            {hostOf(project.appUrl)} <ExternalLink className="size-3" />
                          </a>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {project.repoUrl ? (
                          <a href={project.repoUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
                            <FolderGit2 className="size-3" /> {project.repoUrl.replace("https://github.com/", "")}
                          </a>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <EnvironmentBadge environment={project.environment} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{s.approved}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {s.drafts ? (
                          <Link href={`/projects/${project.key}/review`} className="text-violet-700 hover:underline">
                            {s.drafts}
                          </Link>
                        ) : (
                          0
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatPercent(s.approved ? s.automated / s.approved : null)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatRelative(project.lastAnalysis?.analyzedAt)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </>
  );
}
