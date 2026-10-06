import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { getRepository } from "@/lib/db";
import { SupabaseRepository } from "@/lib/db/supabase";
import { getConfig } from "@/lib/env";
import { AppError } from "@/lib/errors";

export const ARTIFACT_TYPES: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "application/zip": ".zip",
  "text/plain": ".txt",
  "application/json": ".json",
  "text/html": ".html",
};
export const MAX_ARTIFACT_BYTES = 25 * 1024 * 1024;

/** `<runId>/<file>` with a strict character set, so stored paths can never escape the root. */
export function artifactKey(runId: string, fileName: string, contentType: string): string {
  if (!/^[A-Za-z0-9-]{8,64}$/.test(runId)) throw new AppError("validation", "Invalid automation run id.");
  const extension = ARTIFACT_TYPES[contentType];
  if (!extension) throw new AppError("validation", `Unsupported artifact type ${contentType}.`);
  const base = fileName.replace(/\.[A-Za-z0-9]+$/, "").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^[.-]+/, "").slice(0, 80) || "artifact";
  return `${runId}/${base}-${Date.now().toString(36)}${extension}`;
}

export function isSafeArtifactKey(key: string): boolean {
  return /^[A-Za-z0-9-]{8,64}\/[A-Za-z0-9][A-Za-z0-9._-]{0,120}$/.test(key) && !key.includes("..");
}

function localRoot(): string {
  return process.env.QA_JOO_ARTIFACT_DIR
    ? path.resolve(process.env.QA_JOO_ARTIFACT_DIR)
    : process.env.VERCEL
      ? "/tmp/qa-joo-artifacts"
      : path.resolve(".data/artifacts");
}

/** Stores an artifact and returns the QA JOO URL that serves it (`/api/artifacts/<key>`). */
export async function saveArtifact(runId: string, fileName: string, contentType: string, bytes: Uint8Array): Promise<string> {
  if (bytes.byteLength > MAX_ARTIFACT_BYTES) throw new AppError("validation", "Artifact is larger than 25 MB.");
  const key = artifactKey(runId, fileName, contentType);
  const config = getConfig();
  if (config.dataStore === "supabase") {
    const repo = await getRepository();
    if (!(repo instanceof SupabaseRepository)) throw new AppError("not_configured", "Supabase storage unavailable.");
    const { error } = await repo.client.storage.from(config.supabase.artifactBucket).upload(key, bytes, { contentType, upsert: false });
    if (error) throw new AppError("upstream", `Could not store artifact: ${error.message}`);
  } else {
    const target = path.join(localRoot(), key);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, bytes);
  }
  return `/api/artifacts/${key}`;
}

export type ArtifactSource = { kind: "file"; bytes: Uint8Array; contentType: string } | { kind: "redirect"; url: string };

export async function loadArtifact(key: string): Promise<ArtifactSource> {
  if (!isSafeArtifactKey(key)) throw new AppError("not_found", "Artifact not found.");
  const contentType =
    Object.entries(ARTIFACT_TYPES).find(([, extension]) => key.endsWith(extension))?.[0] ?? "application/octet-stream";
  const config = getConfig();
  if (config.dataStore === "supabase") {
    const repo = await getRepository();
    if (!(repo instanceof SupabaseRepository)) throw new AppError("not_configured", "Supabase storage unavailable.");
    const { data, error } = await repo.client.storage.from(config.supabase.artifactBucket).createSignedUrl(key, 300);
    if (error || !data) throw new AppError("not_found", "Artifact not found.");
    return { kind: "redirect", url: data.signedUrl };
  }
  try {
    return { kind: "file", bytes: await fs.readFile(path.join(localRoot(), key)), contentType };
  } catch {
    throw new AppError("not_found", "Artifact not found.");
  }
}
