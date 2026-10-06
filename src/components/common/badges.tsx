import { Bot, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  AUTOMATION_RUN_STATUS_LABELS,
  AUTOMATION_STATUS_LABELS,
  CASE_TYPE_LABELS,
  ENVIRONMENT_LABELS,
  PRIORITY_LABELS,
  RESULT_STATUS_LABELS,
  type AutomationRunStatus,
  type AutomationStatus,
  type CaseType,
  type Environment,
  type Priority,
  type ResultStatus,
} from "@/lib/domain/constants";
import { cn } from "@/lib/utils";

export function ResultBadge({ status, className }: { status: ResultStatus | null | undefined; className?: string }) {
  const value = status ?? "untested";
  return (
    <Badge variant={value} className={cn("min-w-16 justify-center", className)} data-result={value}>
      {RESULT_STATUS_LABELS[value]}
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
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", PRIORITY_STYLE[priority])}>
      <span className={cn("size-1.5 rounded-full", PRIORITY_DOT[priority])} />
      {PRIORITY_LABELS[priority]}
    </span>
  );
}

export function TypeBadge({ type }: { type: CaseType }) {
  const unhappy = type === "negative" || type === "boundary" || type === "security" || type === "error";
  return (
    <Badge variant="outline" className={cn(unhappy && "border-amber-200 bg-amber-50/60 text-amber-900")}>
      {CASE_TYPE_LABELS[type]}
    </Badge>
  );
}

export function AutomationBadge({ status }: { status: AutomationStatus }) {
  if (status === "automated") {
    return (
      <Badge variant="primary">
        <Bot /> {AUTOMATION_STATUS_LABELS[status]}
      </Badge>
    );
  }
  return <Badge variant={status === "candidate" ? "info" : "default"}>{AUTOMATION_STATUS_LABELS[status]}</Badge>;
}

export function ModeBadge({ mode }: { mode: "manual" | "automated" }) {
  return mode === "automated" ? (
    <Badge variant="primary">
      <Bot /> Automated
    </Badge>
  ) : (
    <Badge variant="default">Manual</Badge>
  );
}

export function AiBadge({ label = "AI GENERATED", className }: { label?: "AI GENERATED" | "AI SUGGESTION" | "AI DRAFT"; className?: string }) {
  return (
    <Badge variant="ai" className={cn("tracking-wide", className)}>
      <Sparkles /> {label}
    </Badge>
  );
}

export function EnvironmentBadge({ environment }: { environment: Environment }) {
  const style: Record<Environment, string> = {
    local: "bg-zinc-100 text-zinc-700",
    development: "bg-sky-50 text-sky-800",
    staging: "bg-amber-50 text-amber-800",
    production: "bg-rose-50 text-rose-800",
  };
  return <Badge className={style[environment]}>{ENVIRONMENT_LABELS[environment]}</Badge>;
}

export function AutomationRunStatusBadge({ status }: { status: AutomationRunStatus }) {
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
      {AUTOMATION_RUN_STATUS_LABELS[status]}
    </Badge>
  );
}
