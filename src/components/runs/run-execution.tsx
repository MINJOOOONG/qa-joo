"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, ExternalLink, FileText, Image as ImageIcon, RotateCcw, Sparkles, Timer } from "lucide-react";
import { toast } from "sonner";
import { ModeBadge, PriorityLabel, ResultBadge, TypeBadge } from "@/components/common/badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldError, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { recordResultAction } from "@/app/actions/runs";
import {
  FAILURE_CATEGORIES,
  FAILURE_CATEGORY_LABELS,
  RESULT_STATUS_LABELS,
  SEVERITIES,
  SEVERITY_LABELS,
  type ExecutedResultStatus,
  type ResultStatus,
} from "@/lib/domain/constants";
import { computeRunStats, formatDuration } from "@/lib/domain/run-stats";
import type { RunRow } from "@/lib/services/runs";
import { cn } from "@/lib/utils";

const FILTERS: ResultStatus[] = ["passed", "failed", "blocked", "skipped", "untested"];

const COUNT_STYLE: Record<ResultStatus, string> = {
  passed: "text-passed",
  failed: "text-failed",
  blocked: "text-blocked",
  skipped: "text-zinc-500",
  untested: "text-zinc-400",
};

function statusOf(row: RunRow): ResultStatus {
  return row.result?.status ?? "untested";
}

function isPublicHttp(url: string | null | undefined): url is string {
  return Boolean(url && /^https:\/\//.test(url));
}

function EvidenceLinks({ row }: { row: RunRow }) {
  const evidence = {
    screenshot: row.automationResult?.screenshotUrl ?? row.result?.evidence.screenshotUrl ?? null,
    trace: row.automationResult?.traceUrl ?? row.result?.evidence.traceUrl ?? null,
    log: row.automationResult?.logUrl ?? row.result?.evidence.logUrl ?? null,
  };
  if (!evidence.screenshot && !evidence.trace && !evidence.log) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="flex items-center gap-1.5">
      {evidence.screenshot ? (
        <a href={evidence.screenshot} target="_blank" rel="noreferrer" className="text-primary hover:underline" title="Screenshot" onClick={(e) => e.stopPropagation()}>
          <ImageIcon className="size-3.5" />
        </a>
      ) : null}
      {evidence.trace ? (
        <a href={evidence.trace} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline" title="Playwright trace" onClick={(e) => e.stopPropagation()}>
          Trace
        </a>
      ) : null}
      {evidence.log ? (
        <a href={evidence.log} target="_blank" rel="noreferrer" className="text-primary hover:underline" title="Log" onClick={(e) => e.stopPropagation()}>
          <FileText className="size-3.5" />
        </a>
      ) : null}
    </span>
  );
}

