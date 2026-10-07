"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

export function ProjectTabs({ projectKey }: { projectKey: string }) {
  const pathname = usePathname();
  const { t } = useI18n();
  const l = t.projects.tabs;
  const base = `/projects/${projectKey}`;
  const tabs = [
    { href: base, label: l.overview, exact: true },
    { href: `${base}/cases`, label: l.cases },
    { href: `${base}/runs`, label: l.runs },
    { href: `${base}/automation`, label: l.automation },
    { href: `${base}/activity`, label: l.activity },
    { href: `${base}/settings`, label: l.settings },
  ];
  return (
    <nav className="flex gap-1 border-b px-6" aria-label={l.ariaLabel}>
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
          </Link>
        );
      })}
    </nav>
  );
}
