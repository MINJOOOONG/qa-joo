import { AppError } from "@/lib/errors";

/** Reads a JSON request body with a size cap. Returns `{}` for an empty body. */
export async function readJsonBody(request: Request, maxBytes = 1_000_000): Promise<Record<string, unknown>> {
  const text = await request.text();
  if (text.length > maxBytes) throw new AppError("bad_request", "Request body is too large.");
  if (!text.trim()) return {};
  try {
    const value = JSON.parse(text);
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("not an object");
    return value as Record<string, unknown>;
  } catch {
    throw new AppError("bad_request", "Request body must be a JSON object.");
  }
}
