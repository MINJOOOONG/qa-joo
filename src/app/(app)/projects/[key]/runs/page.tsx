import Link from "next/link";
import { Plus } from "lucide-react";
import { RunsTable } from "@/components/runs/runs-table";
import { Button } from "@/components/ui/button";
import { loadProject } from "@/lib/loaders";
import { listRunSummaries } from "@/lib/services/runs";

export default async function ProjectRunsPage({ params }: PageProps<"/projects/[key]/runs">) {
  const { key } = await params;
  const { ctx, project } = await loadProject(key);
  const runs = await listRunSummaries(ctx, { projectId: project.id });
  return (
    <div className="space-y-3 p-6">
      <div className="flex justify-end">
        <Button size="sm" asChild>
          <Link href={`/runs/new?project=${project.id}`}>
            <Plus /> Create Test Run
          </Link>
        </Button>
      </div>
      {runs.length ? (
        <RunsTable runs={runs} showProject={false} />
      ) : (
        <p className="rounded-md border border-dashed p-6 text-center text-[13px] text-muted-foreground">No runs for this project yet.</p>
      )}
    </div>
  );
}
