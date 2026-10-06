"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LoaderCircle, ScanSearch, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";

const PHASES = ["Fetching the application…", "Reading the repository…", "Drafting test cases…", "Saving AI drafts…"];

export function AnalyzePanel({
  projectId,
  autostart,
  initialMode,
  providerLabel,
  sources,
}: {
  projectId: string;
  autostart: boolean;
  initialMode: "analyze" | "gaps";
  providerLabel: string;
  sources: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [mode, setMode] = useState<"analyze" | "gaps">(initialMode);
  const [focus, setFocus] = useState("");
  const [maxCases, setMaxCases] = useState("12");
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  const run = async (runMode = mode) => {
    setRunning(true);
    setError(null);
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
        setError(body?.error?.message ?? "Analysis failed.");
        return;
      }
      toast.success(
        body.created
          ? `${body.created} AI draft case(s) ready for review.`
          : "Analysis finished. No new cases were needed.",
      );
      router.replace(pathname, { scroll: false });
      router.refresh();
    } catch {
      setError("Network error while analyzing the project.");
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
          <span className="text-xs font-medium text-zinc-700">Mode</span>
          <NativeSelect value={mode} onChange={(event) => setMode(event.target.value as "analyze" | "gaps")} className="w-80" disabled={running} aria-label="Generation mode">
            <option value="analyze">Analyze project → draft test cases</option>
            <option value="gaps">Suggest missing regression cases</option>
          </NativeSelect>
        </div>
        <div className="flex min-w-64 flex-1 flex-col gap-1">
          <span className="text-xs font-medium text-zinc-700">Focus (optional)</span>
          <Input value={focus} onChange={(event) => setFocus(event.target.value)} placeholder="e.g. URL validation and upload limits" disabled={running} maxLength={500} aria-label="Focus" />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-700">Max cases</span>
          <NativeSelect value={maxCases} onChange={(event) => setMaxCases(event.target.value)} className="w-24" disabled={running} aria-label="Max cases">
            {[6, 12, 20, 30].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </NativeSelect>
        </div>
        <Button onClick={() => run()} disabled={running} data-testid="analyze-button">
          {running ? <LoaderCircle className="animate-spin" /> : mode === "gaps" ? <Sparkles /> : <ScanSearch />}
          {running ? "Analyzing…" : mode === "gaps" ? "Suggest Cases" : "Analyze Project"}
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Sources: {sources.join(" · ") || "none connected"} · Generator: {providerLabel}. Results are saved as{" "}
        <span className="font-medium text-violet-700">AI drafts</span> and are not used in runs until you approve them.
      </p>
      {running ? (
        <p className="mt-2 flex items-center gap-2 text-[13px] text-zinc-700" role="status">
          <LoaderCircle className="size-3.5 animate-spin" /> {PHASES[phase]}
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
