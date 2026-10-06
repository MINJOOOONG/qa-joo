"use client";

import { useTransition } from "react";
import { Ban } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cancelAutomationRunAction } from "@/app/actions/automation";

export function CancelRunButton({ runId }: { runId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await cancelAutomationRunAction(runId);
          if (result.error) toast.error(result.error);
        })
      }
    >
      <Ban /> Cancel run
    </Button>
  );
}
