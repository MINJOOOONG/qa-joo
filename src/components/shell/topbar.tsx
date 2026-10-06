"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Check, ChevronsUpDown, LogOut, Plus, Server, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { setCurrentEnvironment, setCurrentProject } from "@/app/actions/preferences";
import { ENVIRONMENTS, ENVIRONMENT_LABELS, type Environment } from "@/lib/domain/constants";
import type { CurrentUser } from "@/lib/domain/types";
import { GlobalSearch } from "./global-search";

interface ProjectOption {
  id: string;
  key: string;
  name: string;
}

export function Topbar({
  projects,
  currentProjectId,
  environment,
  user,
  canSignOut,
  signOutAction,
}: {
  projects: ProjectOption[];
  currentProjectId: string | null;
  environment: Environment;
  user: CurrentUser;
  canSignOut: boolean;
  signOutAction: () => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();
  const current = projects.find((p) => p.id === currentProjectId) ?? null;

  return (
    <header className="sticky top-0 z-20 flex h-12 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur">
      <GlobalSearch />
      <div className="ml-auto flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="min-w-44 justify-between" data-testid="project-switcher" disabled={pending}>
              <span className="truncate">
                {current ? (
                  <>
                    <span className="font-mono text-[11px] text-muted-foreground">{current.key}</span> {current.name}
                  </>
                ) : (
                  "All projects"
                )}
              </span>
              <ChevronsUpDown className="text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>Current project</DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => startTransition(() => setCurrentProject(null))}>
              <Check className={current ? "invisible" : ""} /> All projects
            </DropdownMenuItem>
            {projects.map((project) => (
              <DropdownMenuItem key={project.id} onSelect={() => startTransition(() => setCurrentProject(project.id))}>
                <Check className={project.id === currentProjectId ? "" : "invisible"} />
                <span className="font-mono text-[11px] text-muted-foreground">{project.key}</span>
                <span className="truncate">{project.name}</span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/projects/new">
                <Plus /> New project
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" data-testid="environment-switcher" disabled={pending}>
              <Server className="text-muted-foreground" />
              {ENVIRONMENT_LABELS[environment]}
              <ChevronsUpDown className="text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Default environment</DropdownMenuLabel>
            {ENVIRONMENTS.map((env) => (
              <DropdownMenuItem key={env} onSelect={() => startTransition(() => setCurrentEnvironment(env))}>
                <Check className={env === environment ? "" : "invisible"} /> {ENVIRONMENT_LABELS[env]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

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
