"use client";

import { useTransition } from "react";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/client";
import { reviewCaseAction } from "@/app/actions/cases";

export function ReviewButtons({ caseId, size = "sm" }: { caseId: string; size?: "sm" | "icon-sm" }) {
  const [pending, startTransition] = useTransition();
  const { t } = useI18n();
  const r = t.cases.review;
  const decide = (decision: "approve" | "reject") =>
    startTransition(async () => {
      const result = await reviewCaseAction(caseId, decision);
      if (result.error) toast.error(result.error);
    });
  if (size === "icon-sm") {
    return (
      <div className="flex gap-1">
        <Button size="icon-sm" variant="outline" aria-label={r.approve} disabled={pending} onClick={() => decide("approve")}>
          <Check className="text-passed" />
        </Button>
        <Button size="icon-sm" variant="outline" aria-label={r.reject} disabled={pending} onClick={() => decide("reject")}>
          <X className="text-failed" />
        </Button>
      </div>
    );
  }
  return (
    <div className="flex gap-1.5">
      <Button size="sm" variant="passed" disabled={pending} onClick={() => decide("approve")}>
        <Check /> {r.approve}
      </Button>
      <Button size="sm" variant="outline" disabled={pending} onClick={() => decide("reject")}>
        <X /> {r.reject}
      </Button>
    </div>
  );
}
