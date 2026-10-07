"use client";

import { useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FlaskConical, Languages, LogOut, Settings, UserRound } from "lucide-react";
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
import { setLocale } from "@/app/actions/locale";
import { fmt } from "@/lib/i18n/define";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { GlobalSearch } from "./global-search";

/** Primary navigation: everything else (cases, runs, automation…) lives inside a project. */
const NAV = [{ href: "/projects", key: "projects" }] as const;

export function Topbar({
  user,
  canSignOut,
  signOutAction,
  workspace,
  aiProvider,
}: {
  user: CurrentUser;
  canSignOut: boolean;
  signOutAction: () => Promise<void>;
  workspace: "supabase" | "demo" | "local";
  aiProvider: "anthropic" | "openai" | "heuristic";
}) {
  const [pending, startTransition] = useTransition();
  const pathname = usePathname();
  const { t, locale } = useI18n();

  return (
    <header className="sticky top-0 z-20 flex h-14 min-w-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur sm:gap-6 sm:px-6">
      <Link href="/projects" className="flex shrink-0 items-center gap-2" aria-label={t.shell.home}>
        <span className="flex size-7 items-center justify-center rounded-md bg-primary text-white">
          <FlaskConical className="size-4" />
        </span>
        <span className="hidden whitespace-nowrap text-[15px] font-semibold tracking-tight sm:inline">QA JOO</span>
      </Link>
      <nav className="flex h-full shrink-0 items-center gap-1" aria-label="Primary">
        {NAV.map(({ href, key }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex h-full items-center whitespace-nowrap px-2 text-sm sm:px-3 text-muted-foreground transition-colors hover:text-foreground",
                active && "font-medium text-foreground after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary",
              )}
            >
              {t.shell.nav[key]}
            </Link>
          );
        })}
      </nav>
      <div className="ml-auto flex min-w-0 items-center justify-end gap-2 sm:gap-3">
        <GlobalSearch />
        <div className="flex shrink-0 items-center rounded-md border p-0.5 text-xs" role="group" aria-label={t.shell.switchLanguage}>
          <Languages className="mx-1 hidden size-3.5 sm:block text-muted-foreground" aria-hidden />
          {(["ko", "en"] as const).map((value) => (
            <button
              key={value}
              type="button"
              disabled={pending}
              aria-pressed={locale === value}
              data-testid={`locale-${value}`}
              onClick={() => startTransition(() => setLocale(value))}
              className={cn(
                "whitespace-nowrap rounded px-2 py-1 transition-colors",
                locale === value ? "bg-primary font-medium text-white" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {value === "ko" ? "한국어" : "EN"}
            </button>
          ))}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="shrink-0 gap-2" data-testid="user-menu">
              <span className="flex size-6 items-center justify-center rounded-full bg-zinc-200 text-[11px] font-semibold text-zinc-700">
                {user.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="hidden max-w-32 truncate md:inline">{user.name}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel className="normal-case tracking-normal">
              <div className="text-[13px] font-medium text-foreground">{user.name}</div>
              <div className="text-xs">{user.email}</div>
            </DropdownMenuLabel>
            <DropdownMenuItem disabled>
              {fmt(t.shell.userMenu.workspace, { workspace: t.shell.workspace[workspace], ai: t.shell.aiProvider[aiProvider] })}
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings">
                <Settings /> {t.shell.userMenu.settings}
              </Link>
            </DropdownMenuItem>
            {user.isDemo ? (
              <DropdownMenuItem disabled>
                <UserRound /> {t.shell.userMenu.localSession}
              </DropdownMenuItem>
            ) : null}
            {canSignOut ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => startTransition(() => signOutAction())}>
                  <LogOut /> {t.shell.userMenu.signOut}
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
