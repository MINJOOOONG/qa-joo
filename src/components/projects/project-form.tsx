"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldError, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { initialFormState, type FormState } from "@/app/actions/form-state";
import { useFormSubmit } from "@/hooks/use-form-submit";
import { ENVIRONMENTS, ENVIRONMENT_LABELS, type Environment } from "@/lib/domain/constants";

interface ProjectValues {
  name: string;
  key: string;
  description: string;
  appUrl: string;
  repoUrl: string;
  environment: Environment;
}

function suggestKey(name: string): string {
  const words = name.toUpperCase().replace(/[^A-Z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  const camel = name.replace(/[^A-Za-z0-9]/g, "").match(/[A-Z][a-z0-9]*/g);
  const initials = words.length > 1 ? words.map((w) => w[0]).join("") : camel && camel.length > 1 ? camel.map((w) => w[0]).join("") : words[0].slice(0, 3);
  const key = initials.replace(/^[0-9]+/, "").slice(0, 10);
  return key.length >= 2 ? key : words[0].slice(0, 3);
}

export function ProjectForm({
  mode,
  action,
  defaults,
}: {
  mode: "create" | "edit";
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  defaults?: Partial<ProjectValues>;
}) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const onSubmit = useFormSubmit(formAction);
  const [name, setName] = useState(defaults?.name ?? "");
  const [key, setKey] = useState(defaults?.key ?? "");
  const [keyTouched, setKeyTouched] = useState(mode === "edit");
  const errors = state.fieldErrors;

  useEffect(() => {
    if (state.success && state.message) toast.success(state.message);
  }, [state.success, state.message]);

  return (
    <form onSubmit={onSubmit} className="flex max-w-2xl flex-col gap-4" noValidate>
      <div className="grid grid-cols-[1fr_160px] gap-4">
        <Field label="Project Name" htmlFor="name" required error={errors.name}>
          <Input
            id="name"
            name="name"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              if (!keyTouched) setKey(suggestKey(event.target.value));
            }}
            placeholder="ReviewForge"
            aria-invalid={Boolean(errors.name)}
            autoFocus={mode === "create"}
            required
          />
        </Field>
        <Field label="Project Key" htmlFor="key" required error={errors.key} hint={mode === "create" ? "Prefix for case IDs, e.g. RF-TC-001" : "Keys cannot be changed."}>
          <Input
            id="key"
            name="key"
            value={key}
            onChange={(event) => {
              setKeyTouched(true);
              setKey(event.target.value.toUpperCase());
            }}
            placeholder="RF"
            maxLength={10}
            className="font-mono uppercase"
            readOnly={mode === "edit"}
            aria-invalid={Boolean(errors.key)}
            required
          />
        </Field>
      </div>

      <Field label="Description" htmlFor="description" error={errors.description}>
        <Textarea id="description" name="description" defaultValue={defaults?.description ?? ""} rows={3} placeholder="What the product does and what matters most to test." />
      </Field>

      <div className="rounded-md border bg-subtle p-4">
        <div className="mb-3">
          <div className="text-[13px] font-semibold">Connect project</div>
          <p className="text-xs text-muted-foreground">
            At least one is required. QA JOO analyzes the live application and/or the public GitHub repository to draft test cases; one is enough,
            and both give better coverage.
          </p>
        </div>
        <div className="flex flex-col gap-4">
          <Field label="Application URL" htmlFor="appUrl" error={errors.appUrl} hint="Public URL of the running app (https://…).">
            <Input id="appUrl" name="appUrl" type="url" defaultValue={defaults?.appUrl ?? ""} placeholder="https://app.example.com" aria-invalid={Boolean(errors.appUrl)} />
          </Field>
          <Field label="Repository URL" htmlFor="repoUrl" error={errors.repoUrl} hint="Public GitHub repository. Private repositories are never accessed.">
            <Input id="repoUrl" name="repoUrl" type="url" defaultValue={defaults?.repoUrl ?? ""} placeholder="https://github.com/owner/repo" aria-invalid={Boolean(errors.repoUrl)} />
          </Field>
        </div>
      </div>

      <Field label="Environment" htmlFor="environment" error={errors.environment} className="max-w-60">
        <NativeSelect id="environment" name="environment" defaultValue={defaults?.environment ?? "staging"}>
          {ENVIRONMENTS.map((env) => (
            <option key={env} value={env}>
              {ENVIRONMENT_LABELS[env]}
            </option>
          ))}
        </NativeSelect>
      </Field>

      {mode === "create" ? (
        <label className="flex items-center gap-2 text-[13px]">
          <input type="checkbox" name="analyzeNow" defaultChecked />
          Analyze the project and draft test cases right after creating it
        </label>
      ) : null}

      <FieldError message={state.error && Object.keys(errors).length === 0 ? state.error : null} />
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : mode === "create" ? "Create Project" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
