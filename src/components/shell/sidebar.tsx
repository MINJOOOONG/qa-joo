"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Bot,
  FlaskConical,
  FolderKanban,
  LayoutDashboard,
  ListChecks,
  PlayCircle,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/cases", label: "Test Cases", icon: ListChecks },
  { href: "/runs", label: "Test Runs", icon: PlayCircle },
  { href: "/automation", label: "Automation", icon: Bot },
  { href: "/activity", label: "Activity", icon: Activity },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

export function Sidebar({ workspaceLabel, aiLabel }: { workspaceLabel: string; aiLabel: string }) {
  const pathname = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-56 flex-col border-r bg-sidebar">
      <Link href="/dashboard" className="flex h-12 items-center gap-2 border-b px-4" aria-label="QA JOO home">
        <span className="flex size-6 items-center justify-center rounded bg-primary text-white">
          <FlaskConical className="size-3.5" />
        </span>
        <span className="text-[15px] font-semibold tracking-tight">QA JOO</span>
      </Link>
      <nav className="flex-1 space-y-0.5 p-2" aria-label="Primary">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px] text-zinc-600 transition-colors hover:bg-zinc-200/60 hover:text-zinc-900",
                active && "bg-white font-medium text-zinc-900 shadow-xs ring-1 ring-border",
              )}
            >
              <Icon className={cn("size-4", active ? "text-primary" : "text-zinc-400")} />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="space-y-1 border-t p-3 text-[11px] text-muted-foreground">
        <div className="flex items-center justify-between">
          <span>Workspace</span>
          <span className="font-medium text-zinc-700">{workspaceLabel}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>AI provider</span>
          <span className="font-medium text-zinc-700">{aiLabel}</span>
        </div>
      </div>
    </aside>
  );
}
