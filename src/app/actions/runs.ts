"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getServiceContext } from "@/lib/server-context";
import { recordManualResult } from "@/lib/services/results";
import { createTestRun, deleteTestRun, setRunStatus } from "@/lib/services/runs";
import type { TestRun } from "@/lib/domain/types";
import { formError } from "./form-error";
import type { FormState } from "./form-state";

export async function createRunAction(input: unknown): Promise<FormState> {
  let id: string;
  try {
    const ctx = await getServiceContext();
    id = (await createTestRun(ctx, input)).id;
  } catch (error) {
    return formError(error);
  }
  revalidatePath("/", "layout");
  redirect(`/runs/${id}`);
}

export async function recordResultAction(input: unknown): Promise<FormState> {
  try {
    const ctx = await getServiceContext();
    await recordManualResult(ctx, input);
  } catch (error) {
    return formError(error);
  }
  revalidatePath("/", "layout");
  return { error: null, fieldErrors: {}, success: Date.now() };
}

export async function setRunStatusAction(runId: string, status: TestRun["status"]): Promise<FormState> {
  try {
    const ctx = await getServiceContext();
    await setRunStatus(ctx, runId, status);
  } catch (error) {
    return formError(error);
  }
  revalidatePath("/", "layout");
  return { error: null, fieldErrors: {}, success: Date.now() };
}

export async function deleteRunAction(runId: string): Promise<FormState> {
  try {
    const ctx = await getServiceContext();
    await deleteTestRun(ctx, runId);
  } catch (error) {
    return formError(error);
  }
  revalidatePath("/", "layout");
  redirect("/runs");
}
