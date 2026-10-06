import { notFound } from "next/navigation";
import { CaseDetailView } from "@/components/cases/case-detail-view";
import { isAppError } from "@/lib/errors";
import { getServiceContext } from "@/lib/server-context";
import { getCaseDetail } from "@/lib/services/cases";

export default async function CaseDetailPage({ params }: PageProps<"/cases/[id]">) {
  const { id } = await params;
  const ctx = await getServiceContext();
  const detail = await getCaseDetail(ctx, id).catch((error) => {
    if (isAppError(error) && error.code === "not_found") notFound();
    throw error;
  });
  const activeRuns = (await ctx.repo.listTestRuns({ projectId: detail.project.id, status: "active" })).map((run) => ({
    id: run.id,
    name: run.name,
  }));
  return (
    <div className="max-w-4xl p-6">
      <CaseDetailView detail={detail} activeRuns={activeRuns} returnTo={`/projects/${detail.project.key}/cases`} />
    </div>
  );
}
