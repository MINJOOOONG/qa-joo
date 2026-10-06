import type { Section } from "./types";

export interface SectionNode {
  section: Section;
  depth: number;
  /** "Parent / Child" display path */
  path: string;
}

/** Depth-first flattening of the section tree, siblings ordered by sortOrder then name. */
export function flattenSections(sections: Section[]): SectionNode[] {
  const children = new Map<string | null, Section[]>();
  const ids = new Set(sections.map((s) => s.id));
  for (const section of sections) {
    // Orphans (parent deleted or in another project) are treated as roots.
    const parent = section.parentId && ids.has(section.parentId) ? section.parentId : null;
    const list = children.get(parent) ?? [];
    list.push(section);
    children.set(parent, list);
  }
  for (const list of children.values()) {
    list.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  }
  const result: SectionNode[] = [];
  const visited = new Set<string>();
  const walk = (parentId: string | null, depth: number, prefix: string) => {
    for (const section of children.get(parentId) ?? []) {
      if (visited.has(section.id)) continue; // defensive: never loop on corrupt data
      visited.add(section.id);
      const path = prefix ? `${prefix} / ${section.name}` : section.name;
      result.push({ section, depth, path });
      walk(section.id, depth + 1, path);
    }
  };
  walk(null, 0, "");
  return result;
}

export function sectionPaths(sections: Section[]): Map<string, string> {
  return new Map(flattenSections(sections).map((node) => [node.section.id, node.path]));
}

/** All descendant ids of a section, including itself. */
export function sectionSubtree(sections: Section[], rootId: string): Set<string> {
  const result = new Set<string>([rootId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const section of sections) {
      if (section.parentId && result.has(section.parentId) && !result.has(section.id)) {
        result.add(section.id);
        grew = true;
      }
    }
  }
  return result;
}
