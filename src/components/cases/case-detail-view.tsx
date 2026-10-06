import Link from "next/link";
import { Bot } from "lucide-react";
import { AiBadge, AutomationBadge, EnvironmentBadge, ModeBadge, PriorityLabel, ResultBadge, TypeBadge } from "@/components/common/badges";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDuration } from "@/lib/domain/run-stats";
import type { CaseDetail } from "@/lib/services/cases";
import { formatDateTime } from "@/lib/utils";
import { CaseActions, type RunOption } from "./case-actions";
import { ReviewButtons } from "./review-buttons";

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1">
      <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</h3>
      <div className="text-[13px] leading-relaxed">{children}</div>
    </section>
  );
}

export function CaseDetailView({
  detail,
  activeRuns,
  returnTo,
}: {
  detail: CaseDetail;
  activeRuns: RunOption[];
  returnTo: string;
}) {
  const { testCase, project, sectionPath, history, automation } = detail;
  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="font-mono">{testCase.caseKey}</span>
          <span>·</span>
          <Link href={`/projects/${project.key}`} className="hover:underline">
            {project.name}
          </Link>
          {sectionPath ? (
            <>
              <span>·</span>
              <span>{sectionPath}</span>
            </>
          ) : null}
        </div>
        <h2 className="text-base font-semibold leading-snug">{testCase.title}</h2>
        <div className="flex flex-wrap items-center gap-1.5">
          <TypeBadge type={testCase.type} />
          <PriorityLabel priority={testCase.priority} />
          <AutomationBadge status={testCase.automationStatus} />
          <ResultBadge status={testCase.lastResult} />
          {testCase.source === "ai_generated" ? <AiBadge /> : null}
          {testCase.reviewStatus === "draft" ? <Badge variant="warning">AI Draft · needs review</Badge> : null}
          {testCase.reviewStatus === "rejected" ? <Badge variant="skipped">Rejected</Badge> : null}
        </div>
        {testCase.reviewStatus === "draft" ? <ReviewButtons caseId={testCase.id} /> : null}
        <CaseActions
          caseId={testCase.id}
          projectId={project.id}
          caseKey={testCase.caseKey}
          isApproved={testCase.reviewStatus === "approved"}
          activeRuns={activeRuns}
          automationTestId={automation?.id ?? null}
          returnTo={returnTo}
        />
      </header>

      {testCase.description ? <Block label="Description">{testCase.description}</Block> : null}
      <Block label="Preconditions">{testCase.preconditions || <span className="text-muted-foreground">None</span>}</Block>
      <Block label="Steps">
        <ol className="list-decimal space-y-1 pl-5">
          {testCase.steps.map((step, index) => (
            <li key={index}>{step}</li>
          ))}
        </ol>
      </Block>
      <Block label="Expected Result">{testCase.expectedResult}</Block>
      <div className="grid grid-cols-2 gap-4">
        <Block label="Tags">
          {testCase.tags.length ? (
            <div className="flex flex-wrap gap-1">
              {testCase.tags.map((tag) => (
                <Badge key={tag} variant="outline">
                  {tag}
                </Badge>
              ))}
            </div>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </Block>
        <Block label="Automation Status">
          <div className="flex items-center gap-2">
            <AutomationBadge status={testCase.automationStatus} />
            {automation ? (
              <Link href={`/automation/tests/${automation.id}`} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                <Bot className="size-3" /> {automation.filePath} ({automation.status})
              </Link>
            ) : null}
          </div>
        </Block>
      </div>
      {testCase.aiRationale ? (
        <div className="rounded-md border border-violet-200 bg-violet-50/50 p-3 text-[13px]">
          <div className="mb-1">
            <AiBadge label="AI SUGGESTION" />
          </div>
          <p className="text-zinc-700">Why this case: {testCase.aiRationale}</p>
        </div>
      ) : null}

      <Block label="Execution History">
        {history.length === 0 ? (
          <span className="text-muted-foreground">Not part of any test run yet.</span>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Run</TableHead>
                  <TableHead>Env</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Tester</TableHead>
                  <TableHead>When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map(({ run, result }) => (
                  <TableRow key={run.id}>
                    <TableCell>
                      <Link href={`/runs/${run.id}?case=${testCase.id}`} className="hover:underline">
                        {run.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <EnvironmentBadge environment={run.environment} />
                    </TableCell>
                    <TableCell>
                      <ResultBadge status={result?.status} />
                    </TableCell>
                    <TableCell>{result ? <ModeBadge mode={result.mode} /> : "—"}</TableCell>
                    <TableCell className="tabular-nums">{formatDuration(result?.durationMs)}</TableCell>
                    <TableCell className="text-xs">{result?.tester ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDateTime(result?.executedAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Block>
    </div>
  );
}
