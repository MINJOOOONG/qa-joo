import { ExternalLink, FolderGit2 } from "lucide-react";
import { EnvironmentBadge } from "@/components/common/badges";
import { ProjectTabs } from "@/components/projects/project-tabs";
import { loadProject } from "@/lib/loaders";

export default async function ProjectLayout({ children, params }: LayoutProps<"/projects/[key]">) {
  const { key } = await params;
  const { project } = await loadProject(key);
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3 px-6 pb-3 pt-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">{project.key}</span>
            <h1 className="truncate text-lg font-semibold tracking-tight">{project.name}</h1>
            <EnvironmentBadge environment={project.environment} />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {project.appUrl ? (
              <a href={project.appUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-foreground">
                <ExternalLink className="size-3" /> {project.appUrl}
              </a>
            ) : null}
            {project.repoUrl ? (
              <a href={project.repoUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-foreground">
                <FolderGit2 className="size-3" /> {project.repoUrl.replace("https://github.com/", "")}
              </a>
            ) : null}
          </div>
        </div>
      </div>
      <ProjectTabs projectKey={project.key} />
      {children}
    </>
  );
}
