"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { PROJECT_COOKIE } from "@/lib/preferences";
import { getServiceContext } from "@/lib/server-context";
import { createProject, deleteProject, updateProject } from "@/lib/services/projects";
import { formError, type FormState } from "./form-state";

function projectFields(formData: FormData) {
  return {
    name: formData.get("name"),
    key: formData.get("key"),
    description: formData.get("description"),
    appUrl: formData.get("appUrl"),
    repoUrl: formData.get("repoUrl"),
    environment: formData.get("environment") ?? undefined,
  };
}

export async function createProjectAction(_state: FormState, formData: FormData): Promise<FormState> {
  let destination: string;
  try {
    const ctx = await getServiceContext();
    const project = await createProject(ctx, projectFields(formData));
    const store = await cookies();
    store.set(PROJECT_COOKIE, project.id, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", httpOnly: true });
    destination =
      formData.get("analyzeNow") === "on" ? `/projects/${project.key}/review?autostart=1` : `/projects/${project.key}`;
  } catch (error) {
    return formError(error);
  }
  revalidatePath("/", "layout");
  redirect(destination);
}

export async function updateProjectAction(projectId: string, _state: FormState, formData: FormData): Promise<FormState> {
  try {
    const ctx = await getServiceContext();
    const fields = projectFields(formData);
    await updateProject(ctx, projectId, {
      name: fields.name,
      description: fields.description,
      appUrl: fields.appUrl,
      repoUrl: fields.repoUrl,
      environment: fields.environment,
    });
  } catch (error) {
    return formError(error);
  }
  revalidatePath("/", "layout");
  return { error: null, fieldErrors: {}, success: Date.now(), message: "Project saved." };
}

export async function deleteProjectAction(projectId: string, _state: FormState, formData: FormData): Promise<FormState> {
  try {
    const ctx = await getServiceContext();
    await deleteProject(ctx, projectId, String(formData.get("confirmKey") ?? ""));
  } catch (error) {
    return formError(error);
  }
  revalidatePath("/", "layout");
  redirect("/projects");
}
