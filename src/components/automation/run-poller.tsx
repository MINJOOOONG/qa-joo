"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Refreshes the server-rendered run page while the runner is working. */
export function RunPoller({ runId, status, resultCount }: { runId: string; status: string; resultCount: number }) {
  const router = useRouter();
  useEffect(() => {
    if (status !== "queued" && status !== "running") return;
    const timer = setInterval(async () => {
      try {
        const response = await fetch(`/api/automation/runs/${runId}`, { cache: "no-store" });
        if (!response.ok) return;
        const body = (await response.json()) as { run: { status: string }; results: Array<{ result: unknown }> };
        const count = body.results.filter((row) => row.result).length;
        if (body.run.status !== status || count !== resultCount) router.refresh();
      } catch {
        // transient network errors: keep polling
      }
    }, 2500);
    return () => clearInterval(timer);
  }, [runId, status, resultCount, router]);
  return null;
}
