"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function ProjectTabs({ projectKey, draftCount }: { projectKey: string; draftCount: number }) {
  const pathname = usePathname();
  const base = `/projects/${projectKey}`;
  const tabs = [
    { href: base, label: "Overview", exact: true },
    { href: `${base}/cases`, label: "Test Cases" },
    { href: `${base}/review`, label: "AI Review", count: draftCount },
    { href: `${base}/runs`, label: "Test Runs" },
    { href: `${base}/automation`, label: "Automation" },
    { href: `${base}/activity`, label: "Activity" },
    { href: `${base}/settings`, label: "Settings" },
  ];
  return (
    <nav className="flex gap-1 border-b px-6" aria-label="Project">
      {tabs.map((tab) => {
        const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px flex h-9 items-center gap-1.5 border-b-2 border-transparent px-2.5 text-[13px] text-muted-foreground hover:text-foreground",
              active && "border-primary font-medium text-foreground",
            )}
          >
            {tab.label}
            {tab.count ? (
              <span className="rounded bg-violet-100 px-1 text-[11px] font-medium text-violet-700">{tab.count}</span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