export function RunExecution({
  runId,
  locked,
  rows,
  initialCaseId,
}: {
  runId: string;
  locked: boolean;
  rows: RunRow[];
  initialCaseId: string | null;
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(initialCaseId);
  const [filter, setFilter] = useState<ResultStatus | null>(null);
  const stats = useMemo(() => computeRunStats(rows.length, rows.map(statusOf)), [rows]);
  const visible = filter ? rows.filter((row) => statusOf(row) === filter) : rows;
  const selected = rows.find((row) => row.testCase.id === selectedId) ?? null;

  const select = useCallback((id: string | null) => {
    setSelectedId(id);
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("case", id);
    else url.searchParams.delete("case");
    window.history.replaceState(null, "", url);
  }, []);

  /** Next untested case after the given one (wrapping), used for auto-advance. */
  const nextUntested = (afterId: string): string | null => {
    const index = rows.findIndex((row) => row.testCase.id === afterId);
    const ordered = [...rows.slice(index + 1), ...rows.slice(0, index)];
    return ordered.find((row) => statusOf(row) === "untested")?.testCase.id ?? null;
  };

  const neighbour = (delta: number) => {
    if (!selected) return;
    const index = rows.findIndex((row) => row.testCase.id === selected.testCase.id);
    const next = rows[index + delta];
    if (next) select(next.testCase.id);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by result">
        {FILTERS.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setFilter(filter === status ? null : status)}
            aria-pressed={filter === status}
            data-testid={`summary-${status}`}
            className={cn(
              "flex min-w-24 items-baseline justify-between gap-3 rounded-md border px-3 py-1.5 text-left transition-colors hover:bg-muted",
              filter === status && "border-primary bg-accent",
            )}
          >
            <span className="text-xs text-muted-foreground">{RESULT_STATUS_LABELS[status]}</span>
            <span className={cn("text-lg font-semibold tabular-nums", COUNT_STYLE[status])}>{stats[status]}</span>
          </button>
        ))}
        {filter ? (
          <Button variant="ghost" size="sm" onClick={() => setFilter(null)}>
            Show all
          </Button>
        ) : null}
      </div>

      <div className="rounded-md border">
        <table className="w-full text-[13px]">
          <thead className="bg-subtle text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr className="border-b">
              <th className="w-24 px-3 py-2 text-left font-medium">ID</th>
              <th className="px-3 py-2 text-left font-medium">Test Case</th>
              <th className="px-3 py-2 text-left font-medium">Type</th>
              <th className="px-3 py-2 text-left font-medium">Mode</th>
              <th className="px-3 py-2 text-left font-medium">Result</th>
              <th className="px-3 py-2 text-right font-medium">Duration</th>
              <th className="px-3 py-2 text-left font-medium">Evidence</th>
              <th className="px-3 py-2 text-left font-medium">Comment</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr
                key={row.testCase.id}
                onClick={() => select(row.testCase.id)}
                className={cn("cursor-pointer border-b last:border-0 hover:bg-zinc-50", selectedId === row.testCase.id && "bg-accent")}
                data-testid="run-row"
                data-case-key={row.testCase.caseKey}
                data-result={statusOf(row)}
              >
                <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{row.testCase.caseKey}</td>
                <td className="max-w-[26rem] px-3 py-2">
                  <div className="truncate font-medium">{row.testCase.title}</div>
                  <div className="truncate text-[11px] text-muted-foreground">{row.sectionPath ?? "Unsectioned"}</div>
                </td>
                <td className="px-3">
                  <TypeBadge type={row.testCase.type} />
                </td>
                <td className="px-3">
                  <ModeBadge mode={row.mode} />
                </td>
                <td className="px-3">
                  <ResultBadge status={statusOf(row)} />
                </td>
                <td className="px-3 text-right tabular-nums">{formatDuration(row.result?.durationMs)}</td>
                <td className="px-3">
                  <EvidenceLinks row={row} />
                </td>
                <td className="max-w-56 truncate px-3 text-xs text-muted-foreground">
                  {row.result?.comment ?? (row.result?.status === "failed" ? row.result.actualResult : null) ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {visible.length === 0 ? <p className="p-6 text-center text-[13px] text-muted-foreground">No cases with this result.</p> : null}
      </div>

      <Sheet open={selected !== null} onOpenChange={(open) => !open && select(null)}>
        <SheetContent className="max-w-3xl" aria-describedby={undefined}>
          {selected ? (
            <ExecutionPanel
              key={selected.testCase.id + (selected.result?.updatedAt ?? "")}
              row={selected}
              runId={runId}
              locked={locked}
              position={rows.findIndex((row) => row.testCase.id === selected.testCase.id) + 1}
              total={rows.length}
              onPrev={() => neighbour(-1)}
              onNext={() => neighbour(1)}
              onRecorded={(status) => {
                router.refresh();
                const next = nextUntested(selected.testCase.id);
                if (next) {
                  toast.success(`${selected.testCase.caseKey} marked ${RESULT_STATUS_LABELS[status]}`);
                  select(next);
                } else {
                  toast.success("All cases in this run have a result.");
                  select(null);
                }
              }}
            />
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function ExecutionPanel({
  row,
  runId,
  locked,
  position,
  total,
  onPrev,
  onNext,
  onRecorded,
}: {
  row: RunRow;
  runId: string;
  locked: boolean;
  position: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  onRecorded: (status: ExecutedResultStatus) => void;
}) {
  const { testCase, result, automationResult } = row;
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<"idle" | "failed" | "blocked">("idle");
  const [comment, setComment] = useState(result?.comment ?? "");
  const [actual, setActual] = useState(result?.actualResult ?? "");
  const [category, setCategory] = useState(result?.failureCategory ?? "");
  const [severity, setSeverity] = useState(result?.severity ?? "");
  const [evidence, setEvidence] = useState({
    screenshotUrl: result?.evidence.screenshotUrl ?? "",
    traceUrl: result?.evidence.traceUrl ?? "",
    logUrl: result?.evidence.logUrl ?? "",
    networkLogUrl: result?.evidence.networkLogUrl ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  // Execution time is tracked automatically from when the case was opened; the tester can override it.
  const startedAt = useRef(0);
  const [elapsed, setElapsed] = useState(0);
  const [manualSeconds, setManualSeconds] = useState<string | null>(null);
  const seconds = manualSeconds ?? String(elapsed);

  useEffect(() => {
    startedAt.current = Date.now();
    const timer = setInterval(() => setElapsed(Math.round((Date.now() - startedAt.current) / 1000)), 1000);
    return () => clearInterval(timer);
  }, []);

  const record = useCallback(
    (status: ResultStatus) =>
      startTransition(async () => {
        const durationSeconds = Number(seconds.trim());
        const response = await recordResultAction({
          testRunId: runId,
          testCaseId: testCase.id,
          status,
          comment,
          actualResult: actual,
          durationMs: Number.isFinite(durationSeconds) && seconds.trim() ? Math.round(durationSeconds * 1000) : null,
          failureCategory: status === "failed" ? category : null,
          severity: status === "failed" ? severity : null,
          evidence,
        });
        if (response.error) {
          setErrors(response.fieldErrors);
          if (status === "failed") setMode("failed");
          if (status === "blocked") setMode("blocked");
          toast.error(response.error);
          return;
        }
        if (status === "untested") {
          toast.success(`${testCase.caseKey} reset to Untested`);
          return;
        }
        onRecorded(status);
      }),
    [runId, testCase.id, testCase.caseKey, comment, actual, category, severity, evidence, seconds, onRecorded],
  );

  const choose = useCallback(
    (status: ExecutedResultStatus) => {
      if (locked || pending) return;
      if (status === "failed" && mode !== "failed") return setMode("failed");
      if (status === "blocked" && mode !== "blocked") return setMode("blocked");
      record(status);
    },
    [locked, pending, mode, record],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || event.metaKey || event.ctrlKey || event.altKey) return;
      const keys: Record<string, () => void> = {
        p: () => choose("passed"),
        f: () => choose("failed"),
        b: () => choose("blocked"),
        s: () => choose("skipped"),
        j: onNext,
        k: onPrev,
      };
      const handler = keys[event.key.toLowerCase()];
      if (handler) {
        event.preventDefault();
        handler();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [choose, onNext, onPrev]);

  return (
    <div className="flex h-full flex-col" data-testid="execution-panel">
      <div className="border-b px-5 py-3 pr-12">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-mono">{testCase.caseKey}</span>
          <span>·</span>
          <span>{row.sectionPath ?? "Unsectioned"}</span>
          <span className="ml-auto tabular-nums">
            {position} / {total}
          </span>
          <Button size="icon-sm" variant="ghost" onClick={onPrev} aria-label="Previous case (K)">
            <ChevronLeft />
          </Button>
          <Button size="icon-sm" variant="ghost" onClick={onNext} aria-label="Next case (J)">
            <ChevronRight />
          </Button>
        </div>
        <SheetTitle className="mt-1 leading-snug">{testCase.title}</SheetTitle>
        <SheetDescription className="sr-only">Execute this test case and record the result.</SheetDescription>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <TypeBadge type={testCase.type} />
          <PriorityLabel priority={testCase.priority} />
          <ModeBadge mode={row.mode} />
          <ResultBadge status={result?.status} />
          {result && result.status !== "untested" ? (
            <span className="text-xs text-muted-foreground">
              by {result.tester ?? "—"} · attempt {result.attempts}
            </span>
          ) : null}
          <Link href={`/cases/${testCase.id}`} className="ml-auto text-xs text-primary hover:underline">
            Open case <ExternalLink className="inline size-3" />
          </Link>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4 text-[13px]">
        <section>
          <h3 className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Preconditions</h3>
          <p>{testCase.preconditions || <span className="text-muted-foreground">None</span>}</p>
        </section>
        <section>
          <h3 className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Steps</h3>
          <ol className="list-decimal space-y-1 pl-5">
            {testCase.steps.map((step, index) => (
              <li key={index}>{step}</li>
            ))}
          </ol>
        </section>
        <section className="rounded-md border border-green-200 bg-green-50/50 p-3">
          <h3 className="mb-1 text-[11px] font-medium uppercase tracking-wide text-green-800">Expected Result</h3>
          <p>{testCase.expectedResult}</p>
        </section>

        {automationResult ? (
          <section className="space-y-2 rounded-md border p-3">
            <div className="flex items-center gap-2">
              <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Latest automation result</h3>
              <ResultBadge status={automationResult.status} />
              <span className="text-xs tabular-nums text-muted-foreground">{formatDuration(automationResult.durationMs)}</span>
              <Link href={`/automation/runs/${automationResult.automationRunId}?result=${automationResult.id}`} className="ml-auto text-xs text-primary hover:underline">
                Automation run →
              </Link>
            </div>
            {automationResult.errorMessage ? (
              <pre className="code-block max-h-48 overflow-auto whitespace-pre-wrap rounded bg-zinc-950 p-3 text-zinc-100">{automationResult.errorMessage}</pre>
            ) : null}
            {automationResult.screenshotUrl ? (
              <a href={automationResult.screenshotUrl} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element -- artifacts are served from storage, not optimized */}
                <img src={automationResult.screenshotUrl} alt={`Screenshot of ${testCase.caseKey} failure`} className="max-h-72 rounded border" />
              </a>
            ) : null}
            <div className="flex flex-wrap gap-3 text-xs">
              {automationResult.traceUrl ? (
                <a href={automationResult.traceUrl} className="text-primary hover:underline" target="_blank" rel="noreferrer">
                  Download trace
                </a>
              ) : null}
              {isPublicHttp(automationResult.traceUrl) ? (
                <a
                  href={`https://trace.playwright.dev/?trace=${encodeURIComponent(automationResult.traceUrl)}`}
                  className="text-primary hover:underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  Open in Trace Viewer
                </a>
              ) : null}
              {automationResult.logUrl ? (
                <a href={automationResult.logUrl} className="text-primary hover:underline" target="_blank" rel="noreferrer">
                  Log
                </a>
              ) : null}
              {automationResult.status === "failed" ? (
                <Link href={`/automation/runs/${automationResult.automationRunId}?result=${automationResult.id}`} className="inline-flex items-center gap-1 text-violet-700 hover:underline">
                  <Sparkles className="size-3" /> Analyze Failure
                </Link>
              ) : null}
            </div>
          </section>
        ) : null}

        {mode !== "idle" ? (
          <section className={cn("space-y-3 rounded-md border p-3", mode === "failed" ? "border-red-200 bg-red-50/40" : "border-orange-200 bg-orange-50/40")}>
            <h3 className="text-[13px] font-semibold">{mode === "failed" ? "Record failure" : "Record blocker"}</h3>
            {mode === "failed" ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Failure Category" htmlFor="failureCategory" required error={errors.failureCategory}>
                    <NativeSelect id="failureCategory" value={category} onChange={(event) => setCategory(event.target.value as typeof category)}>
                      <option value="">Select…</option>
                      {FAILURE_CATEGORIES.map((value) => (
                        <option key={value} value={value}>
                          {FAILURE_CATEGORY_LABELS[value]}
                        </option>
                      ))}
                    </NativeSelect>
                  </Field>
                  <Field label="Severity" htmlFor="severity" required error={errors.severity}>
                    <NativeSelect id="severity" value={severity} onChange={(event) => setSeverity(event.target.value as typeof severity)}>
                      <option value="">Select…</option>
                      {SEVERITIES.map((value) => (
                        <option key={value} value={value}>
                          {SEVERITY_LABELS[value]}
                        </option>
                      ))}
                    </NativeSelect>
                  </Field>
                </div>
                <Field label="Actual Result" htmlFor="actualResult" required error={errors.actualResult}>
                  <Textarea id="actualResult" rows={3} value={actual} onChange={(event) => setActual(event.target.value)} placeholder="What happened instead?" />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  {(
                    [
                      ["screenshotUrl", "Screenshot URL"],
                      ["traceUrl", "Trace URL"],
                      ["logUrl", "Log URL"],
                      ["networkLogUrl", "Network Log URL"],
                    ] as const
                  ).map(([key, label]) => (
                    <Field key={key} label={label} htmlFor={key} error={errors[`evidence.${key}`]}>
                      <Input id={key} type="url" value={evidence[key]} onChange={(event) => setEvidence({ ...evidence, [key]: event.target.value })} placeholder="https://…" />
                    </Field>
                  ))}
                </div>
              </>
            ) : null}
            <Field label={mode === "blocked" ? "What is blocking?" : "Comment"} htmlFor="comment" required={mode === "blocked"} error={errors.comment}>
              <Textarea id="comment" rows={2} value={comment} onChange={(event) => setComment(event.target.value)} />
            </Field>
            <div className="flex gap-2">
              <Button variant={mode === "failed" ? "failed" : "blocked"} disabled={pending || locked} onClick={() => record(mode)} data-testid="confirm-result">
                Save {mode === "failed" ? "failure" : "blocker"}
              </Button>
              <Button variant="ghost" onClick={() => setMode("idle")}>
                Cancel
              </Button>
            </div>
          </section>
        ) : (
          <div className="grid grid-cols-[1fr_120px] gap-3">
            <Field label="Comment (optional)" htmlFor="comment">
              <Input id="comment" value={comment} onChange={(event) => setComment(event.target.value)} />
            </Field>
            <Field label="Duration (s)" htmlFor="duration">
              <div className="relative">
                <Timer className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input id="duration" inputMode="numeric" value={seconds} onChange={(event) => setManualSeconds(event.target.value)} className="pl-7 tabular-nums" />
              </div>
            </Field>
          </div>
        )}
        <FieldError message={errors._} />
      </div>

      <div className="border-t bg-subtle px-5 py-3">
        {locked ? (
          <p className="text-[13px] text-muted-foreground">This run is completed. Reopen it to change results.</p>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="passed" size="xl" disabled={pending} onClick={() => choose("passed")} data-testid="result-pass">
              PASS <kbd className="ml-1 rounded bg-white/20 px-1 text-[10px]">P</kbd>
            </Button>
            <Button variant="failed" size="xl" disabled={pending} onClick={() => choose("failed")} data-testid="result-fail">
              FAIL <kbd className="ml-1 rounded bg-white/20 px-1 text-[10px]">F</kbd>
            </Button>
            <Button variant="blocked" size="xl" disabled={pending} onClick={() => choose("blocked")} data-testid="result-blocked">
              BLOCKED <kbd className="ml-1 rounded bg-white/20 px-1 text-[10px]">B</kbd>
            </Button>
            <Button variant="skipped" size="xl" disabled={pending} onClick={() => choose("skipped")} data-testid="result-skipped">
              SKIPPED <kbd className="ml-1 rounded bg-white/20 px-1 text-[10px]">S</kbd>
            </Button>
            {result && result.status !== "untested" ? (
              <Button variant="ghost" size="sm" className="ml-auto" disabled={pending} onClick={() => record("untested")}>
                <RotateCcw /> Reset
              </Button>
            ) : null}
          </div>
        )}
        {result?.status === "failed" && result.failureCategory ? (
          <div className="mt-2 flex gap-2 text-xs text-muted-foreground">
            <Badge variant="failed">{FAILURE_CATEGORY_LABELS[result.failureCategory]}</Badge>
            {result.severity ? <Badge variant="outline">{SEVERITY_LABELS[result.severity]}</Badge> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
