"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { AiBadge, TypeBadge } from "@/components/common/badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { addSuggestedCasesAction } from "@/app/actions/automation";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/define";
import type { FailureAnalysis } from "@/lib/domain/types";

export function FailureAnalysisPanel({
  resultId,
  analysis,
  analyzedLabel,
}: {
  resultId: string;
  analysis: FailureAnalysis | null;
  /** Formatted on the server so the relative time cannot cause a hydration mismatch. */
  analyzedLabel: string | null;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const m = t.automation.analysis;
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [pending, startTransition] = useTransition();

  const analyze = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/automation/results/${resultId}/analyze`, { method: "POST" });
      const body = await response.json();
      if (!response.ok) toast.error(body?.error?.message ?? m.failed);
      else router.refresh();
    } catch {
      toast.error(m.networkError);
    } finally {
      setLoading(false);
    }
  };

  if (!analysis) {
    return (
      <Button variant="outline" size="sm" onClick={analyze} disabled={loading} data-testid="analyze-failure">
        {loading ? <LoaderCircle className="animate-spin" /> : <Sparkles />} {m.analyze}
      </Button>
    );
  }

  return (
    <div className="space-y-2 rounded-md border border-violet-200 bg-violet-50/40 p-3 text-[13px]" data-testid="failure-analysis">
      <div className="flex flex-wrap items-center gap-2">
        <AiBadge label="AI SUGGESTION" />
        <Badge variant="outline">{t.enums.failureCategory[analysis.category]}</Badge>
        <Badge variant={analysis.confidence === "high" ? "info" : "default"}>{fmt(m.confidence, { level: t.enums.confidence[analysis.confidence] })}</Badge>
        <span className="text-xs text-muted-foreground">
          {analysis.provider === "heuristic" ? t.shell.aiProvider.heuristic : analysis.provider} · {analyzedLabel}
        </span>
        <Button variant="ghost" size="sm" className="ml-auto" onClick={analyze} disabled={loading}>
          {m.reanalyze}
        </Button>
      </div>
      <p>
        <span className="font-medium">{m.probableCause}</span>
        {analysis.probableCause}
      </p>
      <p>
        <span className="font-medium">{m.nextStep}</span>
        {analysis.suggestedNextStep}
      </p>
      {analysis.suggestedRegressionCases.length ? (
        <div className="space-y-1">
          <div className="text-xs font-medium text-muted-foreground">{m.regressionCases}</div>
          {analysis.suggestedRegressionCases.map((suggestion, index) => (
            <label key={index} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selected.includes(index)}
                onChange={() => setSelected(selected.includes(index) ? selected.filter((i) => i !== index) : [...selected, index])}
              />
              <TypeBadge type={suggestion.type} />
              <span>{suggestion.title}</span>
            </label>
          ))}
          <Button
            size="sm"
            variant="outline"
            disabled={pending || selected.length === 0}
            onClick={() =>
              startTransition(async () => {
                const result = await addSuggestedCasesAction(resultId, selected);
                if (result.error) toast.error(result.error);
                else {
                  toast.success(result.message ?? m.added);
                  setSelected([]);
                }
              })
            }
          >
            <Plus /> {m.addDrafts}
          </Button>
        </div>
      ) : null}
      <p className="text-[11px] text-muted-foreground">{m.disclaimer}</p>
    </div>
  );
}
