import type { RunStats } from "@/lib/domain/run-stats";
import { formatPercent } from "@/lib/domain/run-stats";
import { cn } from "@/lib/utils";

const SEGMENTS = [
  { key: "passed", className: "bg-passed", label: "Passed" },
  { key: "failed", className: "bg-failed", label: "Failed" },
  { key: "blocked", className: "bg-blocked", label: "Blocked" },
  { key: "skipped", className: "bg-zinc-400", label: "Skipped" },
] as const;

/** Stacked progress bar: passed / failed / blocked / skipped, remainder = untested. */
export function RunProgressBar({ stats, className, height = "h-1.5" }: { stats: RunStats; className?: string; height?: string }) {
  return (
    <div
      className={cn("flex w-full overflow-hidden rounded-full bg-zinc-200/70", height, className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(stats.progress * 100)}
      aria-label={`${formatPercent(stats.progress)} executed`}
    >
      {stats.total > 0
        ? SEGMENTS.map((segment) =>
            stats[segment.key] > 0 ? (
              <div
                key={segment.key}
                className={segment.className}
                style={{ width: `${(stats[segment.key] / stats.total) * 100}%` }}
                title={`${segment.label}: ${stats[segment.key]}`}
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
