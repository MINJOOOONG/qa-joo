"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, CircleX, RefreshCcw, Save, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { approveAutomationAction, rejectAutomationAction, saveAutomationCodeAction } from "@/app/actions/automation";
import { lintAutomationCode } from "@/lib/automation/code-lint";

export function CodeReview({
  automationTestId,
  testCaseId,
  initialCode,
  status,
  filePath,
}: {
  automationTestId: string;
  testCaseId: string;
  initialCode: string;
  status: "draft" | "approved" | "rejected";
  filePath: string;
}) {
  const router = useRouter();
  const [code, setCode] = useState(initialCode);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const [regenerating, setRegenerating] = useState(false);
  const gutter = useRef<HTMLDivElement>(null);
  const lint = useMemo(() => lintAutomationCode(code), [code]);
  const dirty = code !== initialCode;
  const lines = code.split("\n").length;

  const act = (fn: () => Promise<{ error: string | null; message?: string | null }>) =>
    startTransition(async () => {
      const result = await fn();
      if (result.error) toast.error(result.error);
      else toast.success(result.message ?? "Saved.");
    });

  const regenerate = async () => {
    if (dirty && !confirm("Discard your edits and generate a new draft?")) return;
    setRegenerating(true);
    try {
      const response = await fetch("/api/automation/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ testCaseId }),
      });
      const body = await response.json();
      if (!response.ok) toast.error(body?.error?.message ?? "Could not regenerate.");
      else {
        setCode(body.automationTest.code);
        toast.success("New draft generated.");
        router.refresh();
      }
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-md border">
        <div className="flex items-center justify-between border-b bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300">
          <span className="font-mono">{filePath}</span>
          <span>{dirty ? "Edited · not saved" : status === "approved" ? "Approved" : "Draft"}</span>
        </div>
        <div className="flex max-h-[34rem] overflow-hidden bg-zinc-950">
          <div ref={gutter} className="code-block select-none overflow-hidden py-3 pl-3 pr-2 text-right text-zinc-600" aria-hidden>
            {Array.from({ length: lines }, (_, index) => (
              <div key={index}>{index + 1}</div>
            ))}
          </div>
          <textarea
            value={code}
            onChange={(event) => setCode(event.target.value)}
            onScroll={(event) => {
              if (gutter.current) gutter.current.scrollTop = event.currentTarget.scrollTop;
            }}
            spellCheck={false}
            aria-label="Playwright spec code"
            data-testid="automation-code"
            className="code-block min-h-[24rem] flex-1 resize-none overflow-auto whitespace-pre bg-transparent py-3 pr-3 text-zinc-100 outline-none"
            rows={Math.min(Math.max(lines + 1, 18), 40)}
          />
        </div>
      </div>

      <div className="space-y-1.5 rounded-md border p-3 text-[13px]" data-testid="lint-report">
        {lint.errors.length === 0 && lint.warnings.length === 0 ? (
          <p className="flex items-center gap-2 text-passed">
            <Check className="size-4" /> Static checks passed.
          </p>
        ) : null}
        {lint.errors.map((message) => (
          <p key={message} className="flex items-start gap-2 text-failed">
            <CircleX className="mt-0.5 size-3.5 shrink-0" /> {message}
          </p>
        ))}
        {lint.warnings.map((message) => (
          <p key={message} className="flex items-start gap-2 text-amber-700">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> {message}
          </p>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="passed"
          disabled={pending || lint.errors.length > 0 || (status === "approved" && !dirty)}
          onClick={() => act(() => approveAutomationAction(automationTestId, code))}
          data-testid="approve-automation"
        >
          <Check /> {status === "approved" && !dirty ? "Approved" : "Approve"}
        </Button>
        <Button variant="outline" disabled={pending || !dirty} onClick={() => act(() => saveAutomationCodeAction(automationTestId, code))}>
          <Save /> Save edits as draft
        </Button>
        <Button variant="outline" disabled={pending || regenerating || status === "approved"} onClick={regenerate}>
          <RefreshCcw className={regenerating ? "animate-spin" : undefined} /> Regenerate
        </Button>
        <div className="ml-auto flex items-center gap-2">
          <Input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Reason (optional)" className="w-56" aria-label="Rejection reason" />
          <Button variant="destructive-outline" disabled={pending || status === "rejected"} onClick={() => act(() => rejectAutomationAction(automationTestId, note))}>
            <X /> Reject
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Approved code runs on your runner against the project&apos;s target URL. Edits move an approved spec back to draft until it is approved again.
      </p>
    </div>
  );
}
