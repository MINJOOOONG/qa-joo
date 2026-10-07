"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/input";
import { AUTOMATION_STATUSES, CASE_TYPES, PRIORITIES, RESULT_STATUSES } from "@/lib/domain/constants";
import { fmt } from "@/lib/i18n/define";
import { useI18n } from "@/lib/i18n/client";
import type { Dictionary } from "@/lib/i18n/dictionary";

interface Option {
  value: string;
  label: string;
}

const FILTER_KEYS = ["type", "priority", "automation", "result", "source", "review"] as const;

function buildFilters(t: Dictionary): Array<{ key: string; label: string; options: Option[] }> {
  const f = t.cases.filters;
  const e = t.enums;
  return [
    { key: "type", label: f.type, options: CASE_TYPES.map((v) => ({ value: v, label: e.caseType[v] })) },
    { key: "priority", label: f.priority, options: PRIORITIES.map((v) => ({ value: v, label: e.priority[v] })) },
    { key: "automation", label: f.automation, options: AUTOMATION_STATUSES.map((v) => ({ value: v, label: e.automationStatus[v] })) },
    { key: "result", label: f.lastResult, options: RESULT_STATUSES.map((v) => ({ value: v, label: e.resultStatus[v] })) },
    {
      key: "source",
      label: f.source,
      options: (["manual", "ai_generated"] as const).map((v) => ({ value: v, label: e.caseSource[v] })),
    },
    {
      key: "review",
      label: f.review,
      options: (["approved", "draft", "rejected"] as const).map((v) => ({ value: v, label: e.reviewStatus[v] })),
    },
  ];
}

export function CaseFilters({
  projects,
  sections,
  showProject,
}: {
  projects: Option[];
  sections: Option[];
  showProject: boolean;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const f = t.cases.filters;
  const filters = buildFilters(t);
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  // Set by Clear so the debounced search does not re-apply the old filters from stale params.
  const skipDebounce = useRef(false);

  const update = (key: string, value: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("case");
    if (key === "project") next.delete("section");
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  };

  useEffect(() => {
    if (skipDebounce.current) {
      skipDebounce.current = false;
      return;
    }
    const current = params.get("q") ?? "";
    if (q === current) return;
    const timer = setTimeout(() => update("q", q.trim() || null), 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debounce only on input changes
  }, [q]);

  const active = ["project", "section", ...FILTER_KEYS, "q"].some((key) => params.get(key));

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder={f.searchPlaceholder}
          aria-label={f.searchLabel}
          className="h-7 w-52 rounded-md border border-input bg-background pl-7 pr-2 text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
        />
      </div>
      {showProject ? (
        <NativeSelect
          aria-label={f.project}
          className="h-7 w-auto text-xs"
          value={params.get("project") ?? ""}
          onChange={(event) => update("project", event.target.value || null)}
        >
          <option value="">{f.projectCurrent}</option>
          <option value="all">{f.allProjects}</option>
          {projects.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </NativeSelect>
      ) : null}
      {sections.length ? (
        <NativeSelect
          aria-label={f.section}
          className="h-7 w-auto max-w-56 text-xs"
          value={params.get("section") ?? ""}
          onChange={(event) => update("section", event.target.value || null)}
        >
          <option value="">{f.sectionAll}</option>
          <option value="none">{f.unsectioned}</option>
          {sections.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </NativeSelect>
      ) : null}
      {filters.map((filter) => (
        <NativeSelect
          key={filter.key}
          aria-label={filter.label}
          className="h-7 w-auto text-xs"
          value={params.get(filter.key) ?? ""}
          onChange={(event) => update(filter.key, event.target.value || null)}
        >
          <option value="">{fmt(f.filterAll, { label: filter.label })}</option>
          {filter.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </NativeSelect>
      ))}
      {active ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            skipDebounce.current = q !== "";
            setQ("");
            router.replace(pathname, { scroll: false });
          }}
        >
          <X /> {f.clear}
        </Button>
      ) : null}
    </div>
  );
}
