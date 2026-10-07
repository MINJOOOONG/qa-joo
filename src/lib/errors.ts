import { ZodError } from "zod";
import type { Locale } from "@/lib/i18n/config";
import { localizeFieldErrors, localizeMessage } from "@/lib/i18n/server-messages";

export type AppErrorCode =
  | "bad_request"
  | "validation"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "invalid_state"
  | "upstream"
  | "not_configured";

const STATUS_BY_CODE: Record<AppErrorCode, number> = {
  bad_request: 400,
  validation: 422,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  invalid_state: 409,
  upstream: 502,
  not_configured: 503,
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly details?: unknown;

  constructor(code: AppErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.details = details;
  }

  get status(): number {
    return STATUS_BY_CODE[this.code];
  }
}

export function notFound(entity: string, id?: string): AppError {
  return new AppError("not_found", id ? `${entity} ${id} was not found.` : `${entity} was not found.`);
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export interface FieldErrors {
  [field: string]: string;
}

/** Flattens a ZodError into `{ "steps.0": "message" }` form for forms and API clients. */
export function zodFieldErrors(error: ZodError): FieldErrors {
  const fields: FieldErrors = {};
  for (const issue of error.issues) {
    const path = issue.path.map(String).join(".") || "_";
    if (!fields[path]) fields[path] = issue.message;
  }
  return fields;
}

export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof ZodError) {
    return new AppError("validation", "Request validation failed.", zodFieldErrors(error));
  }
  return new AppError("upstream", "Unexpected server error.");
}

/**
 * Shapes any thrown error into a JSON Response without leaking internals. With a `locale`, the
 * message and field errors are translated (English source text is kept for "en" and by default,
 * which is what machine clients such as runners receive).
 */
export function errorResponse(error: unknown, locale: Locale = "en"): Response {
  const appError = toAppError(error);
  if (!(error instanceof AppError) && !(error instanceof ZodError)) {
    console.error("[qa-joo] unhandled error", error);
  }
  return Response.json(
    {
      error: {
        code: appError.code,
        message: localizeMessage(appError.message, locale),
        details: localizeDetails(appError.details, locale),
      },
    },
    { status: appError.status },
  );
}

export function errorMessage(error: unknown): string {
  if (error instanceof AppError) return error.message;
  if (error instanceof ZodError) return error.issues[0]?.message ?? "Validation failed.";
  console.error("[qa-joo] unexpected error", error);
  return "Unexpected error. Check the server logs for details.";
}

function localizeDetails(details: unknown, locale: Locale): unknown {
  if (details === undefined || details === null) return null;
  if (locale === "en" || typeof details !== "object" || Array.isArray(details)) return details;
  const entries = Object.entries(details as Record<string, unknown>);
  if (!entries.every(([, value]) => typeof value === "string")) return details;
  return localizeFieldErrors(details as Record<string, string>, locale);
}
