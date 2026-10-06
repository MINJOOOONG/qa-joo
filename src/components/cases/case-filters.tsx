"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/input";
import {
  AUTOMATION_STATUSES,
  AUTOMATION_STATUS_LABELS,
  CASE_TYPES,
  CASE_TYPE_LABELS,
  PRIORITIES,
  PRIORITY_LABELS,
  RESULT_STATUSES,
  RESULT_STATUS_LABELS,
} from "@/lib/domain/constants";

interface Option {
  value: string;
  label: string;
}

const FILTERS: Array<{ key: string; label: string; options: Option[] }> = [
  { key: "type", label: "Type", options: CASE_TYPES.map((v) => ({ value: v, label: CASE_TYPE_LABELS[v] })) },
  { key: "priority", label: "Priority", options: PRIORITIES.map((v) => ({ value: v, label: PRIORITY_LABELS[v] })) },
  { key: "automation", label: "Automation", options: AUTOMATION_STATUSES.map((v) => ({ value: v, label: AUTOMATION_STATUS_LABELS[v] })) },
  { key: "result", label: "Last Result", options: RESULT_STATUSES.map((v) => ({ value: v, label: RESULT_STATUS_LABELS[v] })) },
  {
    key: "source",
    label: "Source",
    options: [
      { value: "manual", label: "Manual" },
      { value: "ai_generated", label: "AI generated" },
    ],
  },
  {
    key: "review",
    label: "Review",
    options: [
      { value: "approved", label: "Approved" },
      { value: "draft", label: "AI Draft" },
      { value: "rejected", label: "Rejected" },
    ],
  },
];

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

  const active = ["project", "section", ...FILTERS.map((f) => f.key), "q"].some((key) => params.get(key));

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="Search ID or title"
          aria-label="Search test cases"
          className="h-7 w-52 rounded-md border border-input bg-background pl-7 pr-2 text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
        />
      </div>
      {showProject ? (
        <NativeSelect
          aria-label="Project"
          className="h-7 w-auto text-xs"
          value={params.get("project") ?? ""}
          onChange={(event) => update("project", event.target.value || null)}
        >
          <option value="">Project: current</option>
          <option value="all">All projects</option>
          {projects.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </NativeSelect>
      ) : null}
      {sections.length ? (
        <NativeSelect
          aria-label="Section"
          className="h-7 w-auto max-w-56 text-xs"
          value={params.get("section") ?? ""}
          onChange={(event) => update("section", event.target.value || null)}
        >
          <option value="">Section: all</option>
          <option value="none">Unsectioned</option>
          {sections.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </NativeSelect>
      ) : null}
      {FILTERS.map((filter) => (
        <NativeSelect
          key={filter.key}
          aria-label={filter.label}
          className="h-7 w-auto text-xs"
          value={params.get(filter.key) ?? ""}
          onChange={(event) => update(filter.key, event.target.value || null)}
        >
          <option value="">{filter.label}: all</option>
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
          <X /> Clear
        </Button>
      ) : null}
    </div>
  );
}
