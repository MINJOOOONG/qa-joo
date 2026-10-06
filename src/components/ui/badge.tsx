import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 whitespace-nowrap rounded px-1.5 py-px text-[11px] font-medium leading-4 [&_svg]:size-3",
  {
    variants: {
      variant: {
        default: "bg-muted text-zinc-700",
        outline: "border border-border text-zinc-700",
        primary: "bg-accent text-accent-foreground",
        ai: "bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-200",
        passed: "bg-passed-bg text-green-800",
        failed: "bg-failed-bg text-red-800",
        blocked: "bg-blocked-bg text-orange-800",
        skipped: "bg-skipped-bg text-zinc-600",
        untested: "border border-border bg-untested-bg text-zinc-500",
        warning: "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200",
        info: "bg-sky-50 text-sky-800",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function Badge({ className, variant, ...props }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
