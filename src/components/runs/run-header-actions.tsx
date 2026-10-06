"use client";

import { useTransition } from "react";
import { CheckCheck, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteRunAction, setRunStatusAction } from "@/app/actions/runs";

export function RunHeaderActions({ runId, status, untested }: { runId: string; status: "active" | "completed"; untested: number }) {
  const [pending, startTransition] = useTransition();
  const run = (fn: () => Promise<{ error: string | null } | undefined>) =>
    startTransition(async () => {
      const result = await fn();
      if (result?.error) toast.error(result.error);
    });
  return (
    <>
      {status === "active" ? (
        <Button
          variant="outline"
          disabled={pending}
          onClick={() => {
            if (untested > 0 && !confirm(`${untested} case(s) are still untested. Complete the run anyway?`)) return;
            run(() => setRunStatusAction(runId, "completed"));
          }}
        >
          <CheckCheck /> Complete Run
        </Button>
      ) : (
        <Button variant="outline" disabled={pending} onClick={() => run(() => setRunStatusAction(runId, "active"))}>
          <RotateCcw /> Reopen
        </Button>
      )}
      <Button
        variant="ghost"
        size="icon"
        aria-label="Delete run"
        disabled={pending}
        onClick={() => {
          if (!confirm("Delete this run and all of its results?")) return;
          run(() => deleteRunAction(runId));
        }}
      >
        <Trash2 />
      </Button>
    </>
  );
}
