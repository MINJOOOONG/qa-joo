import { CheckCircle2, CircleAlert, CircleMinus } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { getConfig } from "@/lib/env";
import { getServiceContext } from "@/lib/server-context";

export const metadata = { title: "Settings" };

type State = "ok" | "warn" | "off";

function Row({ label, value, state, hint }: { label: string; value: React.ReactNode; state: State; hint?: React.ReactNode }) {
  const Icon = state === "ok" ? CheckCircle2 : state === "warn" ? CircleAlert : CircleMinus;
  return (
    <div className="grid grid-cols-[14rem_1fr] gap-4 border-b px-4 py-2.5 text-[13px] last:border-0">
      <div className="text-muted-foreground">{label}</div>
      <div>
        <div className="flex items-center gap-2">
          <Icon className={state === "ok" ? "size-3.5 text-passed" : state === "warn" ? "size-3.5 text-blocked" : "size-3.5 text-zinc-400"} />
          <span>{value}</span>
        </div>
        {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-[13px] font-semibold">{title}</h2>
      <div className="rounded-md border">{children}</div>
    </section>
  );
}

const yes = (value: unknown) => (value ? "Configured" : "Not set");

export default async function SettingsPage() {
  await getServiceContext();
  const config = getConfig();
  return (
    <>
      <PageHeader title="Settings" description="Read-only view of this deployment's configuration. Values come from environment variables; secrets are never displayed." />
      <div className="max-w-4xl space-y-6 p-6">
        <Card title="Workspace">
          <Row
            label="Data store"
            value={config.dataStore === "supabase" ? "Supabase (PostgreSQL)" : "In-memory store"}
            state={config.dataStore === "supabase" ? "ok" : "warn"}
            hint={
              config.dataStore === "supabase"
                ? config.supabase.url
                : `Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to persist in Postgres. Local data file: ${config.dataFile ?? ".data/qa-joo.json (default)"}`
            }
          />
          <Row label="Authentication" value={config.authEnabled ? "Supabase Auth (sign-in required)" : "Disabled (single local user)"} state={config.authEnabled ? "ok" : "warn"} />
          <Row label="Demo mode" value={config.demoMode ? "On (ReviewForge demo seeded)" : "Off"} state={config.demoMode ? "warn" : "off"} />
        </Card>

        <Card title="AI provider">
          <Row
            label="Provider"
            value={config.ai.provider === "heuristic" ? "Rule-based heuristic (no AI)" : config.ai.provider}
            state={config.ai.provider === "heuristic" ? "warn" : "ok"}
            hint="Set AI_PROVIDER=anthropic|openai with ANTHROPIC_API_KEY or OPENAI_API_KEY. Every AI output is saved as a draft or suggestion for human review."
          />
          <Row label="Anthropic" value={`${yes(config.ai.anthropicKey)} · model ${config.ai.anthropicModel}`} state={config.ai.anthropicKey ? "ok" : "off"} />
          <Row label="OpenAI" value={`${yes(config.ai.openaiKey)} · model ${config.ai.openaiModel}`} state={config.ai.openaiKey ? "ok" : "off"} />
        </Card>

        <Card title="Project analyzer">
          <Row
            label="Private network targets"
            value={config.analyzer.allowPrivateTargets ? "Allowed" : "Blocked (SSRF protection)"}
            state={config.analyzer.allowPrivateTargets ? "warn" : "ok"}
            hint={config.analyzer.allowPrivateTargets ? "ALLOW_PRIVATE_NETWORK_TARGETS=true is meant for local development only." : "localhost, private, link-local and metadata addresses are rejected, including after redirects and DNS resolution."}
          />
          <Row label="Browser rendering" value={config.analyzer.browserMode ? "Playwright (ANALYZER_BROWSER=true)" : "HTTP only"} state={config.analyzer.browserMode ? "ok" : "off"} />
          <Row label="GitHub token" value={yes(config.analyzer.githubToken)} state={config.analyzer.githubToken ? "ok" : "off"} hint="Optional; raises GitHub API rate limits. Only public repositories are ever read." />
        </Card>

        <Card title="Automation runner">
          <Row label="Runner mode" value={config.runner.mode} state="ok" hint="AUTOMATION_RUNNER=local | github | external" />
          <Row
            label="Callback secret"
            value={yes(config.runner.callbackSecret)}
            state={config.runner.callbackSecret ? "ok" : "warn"}
            hint="RUNNER_CALLBACK_SECRET signs every runner request (HMAC-SHA256 with timestamp)."
          />
          <Row label="Public URL for runners" value={config.publicUrl} state="ok" />
          <Row
            label="GitHub dispatch"
            value={config.runner.github.repository ? `${config.runner.github.repository} · ${config.runner.github.workflow} @ ${config.runner.github.ref}` : "Not configured"}
            state={config.runner.github.repository && config.runner.github.token ? "ok" : "off"}
            hint="GITHUB_DISPATCH_TOKEN needs actions:write on the repository that contains qa-automation.yml."
          />
        </Card>
      </div>
    </>
  );
}
