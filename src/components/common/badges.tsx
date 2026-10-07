"use client";

import { Bot, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  type AutomationRunStatus,
  type AutomationStatus,
  type CaseType,
  type Environment,
  type Priority,
  type ResultStatus,
} from "@/lib/domain/constants";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

export function ResultBadge({ status, className }: { status: ResultStatus | null | undefined; className?: string }) {
  const { t } = useI18n();
  const value = status ?? "untested";
  return (
    <Badge variant={value} className={cn("min-w-16 justify-center", className)} data-result={value}>
      {t.enums.resultStatus[value]}
    </Badge>
  );
}

const PRIORITY_STYLE: Record<Priority, string> = {
  critical: "text-red-700",
  high: "text-orange-700",
  medium: "text-zinc-700",
  low: "text-zinc-500",
};

const PRIORITY_DOT: Record<Priority, string> = {
  critical: "bg-red-600",
  high: "bg-orange-500",
  medium: "bg-zinc-400",
  low: "bg-zinc-300",
};

export function PriorityLabel({ priority }: { priority: Priority }) {
  const { t } = useI18n();
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", PRIORITY_STYLE[priority])}>
      <span className={cn("size-1.5 rounded-full", PRIORITY_DOT[priority])} />
      {t.enums.priority[priority]}
    </span>
  );
}

export function TypeBadge({ type }: { type: CaseType }) {
  const { t } = useI18n();
  const unhappy = type === "negative" || type === "boundary" || type === "security" || type === "error";
  return (
    <Badge variant="outline" className={cn(unhappy && "border-amber-200 bg-amber-50/60 text-amber-900")}>
      {t.enums.caseType[type]}
    </Badge>
  );
}

export function AutomationBadge({ status }: { status: AutomationStatus }) {
  const { t } = useI18n();
  if (status === "automated") {
    return (
      <Badge variant="primary">
        <Bot /> {t.enums.automationStatus[status]}
      </Badge>
    );
  }
  return <Badge variant={status === "candidate" ? "info" : "default"}>{t.enums.automationStatus[status]}</Badge>;
}

export function ModeBadge({ mode }: { mode: "manual" | "automated" }) {
  const { t } = useI18n();
  return mode === "automated" ? (
    <Badge variant="primary">
      <Bot /> {t.enums.automationStatus.automated}
    </Badge>
  ) : (
    <Badge variant="default">{t.enums.automationStatus.manual}</Badge>
  );
}

export function AiBadge({ label = "AI GENERATED", className }: { label?: string; className?: string }) {
  const { t } = useI18n();
  /** Accepts an already-translated label, or one of the legacy English keys (translated here). */
  const legacy: Record<string, string> = { "AI GENERATED": t.common.aiBadge.generated, "AI SUGGESTION": t.common.aiBadge.suggestion, "AI DRAFT": t.common.aiBadge.draft };
  const text = legacy[label] ?? label;
  return (
    <Badge variant="ai" className={cn("tracking-wide", className)}>
      <Sparkles /> {text}
    </Badge>
  );
}

export function EnvironmentBadge({ environment }: { environment: Environment }) {
  const { t } = useI18n();
  const style: Record<Environment, string> = {
    local: "bg-zinc-100 text-zinc-700",
    development: "bg-sky-50 text-sky-800",
    staging: "bg-amber-50 text-amber-800",
    production: "bg-rose-50 text-rose-800",
  };
  return <Badge className={style[environment]}>{t.enums.environment[environment]}</Badge>;
}

export function AutomationRunStatusBadge({ status }: { status: AutomationRunStatus }) {
  const { t } = useI18n();
  const variant = {
    queued: "untested",
    running: "info",
    passed: "passed",
    failed: "failed",
    cancelled: "skipped",
  } as const;
  return (
    <Badge variant={variant[status]} data-run-status={status}>
      {status === "running" ? <span className="size-1.5 animate-pulse rounded-full bg-sky-600" /> : null}
      {t.enums.automationRunStatus[status]}
    </Badge>
  );
}
