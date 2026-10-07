"use client";

import { useTransition } from "react";
import { Ban } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cancelAutomationRunAction } from "@/app/actions/automation";
import { useI18n } from "@/lib/i18n/client";

export function CancelRunButton({ runId }: { runId: string }) {
  const [pending, startTransition] = useTransition();
  const { t } = useI18n();
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
      <Ban /> {t.automation.cancelRun}
    </Button>
  );
}
