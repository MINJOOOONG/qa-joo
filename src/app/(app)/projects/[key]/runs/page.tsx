import Link from "next/link";
import { Plus } from "lucide-react";
import { RunsTable } from "@/components/runs/runs-table";
import { Button } from "@/components/ui/button";
import { loadProject } from "@/lib/loaders";
import { listRunSummaries } from "@/lib/services/runs";
import { getI18n } from "@/lib/i18n/server";

export default async function ProjectRunsPage({ params }: PageProps<"/projects/[key]/runs">) {
  const { key } = await params;
  const { ctx, project } = await loadProject(key);
  const runs = await listRunSummaries(ctx, { projectId: project.id });
  const { t } = await getI18n();
  return (
    <div className="space-y-3 p-6">
      <div className="flex justify-end">
        <Button size="sm" asChild>
          <Link href={`/runs/new?project=${project.id}`}>
            <Plus /> {t.runs.list.create}
          </Link>
        </Button>
      </div>
      {runs.length ? (
        <RunsTable runs={runs} showProject={false} />
      ) : (
        <p className="rounded-md border border-dashed p-6 text-center text-[13px] text-muted-foreground">{t.runs.list.emptyProject}</p>
      )}
    </div>
  );
}
