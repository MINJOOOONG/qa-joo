"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FolderKanban, ListChecks, PlayCircle, Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchHit {
  kind: "project" | "case" | "run";
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

const ICONS = { project: FolderKanban, case: ListChecks, run: PlayCircle } as const;

export function GlobalSearch() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: controller.signal });
        if (!response.ok) return;
        const body = (await response.json()) as { hits: SearchHit[] };
        setHits(body.hits);
        setActive(0);
        setOpen(true);
      } catch {
        // aborted or offline: keep previous hits
      }
    }, 150);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query]);

  const visibleHits = query.trim().length < 2 ? [] : hits;

  const go = (hit: SearchHit) => {
    setOpen(false);
    setQuery("");
    router.push(hit.href);
  };

  return (
    <div className="relative w-full max-w-md">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <input
        ref={inputRef}
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") setActive((value) => Math.min(value + 1, visibleHits.length - 1));
          if (event.key === "ArrowUp") setActive((value) => Math.max(value - 1, 0));
          if (event.key === "Enter" && visibleHits[active]) go(visibleHits[active]);
          if (event.key === "Escape") inputRef.current?.blur();
        }}
        placeholder="Search projects, cases, runs…"
        aria-label="Global search"
        className="h-8 w-full rounded-md border border-input bg-subtle pl-8 pr-12 text-[13px] outline-none placeholder:text-muted-foreground focus:border-ring focus:bg-background focus:ring-2 focus:ring-ring/20"
      />
      <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border bg-background px-1 font-mono text-[10px] text-muted-foreground">
        ⌘K
      </kbd>
      {open && visibleHits.length > 0 ? (
        <ul className="absolute left-0 right-0 top-9 z-50 max-h-96 overflow-auto rounded-md border bg-popover p-1 shadow-md" role="listbox">
          {visibleHits.map((hit, index) => {
            const Icon = ICONS[hit.kind];
            return (
              <li key={`${hit.kind}-${hit.id}`} role="option" aria-selected={index === active}>
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => go(hit)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[13px]",
                    index === active ? "bg-muted" : "hover:bg-muted",
                  )}
                >
                  <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{hit.title}</span>
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">{hit.subtitle}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
