"use server";

import { revalidatePath } from "next/cache";
import { getServiceContext } from "@/lib/server-context";
import { createSection, deleteSection, renameSection } from "@/lib/services/sections";
import { formError, type FormState } from "./form-state";

export async function createSectionAction(projectId: string, _state: FormState, formData: FormData): Promise<FormState> {
  try {
    const ctx = await getServiceContext();
    await createSection(ctx, { projectId, parentId: formData.get("parentId"), name: formData.get("name") });
  } catch (error) {
    return formError(error);
  }
  revalidatePath("/", "layout");
  return { error: null, fieldErrors: {}, success: Date.now(), message: "Section added." };
}

export async function renameSectionAction(sectionId: string, name: string): Promise<FormState> {
  try {
    const ctx = await getServiceContext();
    await renameSection(ctx, sectionId, name);
  } catch (error) {
    return formError(error);
  }
  revalidatePath("/", "layout");
  return { error: null, fieldErrors: {}, success: Date.now() };
}

export async function deleteSectionAction(sectionId: string): Promise<FormState> {
  try {
    const ctx = await getServiceContext();
    await deleteSection(ctx, sectionId);
  } catch (error) {
    return formError(error);
  }
  revalidatePath("/", "layout");
  return { error: null, fieldErrors: {}, success: Date.now() };
}
