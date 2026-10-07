import "server-only";
import { getLocale } from "@/lib/i18n/server";
import { formErrorIn, type FormState } from "./form-state";

/** Form state for a thrown error, with messages in the request's UI language. */
export async function formError(error: unknown): Promise<FormState> {
  return formErrorIn(error, await getLocale());
}
