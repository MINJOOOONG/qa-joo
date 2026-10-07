import { CheckCircle2, CircleAlert, CircleMinus } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { getConfig } from "@/lib/env";
import { fmt } from "@/lib/i18n/define";
import { getI18n } from "@/lib/i18n/server";
import { getServiceContext } from "@/lib/server-context";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t.settings.title };
}

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

export default async function SettingsPage() {
  await getServiceContext();
  const config = getConfig();
  const { t } = await getI18n();
  const l = t.settings;
  const yes = (value: unknown) => (value ? l.configured : l.notSet);
  return (
    <>
      <PageHeader title={l.title} description={l.description} />
      <div className="max-w-4xl space-y-6 p-6">
        <Card title={l.workspace.title}>
          <Row
            label={l.workspace.dataStore}
            value={config.dataStore === "supabase" ? l.workspace.supabase : l.workspace.memory}
            state={config.dataStore === "supabase" ? "ok" : "warn"}
            hint={
              config.dataStore === "supabase"
                ? config.supabase.url
                : fmt(l.workspace.dataStoreHint, { file: config.dataFile ?? l.workspace.defaultDataFile })
            }
          />
          <Row label={l.workspace.auth} value={config.authEnabled ? l.workspace.authOn : l.workspace.authOff} state={config.authEnabled ? "ok" : "warn"} />
          <Row label={l.workspace.demo} value={config.demoMode ? l.workspace.demoOn : l.workspace.demoOff} state={config.demoMode ? "warn" : "off"} />
        </Card>

        <Card title={l.ai.title}>
          <Row
            label={l.ai.provider}
            value={config.ai.provider === "heuristic" ? l.ai.heuristic : config.ai.provider}
            state={config.ai.provider === "heuristic" ? "warn" : "ok"}
            hint={l.ai.providerHint}
          />
          <Row label="Anthropic" value={fmt(l.model, { status: yes(config.ai.anthropicKey), model: config.ai.anthropicModel })} state={config.ai.anthropicKey ? "ok" : "off"} />
          <Row label="OpenAI" value={fmt(l.model, { status: yes(config.ai.openaiKey), model: config.ai.openaiModel })} state={config.ai.openaiKey ? "ok" : "off"} />
        </Card>

        <Card title={l.analyzer.title}>
          <Row
            label={l.analyzer.privateTargets}
            value={config.analyzer.allowPrivateTargets ? l.analyzer.allowed : l.analyzer.blocked}
            state={config.analyzer.allowPrivateTargets ? "warn" : "ok"}
            hint={config.analyzer.allowPrivateTargets ? l.analyzer.allowedHint : l.analyzer.blockedHint}
          />
          <Row label={l.analyzer.browser} value={config.analyzer.browserMode ? l.analyzer.browserOn : l.analyzer.browserOff} state={config.analyzer.browserMode ? "ok" : "off"} />
          <Row label={l.analyzer.githubToken} value={yes(config.analyzer.githubToken)} state={config.analyzer.githubToken ? "ok" : "off"} hint={l.analyzer.githubTokenHint} />
        </Card>

        <Card title={l.runner.title}>
          <Row label={l.runner.mode} value={config.runner.mode} state="ok" hint="AUTOMATION_RUNNER=local | github | external" />
          <Row
            label={l.runner.callbackSecret}
            value={yes(config.runner.callbackSecret)}
            state={config.runner.callbackSecret ? "ok" : "warn"}
            hint={l.runner.callbackSecretHint}
          />
          <Row label={l.runner.publicUrl} value={config.publicUrl} state="ok" />
          <Row
            label={l.runner.githubDispatch}
            value={config.runner.github.repository ? `${config.runner.github.repository} · ${config.runner.github.workflow} @ ${config.runner.github.ref}` : l.runner.notConfigured}
            state={config.runner.github.repository && config.runner.github.token ? "ok" : "off"}
            hint={l.runner.githubDispatchHint}
          />
        </Card>
      </div>
    </>
  );
}
