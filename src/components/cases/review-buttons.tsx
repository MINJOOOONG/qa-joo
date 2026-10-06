"use client";

import { useTransition } from "react";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { reviewCaseAction } from "@/app/actions/cases";

export function ReviewButtons({ caseId, size = "sm" }: { caseId: string; size?: "sm" | "icon-sm" }) {
  const [pending, startTransition] = useTransition();
  const decide = (decision: "approve" | "reject") =>
    startTransition(async () => {
      const result = await reviewCaseAction(caseId, decision);
      if (result.error) toast.error(result.error);
    });
  if (size === "icon-sm") {
    return (
      <div className="flex gap-1">
        <Button size="icon-sm" variant="outline" aria-label="Approve" disabled={pending} onClick={() => decide("approve")}>
          <Check className="text-passed" />
        </Button>
        <Button size="icon-sm" variant="outline" aria-label="Reject" disabled={pending} onClick={() => decide("reject")}>
          <X className="text-failed" />
        </Button>
      </div>
    );
  }
  return (
    <div className="flex gap-1.5">
      <Button size="sm" variant="passed" disabled={pending} onClick={() => decide("approve")}>
        <Check /> Approve
      </Button>
      <Button size="sm" variant="outline" disabled={pending} onClick={() => decide("reject")}>
        <X /> Reject
      </Button>
    </div>
  );
}
