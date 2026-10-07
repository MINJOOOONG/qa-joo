"use client";

import { useMemo, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, FieldError, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { PriorityLabel, TypeBadge, AutomationBadge } from "@/components/common/badges";
import { createRunAction } from "@/app/actions/runs";
import {
  AUTOMATION_STATUSES,
  CASE_TYPES,
  ENVIRONMENTS,
  PRIORITIES,
  type AutomationStatus,
  type CaseType,
  type Environment,
  type Priority,
} from "@/lib/domain/constants";
import { sectionSubtree } from "@/lib/domain/sections";
import type { Section } from "@/lib/domain/types";
import { cn } from "@/lib/utils";
import { fmt } from "@/lib/i18n/define";
import { useI18n } from "@/lib/i18n/client";

export interface CaseLite {
  id: string;
  caseKey: string;
  title: string;
  sectionId: string | null;
  sectionPath: string | null;
  type: CaseType;
  priority: Priority;
  automationStatus: AutomationStatus;
}

type Mode = "all" | "filter" | "manual";

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-md border px-2 py-0.5 text-xs transition-colors",
        active ? "border-primary bg-accent text-accent-foreground" : "border-border text-zinc-600 hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

export function CreateRunForm({
  projects,
  projectId,
  defaultEnvironment,
  sections,
  cases,
  preselected,
}: {
  projects: Array<{ id: string; key: string; name: string }>;
  projectId: string;
  defaultEnvironment: Environment;
  sections: Array<{ section: Section; depth: number }>;
  cases: CaseLite[];
  preselected: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useI18n();
  const m = t.runs.create;
  const project = projects.find((p) => p.id === projectId)!;
  const [name, setName] = useState(fmt(m.defaultName, { project: project.name }));
  const [environment, setEnvironment] = useState<Environment>(defaultEnvironment);
  const [build, setBuild] = useState("");
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState<Mode>(preselected.length ? "manual" : "all");
  const [sectionIds, setSectionIds] = useState<string[]>([]);
  const [types, setTypes] = useState<CaseType[]>([]);
  const [priorities, setPriorities] = useState<Priority[]>([]);
  const [automation, setAutomation] = useState<AutomationStatus[]>([]);
  const [manual, setManual] = useState<string[]>(preselected);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const matching = useMemo(() => {
    if (mode === "all") return cases;
    if (mode === "manual") return cases.filter((c) => manual.includes(c.id));
    const allSections = sections.map((node) => node.section);
    const subtree = new Set<string>();
    for (const id of sectionIds) for (const child of sectionSubtree(allSections, id)) subtree.add(child);
    return cases.filter(
      (c) =>
        (sectionIds.length === 0 || (c.sectionId !== null && subtree.has(c.sectionId))) &&
        (types.length === 0 || types.includes(c.type)) &&
        (priorities.length === 0 || priorities.includes(c.priority)) &&
        (automation.length === 0 || automation.includes(c.automationStatus)),
    );
  }, [mode, cases, manual, sections, sectionIds, types, priorities, automation]);

  const submit = () =>
    startTransition(async () => {
      const selection =
        mode === "all"
          ? { mode }
          : mode === "manual"
            ? { mode, caseIds: manual }
            : { mode, sectionIds, types, priorities, automationStatuses: automation };
      const result = await createRunAction({ projectId, name, environment, build, description, selection });
      if (result?.error) {
        setError(result.error);
        setErrors(result.fieldErrors);
      }
    });

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <div className="flex flex-col gap-4">
        <Field label={m.runName} htmlFor="name" required error={errors.name}>
          <Input id="name" value={name} onChange={(event) => {
              setName(event.target.value);
              if (errors.name) setErrors((current) => ({ ...current, name: "" }));
              setError(null);
            }} aria-invalid={Boolean(errors.name)} />
        </Field>
        <Field label={m.project} htmlFor="project">
          <NativeSelect id="project" value={projectId} onChange={(event) => router.replace(`${pathname}?project=${event.target.value}`)}>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.key} · {p.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={m.environment} htmlFor="environment" required>
            <NativeSelect id="environment" value={environment} onChange={(event) => setEnvironment(event.target.value as Environment)}>
              {ENVIRONMENTS.map((env) => (
                <option key={env} value={env}>
                  {t.enums.environment[env]}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label={m.build} htmlFor="build" error={errors.build}>
            <Input id="build" value={build} onChange={(event) => setBuild(event.target.value)} placeholder="v0.8.2" className="font-mono" />
          </Field>
        </div>
        <Field label={m.description} htmlFor="description">
          <Textarea id="description" rows={3} value={description} onChange={(event) => setDescription(event.target.value)} />
        </Field>
        <FieldError message={error} />
        <div>
          <Button onClick={submit} disabled={pending || matching.length === 0} size="lg" data-testid="create-run-submit">
            {pending ? m.creating : fmt(m.submit, { count: matching.length })}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-md border p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[13px] font-semibold">{m.selection}</h2>
          <span className="text-xs tabular-nums text-muted-foreground" data-testid="selection-count">
            {fmt(m.selectionCount, { matching: matching.length, total: cases.length })}
          </span>
        </div>
        <div className="flex gap-1" role="radiogroup" aria-label={m.selectionMode}>
          {(
            [
              ["all", m.modeAll],
              ["filter", m.modeFilter],
              ["manual", m.modeManual],
            ] as const
          ).map(([value, label]) => (
            <Chip key={value} active={mode === value} onClick={() => setMode(value)}>
              {label}
            </Chip>
          ))}
        </div>

        {mode === "filter" ? (
          <div className="space-y-3 text-[13px]">
            {sections.length ? (
              <div className="space-y-1">
                <div className="text-xs font-medium text-muted-foreground">{m.sections}</div>
                <div className="flex flex-wrap gap-1">
                  {sections.map((node) => (
                    <Chip key={node.section.id} active={sectionIds.includes(node.section.id)} onClick={() => setSectionIds(toggle(sectionIds, node.section.id))}>
                      {node.depth ? "↳ " : ""}
                      {node.section.name}
                    </Chip>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="space-y-1">
              <div className="text-xs font-medium text-muted-foreground">{m.type}</div>
              <div className="flex flex-wrap gap-1">
                {CASE_TYPES.filter((type) => types.includes(type) || cases.some((c) => c.type === type)).map((type) => (
                  <Chip key={type} active={types.includes(type)} onClick={() => setTypes(toggle(types, type))}>
                    {t.enums.caseType[type]} ({cases.filter((c) => c.type === type).length})
                  </Chip>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-xs font-medium text-muted-foreground">{m.priority}</div>
              <div className="flex flex-wrap gap-1">
                {PRIORITIES.map((priority) => (
                  <Chip key={priority} active={priorities.includes(priority)} onClick={() => setPriorities(toggle(priorities, priority))}>
                    {t.enums.priority[priority]}
                  </Chip>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-xs font-medium text-muted-foreground">{m.automationStatus}</div>
              <div className="flex flex-wrap gap-1">
                {AUTOMATION_STATUSES.map((status) => (
                  <Chip key={status} active={automation.includes(status)} onClick={() => setAutomation(toggle(automation, status))}>
                    {t.enums.automationStatus[status]}
                  </Chip>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        <div className="max-h-[28rem] overflow-y-auto rounded border">
          <table className="w-full text-[13px]">
            <tbody>
              {(mode === "manual" ? cases : matching).map((c) => (
                <tr
                  key={c.id}
                  className={cn("border-b last:border-0", mode === "manual" && "cursor-pointer hover:bg-muted/50")}
                  onClick={
                    mode === "manual"
                      ? (event) => {
                          if ((event.target as HTMLElement).closest("input")) return;
                          setManual(toggle(manual, c.id));
                        }
                      : undefined
                  }
                >
                  {mode === "manual" ? (
                    <td className="w-8 px-2 py-1.5">
                      <input type="checkbox" aria-label={fmt(m.include, { key: c.caseKey })} checked={manual.includes(c.id)} onChange={() => setManual(toggle(manual, c.id))} />
                    </td>
                  ) : null}
                  <td className="w-24 px-2 font-mono text-xs text-muted-foreground">{c.caseKey}</td>
                  <td className="px-2 py-1.5">
                    <div className="truncate">{c.title}</div>
                    <div className="truncate text-[11px] text-muted-foreground">{c.sectionPath ?? m.unsectioned}</div>
                  </td>
                  <td className="px-2">
                    <TypeBadge type={c.type} />
                  </td>
                  <td className="px-2">
                    <PriorityLabel priority={c.priority} />
                  </td>
                  <td className="px-2">
                    <AutomationBadge status={c.automationStatus} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {cases.length === 0 ? <p className="p-4 text-center text-[13px] text-muted-foreground">{m.noCases}</p> : null}
        </div>
        <FieldError message={errors.selection ?? errors["selection.caseIds"]} />
      </div>
    </div>
  );
}
