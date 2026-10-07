import Link from "next/link";
import { Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EnvironmentBadge } from "@/components/common/badges";
import { RunProgressCell } from "@/components/common/run-progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatPercent } from "@/lib/domain/run-stats";
import type { RunSummary } from "@/lib/services/runs";
import { formatRelative } from "@/lib/i18n/format";
import { defineMessages } from "@/lib/i18n/define";
import { getI18n } from "@/lib/i18n/server";

const extra = defineMessages({
  en: {
    blocked: "Blocked",
    passRateHelp: "Pass rate = passed ÷ (passed + failed + blocked). Untested and skipped cases are not counted.",
  },
  ko: {
    blocked: "차단",
    passRateHelp: "통과율 = 통과 ÷ (통과 + 실패 + 차단). 미실행·건너뜀은 제외해요.",
  },
});

export async function RunsTable({ runs, showProject = true }: { runs: RunSummary[]; showProject?: boolean }) {
  const { t, locale } = await getI18n();
  const m = t.runs.table;
  const x = extra[locale];
  return (
    <div className="min-w-0 max-w-full overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{m.run}</TableHead>
            {showProject ? <TableHead>{m.project}</TableHead> : null}
            <TableHead>{m.environment}</TableHead>
            <TableHead>{m.build}</TableHead>
            <TableHead>{m.progress}</TableHead>
            <TableHead className="text-right">{m.passed}</TableHead>
            <TableHead className="text-right">{m.failed}</TableHead>
            <TableHead className="text-right">{x.blocked}</TableHead>
            <TableHead className="text-right">
              <span className="inline-flex items-center gap-1" title={x.passRateHelp}>
                {m.passRate}
                <Info className="size-3" aria-label={x.passRateHelp} />
              </span>
            </TableHead>
            <TableHead>{m.status}</TableHead>
            <TableHead>{m.updated}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {runs.map(({ run, project, stats }) => (
            <TableRow key={run.id}>
              <TableCell>
                <Link href={`/runs/${run.id}`} className="whitespace-nowrap font-medium hover:underline">
                  {run.name}
                </Link>
              </TableCell>
              {showProject ? (
                <TableCell className="text-xs">
                  {project ? (
                    <Link href={`/projects/${project.key}`} className="hover:underline">
                      <span className="font-mono text-muted-foreground">{project.key}</span> {project.name}
                    </Link>
                  ) : (
                    "—"
                  )}
                </TableCell>
              ) : null}
              <TableCell>
                <EnvironmentBadge environment={run.environment} />
              </TableCell>
              <TableCell className="font-mono text-xs">{run.build ?? "—"}</TableCell>
              <TableCell>
                <RunProgressCell stats={stats} />
              </TableCell>
              <TableCell className="text-right tabular-nums text-passed">{stats.passed}</TableCell>
              <TableCell className="text-right tabular-nums text-failed">{stats.failed}</TableCell>
              <TableCell className="text-right tabular-nums text-blocked">{stats.blocked}</TableCell>
              <TableCell className="text-right tabular-nums">{formatPercent(stats.passRate)}</TableCell>
              <TableCell>
                {run.status === "active" ? <Badge variant="info">{t.enums.testRunStatus.active}</Badge> : <Badge>{t.enums.testRunStatus.completed}</Badge>}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">{formatRelative(run.updatedAt, locale)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
