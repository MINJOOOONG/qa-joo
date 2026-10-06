import "server-only";
import fs from "node:fs";
import path from "node:path";
import { getConfig } from "@/lib/env";
import { emptyMemoryData, MemoryRepository, type MemoryData } from "./memory";
import type { Repository } from "./repository";
import { SupabaseRepository } from "./supabase";

interface RepositoryCache {
  key: string;
  ready: Promise<Repository>;
}

const globalForRepo = globalThis as unknown as { __qaJooRepository?: RepositoryCache };

/** Where demo/local data is persisted. `memory` disables persistence entirely. */
function resolveDataFile(setting: string | undefined): string | null {
  if (setting === "memory") return null;
  if (setting) return path.resolve(setting);
  if (process.env.VERCEL || process.env.NODE_ENV === "test") return null;
  return path.resolve(".data/qa-joo.json");
}

function loadMemoryData(file: string | null): MemoryData | null {
  if (!file || !fs.existsSync(file)) return null;
  try {
    return { ...emptyMemoryData(), ...JSON.parse(fs.readFileSync(file, "utf8")) };
  } catch (error) {
    console.warn(`[qa-joo] could not read ${file}; starting with an empty workspace`, error);
    return null;
  }
}

function persistTo(file: string | null) {
  if (!file) return undefined;
  return (data: MemoryData) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const temp = `${file}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(data));
    fs.renameSync(temp, file);
  };
}

async function createRepository(): Promise<Repository> {
  const config = getConfig();
  if (config.dataStore === "supabase") {
    return new SupabaseRepository(config.supabase.url!, config.supabase.serviceRoleKey!);
  }
  const file = resolveDataFile(config.dataFile);
  const existing = loadMemoryData(file);
  const repo = new MemoryRepository(existing ?? emptyMemoryData(), persistTo(file));
  if (!existing && config.demoMode) {
    const { seedDemoWorkspace } = await import("./seed");
    await seedDemoWorkspace(repo, { appUrl: config.demoAppUrl, repoUrl: config.demoRepoUrl });
  }
  return repo;
}

/**
 * Returns the process-wide repository. Cached on `globalThis` so dev-server hot reloads
 * keep the same in-memory workspace.
 */
export function getRepository(): Promise<Repository> {
  const config = getConfig();
  const key = `${config.dataStore}:${config.supabase.url ?? ""}:${config.dataFile ?? ""}:${config.demoMode}`;
  const cached = globalForRepo.__qaJooRepository;
  if (cached && cached.key === key) return cached.ready;
  const ready = createRepository();
  globalForRepo.__qaJooRepository = { key, ready };
  ready.catch(() => {
    if (globalForRepo.__qaJooRepository?.ready === ready) globalForRepo.__qaJooRepository = undefined;
  });
  return ready;
}
