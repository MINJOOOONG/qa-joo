"use server";

import { revalidatePath } from "next/cache";
import { getServiceContext } from "@/lib/server-context";
import { approveAutomation, cancelAutomationRun, rejectAutomation, saveAutomationCode } from "@/lib/services/automation";
import { fmt } from "@/lib/i18n/define";
import { getI18n } from "@/lib/i18n/server";
import { lintAutomationCode } from "@/lib/automation/code-lint";
import { formError } from "./form-error";
import type { FormState } from "./form-state";

const ok = (message: string): FormState => ({ error: null, fieldErrors: {}, success: Date.now(), message });

export async function saveAutomationCodeAction(id: string, code: string): Promise<FormState> {
  try {
    await saveAutomationCode(await getServiceContext(), id, code);
  } catch (error) {
    return formError(error);
  }
  revalidatePath("/", "layout");
  const { t } = await getI18n();
  const blocking = lintAutomationCode(code).errors.length;
  return ok(blocking ? fmt(t.automation.codeReview.savedBlocked, { count: blocking }) : t.server.automationDraftSaved);
}

export async function approveAutomationAction(id: string, code: string): Promise<FormState> {
  try {
    await approveAutomation(await getServiceContext(), id, code);
  } catch (error) {
    return formError(error);
  }
  revalidatePath("/", "layout");
  return ok((await getI18n()).t.server.automationApproved);
}

export async function rejectAutomationAction(id: string, note: string): Promise<FormState> {
  try {
    await rejectAutomation(await getServiceContext(), id, note || null);
  } catch (error) {
    return formError(error);
  }
  revalidatePath("/", "layout");
  return ok((await getI18n()).t.server.automationRejected);
}

export async function cancelAutomationRunAction(id: string): Promise<FormState> {
  try {
    await cancelAutomationRun(await getServiceContext(), id);
  } catch (error) {
    return formError(error);
  }
  revalidatePath("/", "layout");
  return ok((await getI18n()).t.server.automationRunCancelled);
}

export async function addSuggestedCasesAction(resultId: string, indexes: number[]): Promise<FormState> {
  try {
    const { addSuggestedRegressionCases } = await import("@/lib/services/automation");
    const created = await addSuggestedRegressionCases(await getServiceContext(), resultId, indexes);
    revalidatePath("/", "layout");
    return ok(fmt((await getI18n()).t.server.suggestedCasesAdded, { count: created.length }));
  } catch (error) {
    return formError(error);
  }
}
