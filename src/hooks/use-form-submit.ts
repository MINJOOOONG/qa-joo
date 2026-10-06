"use client";

import { startTransition, type FormEvent } from "react";

/**
 * Submits a form to a `useActionState` action without React 19's automatic form reset, so
 * validation errors never wipe what the user typed. The clicked submit button's name/value
 * (e.g. "addAnother") is preserved like a native submission.
 */
export function useFormSubmit(formAction: (formData: FormData) => void) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    if (submitter?.name) formData.set(submitter.name, submitter.value);
    startTransition(() => formAction(formData));
  };
}
