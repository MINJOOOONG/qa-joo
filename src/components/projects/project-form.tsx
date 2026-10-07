"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldError, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { initialFormState, type FormState } from "@/app/actions/form-state";
import { useFormSubmit } from "@/hooks/use-form-submit";
import { ENVIRONMENTS, type Environment } from "@/lib/domain/constants";
import { useI18n } from "@/lib/i18n/client";

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
  const { t } = useI18n();
  const f = t.projects.form;

  useEffect(() => {
    if (state.success && state.message) toast.success(state.message);
  }, [state.success, state.message]);

  return (
    <form onSubmit={onSubmit} className="flex max-w-2xl flex-col gap-4" noValidate>
      <div className="grid grid-cols-[1fr_160px] gap-4">
        <Field label={f.name} htmlFor="name" required error={errors.name}>
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
        <Field label={f.key} htmlFor="key" required error={errors.key} hint={mode === "create" ? f.keyHintCreate : f.keyHintEdit}>
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

      <Field label={f.description} htmlFor="description" error={errors.description}>
        <Textarea id="description" name="description" defaultValue={defaults?.description ?? ""} rows={3} placeholder={f.descriptionPlaceholder} />
      </Field>

      <div className="rounded-md border bg-subtle p-4">
        <div className="mb-3">
          <div className="text-[13px] font-semibold">{f.connectTitle}</div>
          <p className="text-xs text-muted-foreground">{f.connectHint}</p>
        </div>
        <div className="flex flex-col gap-4">
          <Field label={f.appUrl} htmlFor="appUrl" error={errors.appUrl} hint={f.appUrlHint}>
            <Input id="appUrl" name="appUrl" type="url" defaultValue={defaults?.appUrl ?? ""} placeholder="https://app.example.com" aria-invalid={Boolean(errors.appUrl)} />
          </Field>
          <Field label={f.repoUrl} htmlFor="repoUrl" error={errors.repoUrl} hint={f.repoUrlHint}>
            <Input id="repoUrl" name="repoUrl" type="url" defaultValue={defaults?.repoUrl ?? ""} placeholder="https://github.com/owner/repo" aria-invalid={Boolean(errors.repoUrl)} />
          </Field>
        </div>
      </div>

      <Field label={f.environment} htmlFor="environment" error={errors.environment} className="max-w-60">
        <NativeSelect id="environment" name="environment" defaultValue={defaults?.environment ?? "staging"}>
          {ENVIRONMENTS.map((env) => (
            <option key={env} value={env}>
              {t.enums.environment[env]}
            </option>
          ))}
        </NativeSelect>
      </Field>

      {mode === "create" ? (
        <label className="flex items-center gap-2 text-[13px]">
          <input type="checkbox" name="analyzeNow" defaultChecked />
          {f.analyzeNow}
        </label>
      ) : null}

      <FieldError message={state.error && Object.keys(errors).length === 0 ? state.error : null} />
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? f.saving : mode === "create" ? f.create : f.saveChanges}
        </Button>
      </div>
    </form>
  );
}
