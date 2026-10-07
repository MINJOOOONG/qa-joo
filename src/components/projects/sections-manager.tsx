"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { FolderTree, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { createSectionAction, deleteSectionAction, renameSectionAction } from "@/app/actions/sections";
import { initialFormState } from "@/app/actions/form-state";
import { useFormSubmit } from "@/hooks/use-form-submit";
import type { SectionNode } from "@/lib/domain/sections";
import { fmt } from "@/lib/i18n/define";
import { useI18n } from "@/lib/i18n/client";

export function SectionsManager({
  projectId,
  nodes,
  caseCounts,
}: {
  projectId: string;
  nodes: SectionNode[];
  caseCounts: Record<string, number>;
}) {
  const [state, action, pending] = useActionState(createSectionAction.bind(null, projectId), initialFormState);
  const formRef = useRef<HTMLFormElement>(null);
  const onSubmit = useFormSubmit(action);
  const [editing, setEditing] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [busy, startTransition] = useTransition();
  const { t } = useI18n();
  const l = t.projects.sections;

  useEffect(() => {
    if (state.success) formRef.current?.reset();
    if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <div className="space-y-3">
      <div className="rounded-md border">
        {nodes.length === 0 ? (
          <p className="p-4 text-[13px] text-muted-foreground">{l.empty}</p>
        ) : (
          <ul className="divide-y">
            {nodes.map((node) => (
              <li key={node.section.id} className="flex items-center gap-2 px-3 py-1.5 text-[13px]" style={{ paddingLeft: 12 + node.depth * 20 }}>
                <FolderTree className="size-3.5 text-muted-foreground" />
                {editing === node.section.id ? (
                  <form
                    className="flex flex-1 items-center gap-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      startTransition(async () => {
                        const result = await renameSectionAction(node.section.id, draftName);
                        if (result.error) toast.error(result.error);
                        else setEditing(null);
                      });
                    }}
                  >
                    <Input value={draftName} onChange={(event) => setDraftName(event.target.value)} className="h-7" autoFocus />
                    <Button size="sm" type="submit" disabled={busy}>
                      {l.save}
                    </Button>
                    <Button size="sm" type="button" variant="ghost" onClick={() => setEditing(null)}>
                      {l.cancel}
                    </Button>
                  </form>
                ) : (
                  <>
                    <span className="flex-1">{node.section.name}</span>
                    <span className="text-xs tabular-nums text-muted-foreground">{fmt(l.caseCount, { count: caseCounts[node.section.id] ?? 0 })}</span>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={fmt(l.rename, { name: node.section.name })}
                      onClick={() => {
                        setEditing(node.section.id);
                        setDraftName(node.section.name);
                      }}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={fmt(l.deleteLabel, { name: node.section.name })}
                      disabled={busy}
                      onClick={() => {
                        if (!confirm(fmt(l.confirmDelete, { name: node.section.name }))) return;
                        startTransition(async () => {
                          const result = await deleteSectionAction(node.section.id);
                          if (result.error) toast.error(result.error);
                        });
                      }}
                    >
                      <Trash2 />
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      <form ref={formRef} onSubmit={onSubmit} className="flex items-center gap-2">
        <Input name="name" placeholder={l.newPlaceholder} className="max-w-64" required aria-label={l.nameLabel} />
        <NativeSelect name="parentId" className="max-w-64" aria-label={l.parentLabel} defaultValue="">
          <option value="">{l.topLevel}</option>
          {nodes.map((node) => (
            <option key={node.section.id} value={node.section.id}>
              {"— ".repeat(node.depth)}
              {node.section.name}
            </option>
          ))}
        </NativeSelect>
        <Button type="submit" variant="outline" disabled={pending}>
          {l.add}
        </Button>
      </form>
    </div>
  );
}
