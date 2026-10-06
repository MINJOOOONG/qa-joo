"use client";

import { useActionState } from "react";
import { signIn, type SignInState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, FieldError, Input } from "@/components/ui/input";
import { useFormSubmit } from "@/hooks/use-form-submit";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<SignInState, FormData>(signIn, { error: null });
  const onSubmit = useFormSubmit(action);
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label="Password" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <FieldError message={state.error} />
      <Button type="submit" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
