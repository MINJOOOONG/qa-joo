"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bot, Copy, ListPlus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NativeSelect } from "@/components/ui/input";
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
        toast.error(body?.error?.message ?? "Could not generate the Playwright draft.");
        return;
      }
      router.push(`/automation/tests/${body.automationTest.id}`);
    } catch {
      toast.error("Network error while generating the Playwright draft.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Button variant="outline" size="sm" asChild>
        <Link href={`/cases/${caseId}/edit?returnTo=${encodeURIComponent(returnTo)}`}>
          <Pencil /> Edit
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
        <Copy /> Duplicate
      </Button>
      <Button variant="outline" size="sm" disabled={!isApproved} onClick={() => setRunDialog(true)} title={isApproved ? undefined : "Approve the AI draft first"}>
        <ListPlus /> Add to Test Run
      </Button>
      {automationTestId ? (
        <Button variant="outline" size="sm" asChild>
          <Link href={`/automation/tests/${automationTestId}`}>
            <Bot /> View Automation
          </Link>
        </Button>
      ) : (
        <Button variant="outline" size="sm" onClick={generateAutomation} disabled={generating || !isApproved} data-testid="generate-automation">
          <Bot /> {generating ? "Generating…" : "Generate Automation"}
        </Button>
      )}
      <Button
        variant="destructive-outline"
        size="sm"
        disabled={pending}
        onClick={() => {
          if (!confirm(`Delete ${caseKey}? Its results in every run are removed too.`)) return;
          startTransition(async () => {
            const result = await deleteCaseAction(caseId, returnTo);
            if (result?.error) toast.error(result.error);
          });
        }}
      >
        <Trash2 /> Delete
      </Button>

      <Dialog open={runDialog} onOpenChange={setRunDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add {caseKey} to a test run</DialogTitle>
            <DialogDescription>Only active runs of this project are listed.</DialogDescription>
          </DialogHeader>
          {activeRuns.length ? (
            <NativeSelect value={runId} onChange={(event) => setRunId(event.target.value)} aria-label="Test run">
              {activeRuns.map((run) => (
                <option key={run.id} value={run.id}>
                  {run.name}
                </option>
              ))}
            </NativeSelect>
          ) : (
            <p className="text-[13px] text-muted-foreground">No active runs yet.</p>
          )}
          <DialogFooter>
            <Button variant="outline" asChild>
              <Link href={`/runs/new?project=${projectId}&cases=${caseId}`}>Create new run</Link>
            </Button>
            <Button
              disabled={!runId || pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await addToRunAction(runId, [caseId]);
                  if (result.error) toast.error(result.error);
                  else {
                    toast.success(result.message ?? "Added.");
                    setRunDialog(false);
                  }
                })
              }
            >
              Add to run
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
