"use client";

import { Fragment, useState, useTransition } from "react";
import Link from "next/link";
import { Check, ChevronDown, ChevronRight, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { PriorityLabel, TypeBadge } from "@/components/common/badges";
import { Button } from "@/components/ui/button";
import { reviewManyAction } from "@/app/actions/cases";
import { ReviewButtons } from "@/components/cases/review-buttons";
import type { CaseType, Priority } from "@/lib/domain/constants";

export interface DraftRow {
  id: string;
  caseKey: string;
  title: string;
  sectionPath: string | null;
  type: CaseType;
  priority: Priority;
  preconditions: string | null;
  steps: string[];
  expectedResult: string;
  rationale: string | null;
}

export function DraftReviewTable({ projectId, projectKey, drafts }: { projectId: string; projectKey: string; drafts: DraftRow[] }) {
  const [rawSelected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  // Drafts reviewed elsewhere disappear after a refresh; never act on (or count) stale selections.
  const selected = new Set(drafts.filter((draft) => rawSelected.has(draft.id)).map((draft) => draft.id));
  const allSelected = selected.size === drafts.length && drafts.length > 0;

  const toggle = (set: Set<string>, id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  };

  const decide = (ids: string[], decision: "approve" | "reject") =>
    startTransition(async () => {
      const result = await reviewManyAction(projectId, ids, decision);
      if (result.error) toast.error(result.error);
      else {
        toast.success(result.message ?? "Done.");
        setSelected(new Set());
      }
    });

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="passed" size="sm" disabled={pending} onClick={() => decide([], "approve")} data-testid="approve-all">
          <Check /> Approve All ({drafts.length})
        </Button>
        <Button variant="outline" size="sm" disabled={pending || selected.size === 0} onClick={() => decide(Array.from(selected), "approve")}>
          Approve selected ({selected.size})
        </Button>
        <Button variant="outline" size="sm" disabled={pending || selected.size === 0} onClick={() => decide(Array.from(selected), "reject")}>
          <X /> Reject selected
        </Button>
      </div>
      <div className="overflow-hidden rounded-md border">
        <table className="w-full text-[13px]">
          <thead className="bg-subtle text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr className="border-b">
              <th className="w-8 px-3 py-2">
                <input
                  type="checkbox"
                  aria-label="Select all drafts"
                  checked={allSelected}
                  onChange={() => setSelected(allSelected ? new Set() : new Set(drafts.map((d) => d.id)))}
                />
              </th>
              <th className="w-6" />
              <th className="w-24 px-2 py-2 text-left font-medium">ID</th>
              <th className="px-2 py-2 text-left font-medium">Title</th>
              <th className="px-2 py-2 text-left font-medium">Section</th>
              <th className="px-2 py-2 text-left font-medium">Type</th>
              <th className="px-2 py-2 text-left font-medium">Priority</th>
              <th className="w-28 px-3 py-2 text-right font-medium">Review</th>
            </tr>
          </thead>
          <tbody>
            {drafts.map((draft) => {
              const isOpen = expanded.has(draft.id);
              return (
                <Fragment key={draft.id}>
                  <tr className="border-b hover:bg-zinc-50" data-testid="draft-row">
                    <td className="px-3 py-1.5">
                      <input type="checkbox" aria-label={`Select ${draft.caseKey}`} checked={selected.has(draft.id)} onChange={() => setSelected(toggle(selected, draft.id))} />
                    </td>
                    <td>
                      <button type="button" aria-label={isOpen ? "Collapse" : "Expand"} onClick={() => setExpanded(toggle(expanded, draft.id))} className="rounded p-0.5 text-muted-foreground hover:bg-muted">
                        {isOpen ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                      </button>
                    </td>
                    <td className="px-2 font-mono text-xs text-muted-foreground">{draft.caseKey}</td>
                    <td className="px-2">
                      <button type="button" className="text-left hover:underline" onClick={() => setExpanded(toggle(expanded, draft.id))}>
                        {draft.title}
                      </button>
                    </td>
                    <td className="max-w-48 truncate px-2 text-xs text-muted-foreground">{draft.sectionPath ?? "—"}</td>
                    <td className="px-2">
                      <TypeBadge type={draft.type} />
                    </td>
                    <td className="px-2">
                      <PriorityLabel priority={draft.priority} />
                    </td>
                    <td className="px-3">
                      <div className="flex justify-end gap-1">
                        <Button size="icon-sm" variant="ghost" asChild aria-label={`Edit ${draft.caseKey}`}>
                          <Link href={`/cases/${draft.id}/edit?returnTo=${encodeURIComponent(`/projects/${projectKey}/review`)}`}>
                            <Pencil />
                          </Link>
                        </Button>
                        <ReviewButtons caseId={draft.id} size="icon-sm" />
                      </div>
                    </td>
                  </tr>
                  {isOpen ? (
                    <tr className="border-b bg-zinc-50/60">
                      <td colSpan={8} className="px-12 py-3">
                        <div className="grid gap-3 text-[13px] md:grid-cols-[1fr_1fr]">
                          <div className="space-y-2">
                            {draft.preconditions ? (
                              <p>
                                <span className="text-xs font-medium text-muted-foreground">Preconditions: </span>
                                {draft.preconditions}
                              </p>
                            ) : null}
                            <ol className="list-decimal space-y-0.5 pl-5">
                              {draft.steps.map((step, index) => (
                                <li key={index}>{step}</li>
                              ))}
                            </ol>
                          </div>
                          <div className="space-y-2">
                            <p>
                              <span className="text-xs font-medium text-muted-foreground">Expected: </span>
                              {draft.expectedResult}
                            </p>
                            {draft.rationale ? (
                              <p className="text-xs text-violet-800">
                                <span className="font-medium">AI SUGGESTION · why:</span> {draft.rationale}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
