/**
 * Seeds the ReviewForge demo project into the configured Supabase database.
 *
 *   npm run db:seed
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (and optional DEMO_APP_URL /
 * DEMO_REPO_URL) from the environment or .env.local. Safe to re-run: it skips when project RF exists.
 */
import fs from "node:fs";
import { seedDemoWorkspace } from "../src/lib/db/seed";
import { SupabaseRepository } from "../src/lib/db/supabase";

for (const file of [".env.local", ".env"]) {
  if (fs.existsSync(file)) process.loadEnvFile(file);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to seed Supabase.");
  console.error("Without Supabase, QA_JOO_DEMO_MODE=true seeds the in-memory workspace automatically.");
  process.exit(1);
}

async function main(supabaseUrl: string, serviceRoleKey: string) {
  const repo = new SupabaseRepository(supabaseUrl, serviceRoleKey);
  if (await repo.getProjectByKey("RF")) {
    console.log("Project RF already exists; nothing to do.");
    return;
  }
  await seedDemoWorkspace(repo, {
    appUrl: process.env.DEMO_APP_URL ?? "https://reviewforge-agentforge-seoul.vercel.app",
    repoUrl: process.env.DEMO_REPO_URL ?? "https://github.com/MINJOOOONG/reviewforge-agentforge-seoul",
  });
  console.log("Seeded the ReviewForge demo project (RF).");
}

main(url, key).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
