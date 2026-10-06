"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FieldError, Input } from "@/components/ui/input";
import { deleteProjectAction } from "@/app/actions/projects";
import { initialFormState } from "@/app/actions/form-state";
import { useFormSubmit } from "@/hooks/use-form-submit";

export function DeleteProject({ projectId, projectKey }: { projectId: string; projectKey: string }) {
  const [state, action, pending] = useActionState(deleteProjectAction.bind(null, projectId), initialFormState);
  const onSubmit = useFormSubmit(action);
  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <p className="text-[13px] text-muted-foreground">
        Permanently deletes the project with all sections, test cases, runs, results and automation history. Type{" "}
        <span className="font-mono font-medium text-foreground">{projectKey}</span> to confirm.
      </p>
      <div className="flex items-center gap-2">
        <Input name="confirmKey" placeholder={projectKey} className="max-w-40 font-mono uppercase" aria-label="Confirm project key" />
        <Button type="submit" variant="destructive-outline" disabled={pending}>
          Delete project
        </Button>
      </div>
      <FieldError message={state.error} />
    </form>
  );
}
