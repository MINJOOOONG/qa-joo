import Link from "next/link";
import { PlayCircle, Plus } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { RunsTable } from "@/components/runs/runs-table";
import { Button } from "@/components/ui/button";
import { getPreferences, scopePreferences } from "@/lib/preferences";
import { getServiceContext } from "@/lib/server-context";
import { listRunSummaries } from "@/lib/services/runs";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t.runs.list.title };
}

export default async function RunsPage() {
  const [ctx, storedPreferences, { t }] = await Promise.all([getServiceContext(), getPreferences(), getI18n()]);
  const m = t.runs.list;
  const preferences = await scopePreferences(ctx.repo, storedPreferences);
  const runs = await listRunSummaries(ctx, preferences.projectId ? { projectId: preferences.projectId } : {});
  return (
    <>
      <PageHeader
        title={m.title}
        description={preferences.projectId ? m.descriptionProject : m.descriptionAll}
        actions={
          <Button asChild>
            <Link href={`/runs/new${preferences.projectId ? `?project=${preferences.projectId}` : ""}`}>
              <Plus /> {m.create}
            </Link>
          </Button>
        }
      />
      <div className="p-6">
        {runs.length ? (
          <RunsTable runs={runs} />
        ) : (
          <EmptyState icon={PlayCircle} title={m.emptyTitle} description={m.emptyDescription} />
        )}
      </div>
    </>
  );
}
