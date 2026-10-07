import { isAppError, zodFieldErrors, errorMessage } from "@/lib/errors";
import { ZodError } from "zod";
import type { Locale } from "@/lib/i18n/config";
import { localizeFieldErrors, localizeMessage } from "@/lib/i18n/server-messages";

export interface FormState {
  error: string | null;
  fieldErrors: Record<string, string>;
  /** Monotonic counter so clients can react to repeated successes (e.g. reset a form). */
  success?: number;
  message?: string | null;
}

export const initialFormState: FormState = { error: null, fieldErrors: {} };

/**
 * Shapes a thrown error into form state, translating messages into `locale` (English source text
 * is returned unchanged for "en"). Server actions use the async `formError` from ./form-error,
 * which reads the locale from the request; this file stays importable from client components.
 */
export function formErrorIn(error: unknown, locale: Locale): FormState {
  if (error instanceof ZodError) {
    return {
      error: localizeMessage("Please fix the highlighted fields.", locale),
      fieldErrors: localizeFieldErrors(zodFieldErrors(error), locale),
    };
  }
  if (isAppError(error)) {
    const details = error.details;
    const fieldErrors =
      details && typeof details === "object" && !Array.isArray(details) ? (details as Record<string, string>) : {};
    return { error: localizeMessage(error.message, locale), fieldErrors: localizeFieldErrors(fieldErrors, locale) };
  }
  return { error: localizeMessage(errorMessage(error), locale), fieldErrors: {} };
}

/** Re-throws Next.js control-flow errors (redirect / notFound) so they are not swallowed. */
export function rethrowIfNavigation(error: unknown): void {
  if (
    error &&
    typeof error === "object" &&
    "digest" in error &&
    typeof (error as { digest: unknown }).digest === "string" &&
    /^(NEXT_REDIRECT|NEXT_NOT_FOUND|NEXT_HTTP_ERROR_FALLBACK)/.test((error as { digest: string }).digest)
  ) {
    throw error;
  }
}
