import "server-only";
import { errorResponse } from "@/lib/errors";
import { DEFAULT_LOCALE, type Locale } from "./config";
import { getLocale } from "./server";

/**
 * The request's UI language for route handlers. Falls back to the default locale when there is no
 * request scope to read cookies from (e.g. a handler invoked directly in tests).
 */
export async function getRequestLocale(): Promise<Locale> {
  try {
    return await getLocale();
  } catch {
    return DEFAULT_LOCALE;
  }
}

/** `errorResponse` with the message translated into the request's UI language (for browser-facing routes). */
export async function localizedErrorResponse(error: unknown): Promise<Response> {
  return errorResponse(error, await getRequestLocale());
}
