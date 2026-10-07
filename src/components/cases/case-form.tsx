"use client";

import { useActionState, useState } from "react";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldError, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { initialFormState, type FormState } from "@/app/actions/form-state";
import { useFormSubmit } from "@/hooks/use-form-submit";
import { fmt } from "@/lib/i18n/define";
import { useI18n } from "@/lib/i18n/client";
import {
  CASE_TYPES,
  PRIORITIES,
  type AutomationStatus,
  type CaseType,
  type Priority,
} from "@/lib/domain/constants";

export interface CaseFormDefaults {
  sectionId: string | null;
  title: string;
  description: string;
  preconditions: string;
  steps: string[];
  expectedResult: string;
  type: CaseType;
  priority: Priority;
  automationStatus: AutomationStatus;
  tags: string[];
}

export function CaseForm({
  action,
  projectId,
  sections,
  defaults,
  returnTo,
  mode,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  projectId: string;
  sections: Array<{ id: string; label: string }>;
  defaults?: Partial<CaseFormDefaults>;
  returnTo: string;
  mode: "create" | "edit";
}) {
  const { t } = useI18n();
  const f = t.cases.form;
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const onSubmit = useFormSubmit(formAction);
  const [steps, setSteps] = useState<string[]>(defaults?.steps?.length ? defaults.steps : [""]);
  const errors = state.fieldErrors;
  const stepError = Object.entries(errors).find(([key]) => key.startsWith("steps"))?.[1];

  const move = (index: number, delta: number) => {
    const next = [...steps];
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item);
    setSteps(next);
  };

  return (
    <form onSubmit={onSubmit} className="flex max-w-3xl flex-col gap-4" noValidate>
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <Field label={f.title} htmlFor="title" required error={errors.title}>
        <Input id="title" name="title" defaultValue={defaults?.title} placeholder={f.titlePlaceholder} autoFocus aria-invalid={Boolean(errors.title)} />
      </Field>
      <div className="grid grid-cols-4 gap-3">
        <Field label={f.section} htmlFor="sectionId" error={errors.sectionId} className="col-span-2">
          <NativeSelect id="sectionId" name="sectionId" defaultValue={defaults?.sectionId ?? ""}>
            <option value="">{f.unsectioned}</option>
            {sections.map((section) => (
              <option key={section.id} value={section.id}>
                {section.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label={f.type} htmlFor="type" required error={errors.type}>
          <NativeSelect id="type" name="type" defaultValue={defaults?.type ?? "functional"}>
            {CASE_TYPES.map((type) => (
              <option key={type} value={type}>
                {t.enums.caseType[type]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label={f.priority} htmlFor="priority" required error={errors.priority}>
          <NativeSelect id="priority" name="priority" defaultValue={defaults?.priority ?? "medium"}>
            {PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {t.enums.priority[priority]}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
      <Field label={f.preconditions} htmlFor="preconditions" error={errors.preconditions}>
        <Textarea id="preconditions" name="preconditions" rows={2} defaultValue={defaults?.preconditions} placeholder={f.preconditionsPlaceholder} />
      </Field>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-zinc-700">
          {f.steps}<span className="ml-0.5 text-destructive">*</span>
        </span>
        <ol className="flex flex-col gap-1.5">
          {steps.map((step, index) => (
            <li key={index} className="flex items-start gap-1.5">
              <span className="mt-1.5 w-5 text-right text-xs tabular-nums text-muted-foreground">{index + 1}.</span>
              <Textarea
                name="steps"
                rows={1}
                value={step}
                onChange={(event) => setSteps(steps.map((value, i) => (i === index ? event.target.value : value)))}
                className="min-h-8 flex-1"
                aria-label={fmt(f.stepLabel, { n: index + 1 })}
              />
              <Button type="button" size="icon-sm" variant="ghost" aria-label={f.moveUp} disabled={index === 0} onClick={() => move(index, -1)}>
                <ArrowUp />
              </Button>
              <Button type="button" size="icon-sm" variant="ghost" aria-label={f.moveDown} disabled={index === steps.length - 1} onClick={() => move(index, 1)}>
                <ArrowDown />
              </Button>
              <Button type="button" size="icon-sm" variant="ghost" aria-label={f.removeStep} disabled={steps.length === 1} onClick={() => setSteps(steps.filter((_, i) => i !== index))}>
                <X />
              </Button>
            </li>
          ))}
        </ol>
        <div>
          <Button type="button" size="sm" variant="ghost" onClick={() => setSteps([...steps, ""])}>
            <Plus /> {f.addStep}
          </Button>
        </div>
        <FieldError message={stepError} />
      </div>
      <Field label={f.expectedResult} htmlFor="expectedResult" required error={errors.expectedResult}>
        <Textarea id="expectedResult" name="expectedResult" rows={2} defaultValue={defaults?.expectedResult} aria-invalid={Boolean(errors.expectedResult)} />
      </Field>
      <Field label={f.description} htmlFor="description" error={errors.description}>
        <Textarea id="description" name="description" rows={2} defaultValue={defaults?.description} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={f.tags} htmlFor="tags" error={errors.tags ?? Object.entries(errors).find(([k]) => k.startsWith("tags"))?.[1]} hint={f.tagsHint}>
          <Input id="tags" name="tags" defaultValue={defaults?.tags?.join(", ")} />
        </Field>
        <Field label={f.automation} htmlFor="automationStatus" error={errors.automationStatus} hint={f.automationHint}>
          <NativeSelect id="automationStatus" name="automationStatus" defaultValue={defaults?.automationStatus ?? "manual"}>
            <option value="manual">{f.manual}</option>
            <option value="candidate">{f.candidate}</option>
            <option value="automated" disabled={defaults?.automationStatus !== "automated"}>
              {f.automated}
            </option>
          </NativeSelect>
        </Field>
      </div>
      <FieldError message={state.error && Object.keys(errors).length === 0 ? state.error : null} />
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? f.saving : mode === "create" ? f.create : f.saveChanges}
        </Button>
        {mode === "create" ? (
          <Button type="submit" name="addAnother" value="1" variant="outline" disabled={pending}>
            {f.createAndBack}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
