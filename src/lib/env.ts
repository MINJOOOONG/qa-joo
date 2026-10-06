import "server-only";

export type AiProviderName = "openai" | "anthropic" | "heuristic";
export type RunnerMode = "local" | "github" | "external";

function read(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function flag(name: string): boolean {
  return ["1", "true", "yes", "on"].includes((process.env[name] ?? "").trim().toLowerCase());
}

/**
 * Central, lazily-evaluated server configuration. Every value comes from the environment;
 * nothing secret is ever hard-coded or sent to the browser.
 */
export function getConfig() {
  const supabaseUrl = read("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseAnonKey = read("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const supabaseServiceRoleKey = read("SUPABASE_SERVICE_ROLE_KEY");
  const supabaseEnabled = Boolean(supabaseUrl && supabaseServiceRoleKey);

  const explicitProvider = read("AI_PROVIDER")?.toLowerCase();
  const anthropicKey = read("ANTHROPIC_API_KEY");
  const openaiKey = read("OPENAI_API_KEY");
  let aiProvider: AiProviderName = "heuristic";
  if (explicitProvider === "anthropic" || explicitProvider === "openai" || explicitProvider === "heuristic") {
    aiProvider = explicitProvider;
  } else if (anthropicKey) {
    aiProvider = "anthropic";
  } else if (openaiKey) {
    aiProvider = "openai";
  }

  const runnerSetting = read("AUTOMATION_RUNNER")?.toLowerCase();
  const runnerMode: RunnerMode =
    runnerSetting === "github" || runnerSetting === "external" || runnerSetting === "local"
      ? runnerSetting
      : process.env.VERCEL
        ? "external"
        : "local";

  return {
    dataStore: supabaseEnabled ? ("supabase" as const) : ("memory" as const),
    supabase: {
      url: supabaseUrl,
      anonKey: supabaseAnonKey,
      serviceRoleKey: supabaseServiceRoleKey,
      artifactBucket: read("SUPABASE_ARTIFACT_BUCKET") ?? "qa-artifacts",
    },
    /** Auth is enforced whenever Supabase is configured, unless explicitly disabled for local use. */
    authEnabled: supabaseEnabled && Boolean(supabaseAnonKey) && !flag("QA_JOO_DISABLE_AUTH"),
    demoMode: flag("QA_JOO_DEMO_MODE"),
    demoAppUrl: read("DEMO_APP_URL") ?? "https://reviewforge-agentforge-seoul.vercel.app",
    demoRepoUrl: read("DEMO_REPO_URL") ?? "https://github.com/MINJOOOONG/reviewforge-agentforge-seoul",
    dataFile: read("QA_JOO_DATA_FILE"),
    publicUrl: read("QA_JOO_PUBLIC_URL") ?? "http://localhost:3000",
    ai: {
      provider: aiProvider,
      anthropicKey,
      anthropicModel: read("ANTHROPIC_MODEL") ?? "claude-sonnet-5-5",
      openaiKey,
      openaiModel: read("OPENAI_MODEL") ?? "gpt-5-mini",
      timeoutMs: Number(read("AI_TIMEOUT_MS") ?? 90_000),
    },
    analyzer: {
      allowPrivateTargets: flag("ALLOW_PRIVATE_NETWORK_TARGETS"),
      browserMode: flag("ANALYZER_BROWSER"),
      githubToken: read("GITHUB_TOKEN"),
    },
    runner: {
      mode: runnerMode,
      callbackSecret: read("RUNNER_CALLBACK_SECRET"),
      github: {
        token: read("GITHUB_DISPATCH_TOKEN"),
        repository: read("GITHUB_DISPATCH_REPOSITORY"),
        workflow: read("GITHUB_DISPATCH_WORKFLOW") ?? "qa-automation.yml",
        ref: read("GITHUB_DISPATCH_REF") ?? "main",
      },
    },
  };
}

export type AppConfig = ReturnType<typeof getConfig>;
