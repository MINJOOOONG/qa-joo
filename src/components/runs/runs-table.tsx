import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { EnvironmentBadge } from "@/components/common/badges";
import { RunProgressCell } from "@/components/common/run-progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatPercent } from "@/lib/domain/run-stats";
import type { RunSummary } from "@/lib/services/runs";
import { formatRelative } from "@/lib/i18n/format";
import { getI18n } from "@/lib/i18n/server";

export async function RunsTable({ runs, showProject = true }: { runs: RunSummary[]; showProject?: boolean }) {
  const { t, locale } = await getI18n();
  const m = t.runs.table;
  return (
    <div className="rounded-md border">
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
            <TableHead className="text-right">{m.passRate}</TableHead>
            <TableHead>{m.status}</TableHead>
            <TableHead>{m.updated}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {runs.map(({ run, project, stats }) => (
            <TableRow key={run.id}>
              <TableCell>
                <Link href={`/runs/${run.id}`} className="font-medium hover:underline">
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
