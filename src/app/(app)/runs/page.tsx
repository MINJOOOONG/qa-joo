import Link from "next/link";
import { PlayCircle, Plus } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { RunsTable } from "@/components/runs/runs-table";
import { Button } from "@/components/ui/button";
import { getPreferences } from "@/lib/preferences";
import { getServiceContext } from "@/lib/server-context";
import { listRunSummaries } from "@/lib/services/runs";

export const metadata = { title: "Test Runs" };

export default async function RunsPage() {
  const [ctx, preferences] = await Promise.all([getServiceContext(), getPreferences()]);
  const runs = await listRunSummaries(ctx, preferences.projectId ? { projectId: preferences.projectId } : {});
  return (
    <>
      <PageHeader
        title="Test Runs"
        description={preferences.projectId ? "Runs for the current project." : "Runs across all projects."}
        actions={
          <Button asChild>
            <Link href={`/runs/new${preferences.projectId ? `?project=${preferences.projectId}` : ""}`}>
              <Plus /> Create Test Run
            </Link>
          </Button>
        }
      />
      <div className="p-6">
        {runs.length ? (
          <RunsTable runs={runs} />
        ) : (
          <EmptyState icon={PlayCircle} title="No test runs yet" description="Create a run from approved test cases to start executing." />
        )}
      </div>
    </>
  );
}
