"use client";

import { useRouter } from "next/navigation";
import { TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

/**
 * A case list row: clicking anywhere in it opens the case drawer (`href`). Links and controls
 * inside the row keep their own behavior; the ID/title links stay for keyboard and middle-click.
 */
export function CaseRow({ href, className, ...props }: React.ComponentProps<"tr"> & { href: string }) {
  const router = useRouter();
  return (
    <TableRow
      {...props}
      className={cn("cursor-pointer", className)}
      onClick={(event) => {
        if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey) return;
        if ((event.target as HTMLElement).closest("a, button, input, select, textarea, label")) return;
        if (window.getSelection()?.toString()) return;
        router.push(href, { scroll: false });
      }}
    />
  );
}
