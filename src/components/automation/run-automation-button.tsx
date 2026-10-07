"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bot } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/client";

/** Queues an automation run for every approved automated case (optionally scoped to a test run). */
export function RunAutomationButton({
  projectId,
  testRunId,
  testCaseIds,
  automatedCount,
  label,
  variant = "outline",
  size = "default",
}: {
  projectId: string;
  testRunId?: string;
  testCaseIds?: string[];
  automatedCount: number;
  label?: string;
  variant?: "outline" | "default";
  size?: "default" | "sm";
}) {
  const router = useRouter();
  const { t } = useI18n();
  const m = t.automation.runButton;
  const [pending, setPending] = useState(false);

  const start = async () => {
    setPending(true);
    try {
      const response = await fetch("/api/automation/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId, testRunId, testCaseIds }),
      });
      const body = await response.json();
      if (!response.ok) {
        toast.error(body?.error?.message ?? m.startFailed);
        return;
      }
      toast.success(m.queued);
      router.push(`/automation/runs/${body.run.id}`);
    } catch {
      toast.error(m.networkError);
    } finally {
      setPending(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={start}
      disabled={pending || automatedCount === 0}
      title={automatedCount === 0 ? m.needApproved : undefined}
      data-testid="run-automation"
    >
      <Bot /> {pending ? m.queuing : (label ?? m.label)}
      {automatedCount > 0 ? <span className="text-xs opacity-70">({automatedCount})</span> : null}
    </Button>
  );
}
