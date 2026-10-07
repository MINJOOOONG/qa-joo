"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getServiceContext } from "@/lib/server-context";
import {
  approveAllDrafts,
  createTestCase,
  deleteTestCase,
  duplicateTestCase,
  reviewTestCase,
  updateTestCase,
} from "@/lib/services/cases";
import { addCasesToRun } from "@/lib/services/runs";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { fmt } from "@/lib/i18n/define";
import { getI18n } from "@/lib/i18n/server";
import { formError } from "./form-error";
import type { FormState } from "./form-state";

function caseFields(formData: FormData) {
  const steps = formData
    .getAll("steps")
    .map((value) => String(value).trim())
    .filter(Boolean);
  const tags = String(formData.get("tags") ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
  return {
    sectionId: formData.get("sectionId"),
    title: formData.get("title"),
    description: formData.get("description"),
    preconditions: formData.get("preconditions"),
    steps,
    expectedResult: formData.get("expectedResult"),
    type: formData.get("type"),
    priority: formData.get("priority"),
    automationStatus: formData.get("automationStatus") ?? undefined,
    tags,
  };
}

export async function createCaseAction(_state: FormState, formData: FormData): Promise<FormState> {
  let id: string;
  try {
    const ctx = await getServiceContext();
    const testCase = await createTestCase(ctx, { projectId: formData.get("projectId"), ...caseFields(formData) });
    id = testCase.id;
  } catch (error) {
    return formError(error);
  }
  revalidatePath("/", "layout");
  redirect(formData.get("addAnother") === "1" ? safeRedirectPath(formData.get("returnTo"), "/cases") : `/cases/${id}`);
}

export async function updateCaseAction(caseId: string, _state: FormState, formData: FormData): Promise<FormState> {
  try {
    const ctx = await getServiceContext();
    await updateTestCase(ctx, caseId, caseFields(formData));
  } catch (error) {
    return formError(error);
  }
  revalidatePath("/", "layout");
  redirect(safeRedirectPath(formData.get("returnTo"), `/cases/${caseId}`));
}

export async function duplicateCaseAction(caseId: string): Promise<FormState> {
  let id: string;
  try {
    const ctx = await getServiceContext();
    id = (await duplicateTestCase(ctx, caseId)).id;
  } catch (error) {
    return formError(error);
  }
  revalidatePath("/", "layout");
  redirect(`/cases/${id}`);
}

export async function deleteCaseAction(caseId: string, returnTo: string): Promise<FormState> {
  try {
    const ctx = await getServiceContext();
    await deleteTestCase(ctx, caseId);
  } catch (error) {
    return formError(error);
  }
  revalidatePath("/", "layout");
  redirect(safeRedirectPath(returnTo, "/cases"));
}

export async function reviewCaseAction(caseId: string, decision: "approve" | "reject"): Promise<FormState> {
  try {
    const ctx = await getServiceContext();
    await reviewTestCase(ctx, caseId, decision);
  } catch (error) {
    return formError(error);
  }
  revalidatePath("/", "layout");
  return { error: null, fieldErrors: {}, success: Date.now() };
}

export async function reviewManyAction(projectId: string, caseIds: string[], decision: "approve" | "reject"): Promise<FormState> {
  try {
    const ctx = await getServiceContext();
    if (decision === "approve") {
      const count = await approveAllDrafts(ctx, projectId, caseIds.length ? caseIds : undefined);
      revalidatePath("/", "layout");
      return { error: null, fieldErrors: {}, success: Date.now(), message: fmt((await getI18n()).t.server.approvedCases, { count }) };
    }
    if (caseIds.length === 0) return { error: null, fieldErrors: {}, success: Date.now(), message: (await getI18n()).t.server.nothingToReject };
    // Only this project's remaining drafts: cases reviewed elsewhere in the meantime are skipped.
    const drafts = await ctx.repo.listTestCases({ projectId, reviewStatuses: ["draft"], ids: caseIds });
    for (const draft of drafts) await reviewTestCase(ctx, draft.id, "reject");
    revalidatePath("/", "layout");
    return { error: null, fieldErrors: {}, success: Date.now(), message: fmt((await getI18n()).t.server.rejectedCases, { count: drafts.length }) };
  } catch (error) {
    return formError(error);
  }
}

export async function addToRunAction(runId: string, caseIds: string[]): Promise<FormState> {
  try {
    const ctx = await getServiceContext();
    const added = await addCasesToRun(ctx, runId, caseIds);
    revalidatePath("/", "layout");
    const { t } = await getI18n();
    return {
      error: null,
      fieldErrors: {},
      success: Date.now(),
      message: added ? t.server.addedToRun : t.server.alreadyInRun,
    };
  } catch (error) {
    return formError(error);
  }
}
