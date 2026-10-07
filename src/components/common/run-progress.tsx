"use client";

import type { RunStats } from "@/lib/domain/run-stats";
import { formatPercent } from "@/lib/domain/run-stats";
import { fmt } from "@/lib/i18n/define";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

const SEGMENTS = [
  { key: "passed", className: "bg-passed" },
  { key: "failed", className: "bg-failed" },
  { key: "blocked", className: "bg-blocked" },
  { key: "skipped", className: "bg-zinc-400" },
] as const;

/** Stacked progress bar: passed / failed / blocked / skipped, remainder = untested. */
export function RunProgressBar({ stats, className, height = "h-1.5" }: { stats: RunStats; className?: string; height?: string }) {
  const { t } = useI18n();
  return (
    <div
      className={cn("flex w-full overflow-hidden rounded-full bg-zinc-200/70", height, className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(stats.progress * 100)}
      aria-label={fmt(t.common.progressExecuted, { percent: formatPercent(stats.progress) })}
    >
      {stats.total > 0
        ? SEGMENTS.map((segment) =>
            stats[segment.key] > 0 ? (
              <div
                key={segment.key}
                className={segment.className}
                style={{ width: `${(stats[segment.key] / stats.total) * 100}%` }}
                title={`${t.enums.resultStatus[segment.key]}: ${stats[segment.key]}`}
              />
            ) : null,
          )
        : null}
    </div>
  );
}

export function RunProgressCell({ stats }: { stats: RunStats }) {
  return (
    <div className="flex min-w-36 items-center gap-2">
      <RunProgressBar stats={stats} />
      <span className="w-9 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
        {formatPercent(stats.progress, "0%")}
      </span>
    </div>
  );
}
