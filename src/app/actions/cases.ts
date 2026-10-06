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
import { formError, type FormState } from "./form-state";

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

function safeReturn(value: FormDataEntryValue | null, fallback: string): string {
  const path = typeof value === "string" ? value : "";
  return path.startsWith("/") && !path.startsWith("//") ? path : fallback;
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
  redirect(formData.get("addAnother") === "1" ? safeReturn(formData.get("returnTo"), "/cases") : `/cases/${id}`);
}

export async function updateCaseAction(caseId: string, _state: FormState, formData: FormData): Promise<FormState> {
  try {
    const ctx = await getServiceContext();
    await updateTestCase(ctx, caseId, caseFields(formData));
  } catch (error) {
    return formError(error);
  }
  revalidatePath("/", "layout");
  redirect(safeReturn(formData.get("returnTo"), `/cases/${caseId}`));
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
  redirect(returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/cases");
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
      return { error: null, fieldErrors: {}, success: Date.now(), message: `Approved ${count} case(s).` };
    }
    for (const id of caseIds) await reviewTestCase(ctx, id, "reject");
  } catch (error) {
    return formError(error);
  }
  revalidatePath("/", "layout");
  return { error: null, fieldErrors: {}, success: Date.now(), message: `Rejected ${caseIds.length} case(s).` };
}

export async function addToRunAction(runId: string, caseIds: string[]): Promise<FormState> {
  try {
    const ctx = await getServiceContext();
    const added = await addCasesToRun(ctx, runId, caseIds);
    revalidatePath("/", "layout");
    return {
      error: null,
      fieldErrors: {},
      success: Date.now(),
      message: added ? `Added to the run.` : "Already part of the run.",
    };
  } catch (error) {
    return formError(error);
  }
}
