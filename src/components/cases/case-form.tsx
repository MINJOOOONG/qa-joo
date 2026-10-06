"use client";

import { useActionState, useState } from "react";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldError, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { initialFormState, type FormState } from "@/app/actions/form-state";
import {
  CASE_TYPES,
  CASE_TYPE_LABELS,
  PRIORITIES,
  PRIORITY_LABELS,
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
  const [state, formAction, pending] = useActionState(action, initialFormState);
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
    <form action={formAction} className="flex max-w-3xl flex-col gap-4" noValidate>
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <Field label="Title" htmlFor="title" required error={errors.title}>
        <Input id="title" name="title" defaultValue={defaults?.title} placeholder="Reject malformed campaign URL" autoFocus aria-invalid={Boolean(errors.title)} />
      </Field>
      <div className="grid grid-cols-4 gap-3">
        <Field label="Section" htmlFor="sectionId" error={errors.sectionId} className="col-span-2">
          <NativeSelect id="sectionId" name="sectionId" defaultValue={defaults?.sectionId ?? ""}>
            <option value="">Unsectioned</option>
            {sections.map((section) => (
              <option key={section.id} value={section.id}>
                {section.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Type" htmlFor="type" required error={errors.type}>
          <NativeSelect id="type" name="type" defaultValue={defaults?.type ?? "functional"}>
            {CASE_TYPES.map((type) => (
              <option key={type} value={type}>
                {CASE_TYPE_LABELS[type]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Priority" htmlFor="priority" required error={errors.priority}>
          <NativeSelect id="priority" name="priority" defaultValue={defaults?.priority ?? "medium"}>
            {PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {PRIORITY_LABELS[priority]}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
      <Field label="Preconditions" htmlFor="preconditions" error={errors.preconditions}>
        <Textarea id="preconditions" name="preconditions" rows={2} defaultValue={defaults?.preconditions} placeholder="User is on the Campaign Analysis page." />
      </Field>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-zinc-700">
          Steps<span className="ml-0.5 text-destructive">*</span>
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
                aria-label={`Step ${index + 1}`}
              />
              <Button type="button" size="icon-sm" variant="ghost" aria-label="Move up" disabled={index === 0} onClick={() => move(index, -1)}>
                <ArrowUp />
              </Button>
              <Button type="button" size="icon-sm" variant="ghost" aria-label="Move down" disabled={index === steps.length - 1} onClick={() => move(index, 1)}>
                <ArrowDown />
              </Button>
              <Button type="button" size="icon-sm" variant="ghost" aria-label="Remove step" disabled={steps.length === 1} onClick={() => setSteps(steps.filter((_, i) => i !== index))}>
                <X />
              </Button>
            </li>
          ))}
        </ol>
        <div>
          <Button type="button" size="sm" variant="ghost" onClick={() => setSteps([...steps, ""])}>
            <Plus /> Add step
          </Button>
        </div>
        <FieldError message={stepError} />
      </div>
      <Field label="Expected Result" htmlFor="expectedResult" required error={errors.expectedResult}>
        <Textarea id="expectedResult" name="expectedResult" rows={2} defaultValue={defaults?.expectedResult} aria-invalid={Boolean(errors.expectedResult)} />
      </Field>
      <Field label="Description" htmlFor="description" error={errors.description}>
        <Textarea id="description" name="description" rows={2} defaultValue={defaults?.description} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Tags" htmlFor="tags" error={errors.tags ?? Object.entries(errors).find(([k]) => k.startsWith("tags"))?.[1]} hint="Comma separated, e.g. ssrf, url">
          <Input id="tags" name="tags" defaultValue={defaults?.tags?.join(", ")} />
        </Field>
        <Field label="Automation" htmlFor="automationStatus" error={errors.automationStatus} hint="Automated is set by approving a Playwright draft.">
          <NativeSelect id="automationStatus" name="automationStatus" defaultValue={defaults?.automationStatus ?? "manual"}>
            <option value="manual">Manual</option>
            <option value="candidate">Candidate for automation</option>
            <option value="automated" disabled={defaults?.automationStatus !== "automated"}>
              Automated
            </option>
          </NativeSelect>
        </Field>
      </div>
      <FieldError message={state.error && Object.keys(errors).length === 0 ? state.error : null} />
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : mode === "create" ? "Create Test Case" : "Save changes"}
        </Button>
        {mode === "create" ? (
          <Button type="submit" name="addAnother" value="1" variant="outline" disabled={pending}>
            Create & back to list
          </Button>
        ) : null}
      </div>
    </form>
  );
}
