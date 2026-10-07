"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FieldError, Input } from "@/components/ui/input";
import { deleteProjectAction } from "@/app/actions/projects";
import { initialFormState } from "@/app/actions/form-state";
import { useFormSubmit } from "@/hooks/use-form-submit";
import { fmt } from "@/lib/i18n/define";
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
      <div className="flex flex-wrap items-center gap-2">
        <Input name="confirmKey" placeholder={fmt(t.projects.delete.confirmPlaceholder, { key: projectKey })} className="max-w-56 font-mono uppercase placeholder:font-sans placeholder:normal-case" aria-label={t.projects.delete.confirmLabel} />
        <Button type="submit" variant="destructive-outline" disabled={pending}>
          {t.projects.delete.button}
        </Button>
      </div>
      <FieldError message={state.error} />
    </form>
  );
}
