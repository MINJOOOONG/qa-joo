"use server";

import { revalidatePath } from "next/cache";
import { getServiceContext } from "@/lib/server-context";
import { approveAutomation, cancelAutomationRun, rejectAutomation, saveAutomationCode } from "@/lib/services/automation";
import { formError, type FormState } from "./form-state";

const ok = (message: string): FormState => ({ error: null, fieldErrors: {}, success: Date.now(), message });

export async function saveAutomationCodeAction(id: string, code: string): Promise<FormState> {
  try {
    await saveAutomationCode(await getServiceContext(), id, code);
  } catch (error) {
    return formError(error);
  }
  revalidatePath("/", "layout");
  return ok("Draft saved. Approve it to make the case Automated.");
}

export async function approveAutomationAction(id: string, code: string): Promise<FormState> {
  try {
    await approveAutomation(await getServiceContext(), id, code);
  } catch (error) {
    return formError(error);
  }
  revalidatePath("/", "layout");
  return ok("Approved. The case is now Automated.");
}

export async function rejectAutomationAction(id: string, note: string): Promise<FormState> {
  try {
    await rejectAutomation(await getServiceContext(), id, note || null);
  } catch (error) {
    return formError(error);
  }
  revalidatePath("/", "layout");
  return ok("Draft rejected.");
}

export async function cancelAutomationRunAction(id: string): Promise<FormState> {
  try {
    await cancelAutomationRun(await getServiceContext(), id);
  } catch (error) {
    return formError(error);
  }
  revalidatePath("/", "layout");
  return ok("Run cancelled.");
}

export async function addSuggestedCasesAction(resultId: string, indexes: number[]): Promise<FormState> {
  try {
    const { addSuggestedRegressionCases } = await import("@/lib/services/automation");
    const created = await addSuggestedRegressionCases(await getServiceContext(), resultId, indexes);
    revalidatePath("/", "layout");
    return ok(`Added ${created.length} AI draft case(s) for review.`);
  } catch (error) {
    return formError(error);
  }
}
