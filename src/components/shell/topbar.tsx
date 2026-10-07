"use client";

import { useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FlaskConical, LogOut, Settings, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { CurrentUser } from "@/lib/domain/types";
import { cn } from "@/lib/utils";
import { GlobalSearch } from "./global-search";

/** Primary navigation: everything else (cases, runs, automation…) lives inside a project. */
const NAV = [{ href: "/projects", label: "Projects" }] as const;

export function Topbar({
  user,
  canSignOut,
  signOutAction,
  workspaceLabel,
  aiLabel,
}: {
  user: CurrentUser;
  canSignOut: boolean;
  signOutAction: () => Promise<void>;
  workspaceLabel: string;
  aiLabel: string;
}) {
  const [, startTransition] = useTransition();
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-6 border-b bg-background/95 px-6 backdrop-blur">
      <Link href="/projects" className="flex items-center gap-2" aria-label="QA JOO home">
        <span className="flex size-7 items-center justify-center rounded-md bg-primary text-white">
          <FlaskConical className="size-4" />
        </span>
        <span className="text-[15px] font-semibold tracking-tight">QA JOO</span>
      </Link>
      <nav className="flex h-full items-center gap-1" aria-label="Primary">
        {NAV.map(({ href, label }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex h-full items-center px-3 text-sm text-muted-foreground transition-colors hover:text-foreground",
                active && "font-medium text-foreground after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary",
              )}
            >
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="ml-auto flex items-center gap-3">
        <GlobalSearch />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2" data-testid="user-menu">
              <span className="flex size-6 items-center justify-center rounded-full bg-zinc-200 text-[11px] font-semibold text-zinc-700">
                {user.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="max-w-32 truncate">{user.name}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel className="normal-case tracking-normal">
              <div className="text-[13px] font-medium text-foreground">{user.name}</div>
              <div className="text-xs">{user.email}</div>
            </DropdownMenuLabel>
            <DropdownMenuItem disabled>
              Workspace: {workspaceLabel} · AI: {aiLabel}
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings">
                <Settings /> Settings
              </Link>
            </DropdownMenuItem>
            {user.isDemo ? (
              <DropdownMenuItem disabled>
                <UserRound /> Local session (no sign-in required)
              </DropdownMenuItem>
            ) : null}
            {canSignOut ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => startTransition(() => signOutAction())}>
                  <LogOut /> Sign out
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
