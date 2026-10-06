"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { FolderTree, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { createSectionAction, deleteSectionAction, renameSectionAction } from "@/app/actions/sections";
import { initialFormState } from "@/app/actions/form-state";
import type { SectionNode } from "@/lib/domain/sections";

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
  const [editing, setEditing] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [busy, startTransition] = useTransition();

  useEffect(() => {
    if (state.success) formRef.current?.reset();
    if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <div className="space-y-3">
      <div className="rounded-md border">
        {nodes.length === 0 ? (
          <p className="p-4 text-[13px] text-muted-foreground">No sections yet. Cases without a section appear under “Unsectioned”.</p>
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
                      Save
                    </Button>
                    <Button size="sm" type="button" variant="ghost" onClick={() => setEditing(null)}>
                      Cancel
                    </Button>
                  </form>
                ) : (
                  <>
                    <span className="flex-1">{node.section.name}</span>
                    <span className="text-xs tabular-nums text-muted-foreground">{caseCounts[node.section.id] ?? 0} cases</span>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Rename ${node.section.name}`}
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
                      aria-label={`Delete ${node.section.name}`}
                      disabled={busy}
                      onClick={() => {
                        if (!confirm(`Delete section "${node.section.name}"? Its cases and sub-sections move up one level.`)) return;
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
      <form ref={formRef} action={action} className="flex items-center gap-2">
        <Input name="name" placeholder="New section name" className="max-w-64" required aria-label="Section name" />
        <NativeSelect name="parentId" className="max-w-64" aria-label="Parent section" defaultValue="">
          <option value="">Top level</option>
          {nodes.map((node) => (
            <option key={node.section.id} value={node.section.id}>
              {"— ".repeat(node.depth)}
              {node.section.name}
            </option>
          ))}
        </NativeSelect>
        <Button type="submit" variant="outline" disabled={pending}>
          Add section
        </Button>
      </form>
    </div>
  );
}
