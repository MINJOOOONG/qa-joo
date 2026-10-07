"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LoaderCircle, ScanSearch, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { fmt } from "@/lib/i18n/define";
import { useI18n } from "@/lib/i18n/client";

const PHASES = ["fetching", "reading", "drafting", "saving"] as const;

export function AnalyzePanel({
  casesHref,
  projectId,
  autostart,
  initialMode,
  providerLabel,
  sources,
}: {
  projectId: string;
  /** Where to go after generation (the project's test case list). */
  casesHref: string;
  autostart: boolean;
  initialMode: "analyze" | "gaps";
  providerLabel: string;
  sources: string[];
}) {
  const router = useRouter();
  const { t } = useI18n();
  const a = t.review.analyze;
  const [mode, setMode] = useState<"analyze" | "gaps">(initialMode);
  const [focus, setFocus] = useState("");
  const [maxCases, setMaxCases] = useState("12");
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const started = useRef(false);

  const run = async (runMode = mode) => {
    setRunning(true);
    setError(null);
    setNotice(null);
    setPhase(0);
    const timer = setInterval(() => setPhase((value) => Math.min(value + 1, PHASES.length - 1)), 2500);
    try {
      const response = await fetch(`/api/projects/${projectId}/analyze`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: runMode, focus: focus || undefined, maxCases: Number(maxCases) }),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body?.error?.message ?? a.failed);
        return;
      }
      if (!body.created) {
        // Nothing new: stay here and say why instead of silently redirecting.
        const message = fmt(a.noneNeeded, { count: Number(body.existing ?? 0) });
        setNotice(message);
        toast.info(message);
        return;
      }
      toast.success(fmt(a.created, { count: body.created }));
      // Generated cases are ready to use right away; show them in the test case list.
      router.push(casesHref);
    } catch {
      setError(a.networkError);
    } finally {
      clearInterval(timer);
      setRunning(false);
    }
  };

  useEffect(() => {
    if (autostart && !started.current) {
      started.current = true;
      void run("analyze");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount when requested
  }, [autostart]);

  return (
    <div className="rounded-md border bg-subtle p-4" data-testid="analyze-panel">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-700">{a.mode}</span>
          <NativeSelect value={mode} onChange={(event) => setMode(event.target.value as "analyze" | "gaps")} className="w-80" disabled={running} aria-label={a.modeLabel}>
            <option value="analyze">{a.modeAnalyze}</option>
            <option value="gaps">{a.modeGaps}</option>
          </NativeSelect>
        </div>
        <div className="flex min-w-64 flex-1 flex-col gap-1">
          <span className="text-xs font-medium text-zinc-700">{a.focus}</span>
          <Input value={focus} onChange={(event) => setFocus(event.target.value)} placeholder={a.focusPlaceholder} disabled={running} maxLength={500} aria-label={a.focusLabel} />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-700">{a.maxCases}</span>
          <NativeSelect value={maxCases} onChange={(event) => setMaxCases(event.target.value)} className="w-24" disabled={running} aria-label={a.maxCases}>
            {[6, 12, 20, 30].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </NativeSelect>
        </div>
        <Button onClick={() => run()} disabled={running} data-testid="analyze-button">
          {running ? <LoaderCircle className="animate-spin" /> : mode === "gaps" ? <Sparkles /> : <ScanSearch />}
          {running ? a.analyzing : mode === "gaps" ? a.suggest : a.analyzeProject}
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {fmt(a.sourcesPrefix, { sources: sources.join(" · ") || a.noneConnected, provider: providerLabel })}
        <span className="font-medium text-violet-700">{a.aiDrafts}</span>
        {a.sourcesSuffix}
      </p>
      {running ? (
        <p className="mt-2 flex items-center gap-2 text-[13px] text-zinc-700" role="status">
          <LoaderCircle className="size-3.5 animate-spin" /> {a.phases[PHASES[phase]]}
        </p>
      ) : null}
      {notice ? (
        <p className="mt-2 text-[13px] text-zinc-700" role="status" data-testid="analyze-notice">
          {notice}{" "}
          <Link href={casesHref} className="font-medium text-primary underline-offset-2 hover:underline">
            {a.goToCases}
          </Link>
        </p>
      ) : null}
      {error ? (
        <p className="mt-2 text-[13px] text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
