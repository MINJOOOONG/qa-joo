"use client";

import { useTransition } from "react";
import { CheckCheck, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteRunAction, setRunStatusAction } from "@/app/actions/runs";
import { fmt } from "@/lib/i18n/define";
import { useI18n } from "@/lib/i18n/client";

export function RunHeaderActions({ runId, status, untested }: { runId: string; status: "active" | "completed"; untested: number }) {
  const [pending, startTransition] = useTransition();
  const { t } = useI18n();
  const m = t.runs.headerActions;
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
            if (untested > 0 && !confirm(fmt(m.confirmComplete, { count: untested }))) return;
            run(() => setRunStatusAction(runId, "completed"));
          }}
        >
          <CheckCheck /> {m.complete}
        </Button>
      ) : (
        <Button variant="outline" disabled={pending} onClick={() => run(() => setRunStatusAction(runId, "active"))}>
          <RotateCcw /> {m.reopen}
        </Button>
      )}
      <Button
        variant="ghost"
        size="icon"
        aria-label={m.delete}
        disabled={pending}
        onClick={() => {
          if (!confirm(m.confirmDelete)) return;
          run(() => deleteRunAction(runId));
        }}
      >
        <Trash2 />
      </Button>
    </>
  );
}
