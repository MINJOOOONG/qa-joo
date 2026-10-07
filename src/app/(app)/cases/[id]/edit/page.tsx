import { notFound } from "next/navigation";
import { CaseForm } from "@/components/cases/case-form";
import { PageHeader } from "@/components/common/page-header";
import { updateCaseAction } from "@/app/actions/cases";
import { flattenSections } from "@/lib/domain/sections";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { getServiceContext } from "@/lib/server-context";
import { getI18n } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/define";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t.cases.meta.edit };
}

export default async function EditCasePage({ params, searchParams }: PageProps<"/cases/[id]/edit">) {
  const { id } = await params;
  const query = await searchParams;
  const ctx = await getServiceContext();
  const { t } = await getI18n();
  const testCase = await ctx.repo.getTestCase(id);
  if (!testCase) notFound();
  const project = await ctx.repo.getProject(testCase.projectId);
  const sections = flattenSections(await ctx.repo.listSections(testCase.projectId)).map((node) => ({
    id: node.section.id,
    label: `${"— ".repeat(node.depth)}${node.section.name}`,
  }));
  const returnTo = safeRedirectPath(query.returnTo, `/cases/${id}`);
  return (
    <>
      <PageHeader eyebrow={`${project?.key ?? ""} · ${testCase.caseKey}`} title={fmt(t.cases.page.editTitle, { key: testCase.caseKey })} />
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
