import { isAppError, zodFieldErrors, errorMessage } from "@/lib/errors";
import { ZodError } from "zod";

export interface FormState {
  error: string | null;
  fieldErrors: Record<string, string>;
  /** Monotonic counter so clients can react to repeated successes (e.g. reset a form). */
  success?: number;
  message?: string | null;
}

export const initialFormState: FormState = { error: null, fieldErrors: {} };

export function formError(error: unknown): FormState {
  if (error instanceof ZodError) {
    return { error: "Please fix the highlighted fields.", fieldErrors: zodFieldErrors(error) };
  }
  if (isAppError(error)) {
    const details = error.details;
    const fieldErrors =
      details && typeof details === "object" && !Array.isArray(details) ? (details as Record<string, string>) : {};
    return { error: error.message, fieldErrors };
  }
  return { error: errorMessage(error), fieldErrors: {} };
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
