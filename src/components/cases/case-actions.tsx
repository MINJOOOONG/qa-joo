"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bot, Copy, ListPlus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NativeSelect } from "@/components/ui/input";
import { fmt } from "@/lib/i18n/define";
import { useI18n } from "@/lib/i18n/client";
import { addToRunAction, deleteCaseAction, duplicateCaseAction } from "@/app/actions/cases";

export interface RunOption {
  id: string;
  name: string;
}

export function CaseActions({
  caseId,
  projectId,
  caseKey,
  isApproved,
  activeRuns,
  automationTestId,
  returnTo,
}: {
  caseId: string;
  projectId: string;
  caseKey: string;
  isApproved: boolean;
  activeRuns: RunOption[];
  automationTestId: string | null;
  returnTo: string;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const a = t.cases.actions;
  const [pending, startTransition] = useTransition();
  const [runDialog, setRunDialog] = useState(false);
  const [runId, setRunId] = useState(activeRuns[0]?.id ?? "");
  const [generating, setGenerating] = useState(false);

  const generateAutomation = async () => {
    setGenerating(true);
    try {
      const response = await fetch("/api/automation/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ testCaseId: caseId }),
      });
      const body = await response.json();
      if (!response.ok) {
        toast.error(body?.error?.message ?? a.generateFailed);
        return;
      }
      router.push(`/automation/tests/${body.automationTest.id}`);
    } catch {
      toast.error(a.generateNetworkError);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Button variant="outline" size="sm" asChild>
        <Link href={`/cases/${caseId}/edit?returnTo=${encodeURIComponent(returnTo)}`}>
          <Pencil /> {a.edit}
        </Link>
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await duplicateCaseAction(caseId);
            if (result?.error) toast.error(result.error);
          })
        }
      >
        <Copy /> {a.duplicate}
      </Button>
      <Button variant="outline" size="sm" disabled={!isApproved} onClick={() => setRunDialog(true)} title={isApproved ? undefined : a.approveFirst}>
        <ListPlus /> {a.addToRun}
      </Button>
      {automationTestId ? (
        <Button variant="outline" size="sm" asChild>
          <Link href={`/automation/tests/${automationTestId}`}>
            <Bot /> {a.viewAutomation}
          </Link>
        </Button>
      ) : (
        <Button variant="outline" size="sm" onClick={generateAutomation} disabled={generating || !isApproved} data-testid="generate-automation">
          <Bot /> {generating ? a.generating : a.generateAutomation}
        </Button>
      )}
      <Button
        variant="destructive-outline"
        size="sm"
        disabled={pending}
        onClick={() => {
          if (!confirm(fmt(a.confirmDelete, { key: caseKey }))) return;
          startTransition(async () => {
            const result = await deleteCaseAction(caseId, returnTo);
            if (result?.error) toast.error(result.error);
          });
        }}
      >
        <Trash2 /> {a.delete}
      </Button>

      <Dialog open={runDialog} onOpenChange={setRunDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{fmt(a.dialogTitle, { key: caseKey })}</DialogTitle>
            <DialogDescription>{a.dialogDescription}</DialogDescription>
          </DialogHeader>
          {activeRuns.length ? (
            <NativeSelect value={runId} onChange={(event) => setRunId(event.target.value)} aria-label={a.runLabel}>
              {activeRuns.map((run) => (
                <option key={run.id} value={run.id}>
                  {run.name}
                </option>
              ))}
            </NativeSelect>
          ) : (
            <p className="text-[13px] text-muted-foreground">{a.noActiveRuns}</p>
          )}
          <DialogFooter>
            <Button variant="outline" asChild>
              <Link href={`/runs/new?project=${projectId}&cases=${caseId}`}>{a.createRun}</Link>
            </Button>
            <Button
              disabled={!runId || pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await addToRunAction(runId, [caseId]);
                  if (result.error) toast.error(result.error);
                  else {
                    toast.success(result.message ?? a.added);
                    setRunDialog(false);
                  }
                })
              }
            >
              {a.addToRunButton}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
