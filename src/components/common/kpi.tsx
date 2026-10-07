import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function KpiStrip({ children, columns = 6 }: { children: ReactNode; columns?: 4 | 6 }) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 divide-x divide-y rounded-md border md:divide-y-0",
        columns === 4 ? "md:grid-cols-4" : "md:grid-cols-3 xl:grid-cols-6",
      )}
    >
      {children}
    </div>
  );
}

export function Kpi({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "passed" | "failed";
}) {
  return (
    <div className="px-4 py-3">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div
        className={cn(
          "mt-1 text-2xl font-semibold tabular-nums tracking-tight",
          tone === "passed" && "text-passed",
          tone === "failed" && "text-failed",
        )}
      >
        {value}
      </div>
      {hint ? <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  );
}
