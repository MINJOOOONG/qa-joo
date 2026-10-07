"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FieldError, Input } from "@/components/ui/input";
import { deleteProjectAction } from "@/app/actions/projects";
import { initialFormState } from "@/app/actions/form-state";
import { useFormSubmit } from "@/hooks/use-form-submit";
import { useI18n } from "@/lib/i18n/client";

export function DeleteProject({ projectId, projectKey }: { projectId: string; projectKey: string }) {
  const [state, action, pending] = useActionState(deleteProjectAction.bind(null, projectId), initialFormState);
  const onSubmit = useFormSubmit(action);
  const { t } = useI18n();
  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <p className="text-[13px] text-muted-foreground">
        {t.projects.delete.descriptionBefore}{" "}
        <span className="font-mono font-medium text-foreground">{projectKey}</span>
        {t.projects.delete.descriptionAfter}
      </p>
      <div className="flex items-center gap-2">
        <Input name="confirmKey" placeholder={projectKey} className="max-w-40 font-mono uppercase" aria-label={t.projects.delete.confirmLabel} />
        <Button type="submit" variant="destructive-outline" disabled={pending}>
          {t.projects.delete.button}
        </Button>
      </div>
      <FieldError message={state.error} />
    </form>
  );
}
