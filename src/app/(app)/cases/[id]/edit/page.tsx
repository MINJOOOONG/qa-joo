import { notFound } from "next/navigation";
import { CaseForm } from "@/components/cases/case-form";
import { PageHeader } from "@/components/common/page-header";
import { updateCaseAction } from "@/app/actions/cases";
import { flattenSections } from "@/lib/domain/sections";
import { getServiceContext } from "@/lib/server-context";

export const metadata = { title: "Edit Test Case" };

export default async function EditCasePage({ params, searchParams }: PageProps<"/cases/[id]/edit">) {
  const { id } = await params;
  const query = await searchParams;
  const ctx = await getServiceContext();
  const testCase = await ctx.repo.getTestCase(id);
  if (!testCase) notFound();
  const project = await ctx.repo.getProject(testCase.projectId);
  const sections = flattenSections(await ctx.repo.listSections(testCase.projectId)).map((node) => ({
    id: node.section.id,
    label: `${"— ".repeat(node.depth)}${node.section.name}`,
  }));
  const returnTo = typeof query.returnTo === "string" && query.returnTo.startsWith("/") ? query.returnTo : `/cases/${id}`;
  return (
    <>
      <PageHeader eyebrow={`${project?.key ?? ""} · ${testCase.caseKey}`} title={`Edit ${testCase.caseKey}`} />
      <div className="p-6">
        <CaseForm
          mode="edit"
          action={updateCaseAction.bind(null, testCase.id)}
          projectId={testCase.projectId}
          sections={sections}
          returnTo={returnTo}
          defaults={{
            sectionId: testCase.sectionId,
            title: testCase.title,
            description: testCase.description ?? "",
            preconditions: testCase.preconditions ?? "",
            steps: testCase.steps,
            expectedResult: testCase.expectedResult,
            type: testCase.type,
            priority: testCase.priority,
            automationStatus: testCase.automationStatus,
            tags: testCase.tags,
          }}
        />
      </div>
    </>
  );
}
