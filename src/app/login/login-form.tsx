"use client";

import { useActionState } from "react";
import { signIn, type SignInState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, FieldError, Input } from "@/components/ui/input";
import { useFormSubmit } from "@/hooks/use-form-submit";
import { useI18n } from "@/lib/i18n/client";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<SignInState, FormData>(signIn, { error: null });
  const onSubmit = useFormSubmit(action);
  const { t } = useI18n();
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label={t.auth.email} htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label={t.auth.password} htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <FieldError message={state.error} />
      <Button type="submit" disabled={pending}>
        {pending ? t.auth.signingIn : t.auth.signIn}
      </Button>
    </form>
  );
}
