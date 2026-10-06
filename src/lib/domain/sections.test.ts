import { describe, expect, it } from "vitest";
import type { Section } from "./types";
import { flattenSections, sectionPaths, sectionSubtree } from "./sections";

const section = (id: string, name: string, parentId: string | null, sortOrder = 0): Section => ({
  id,
  name,
  parentId,
  sortOrder,
  projectId: "p",
  createdAt: "",
});

const tree = [
  section("b", "Review Generation", null, 2),
  section("a", "Campaign Analysis", null, 1),
  section("a2", "Negative Cases", "a", 2),
  section("a1", "Happy Path", "a", 1),
  section("a2x", "URL", "a2", 1),
];

describe("sections", () => {
  it("flattens depth-first in sort order with paths", () => {
    expect(flattenSections(tree).map((node) => [node.section.id, node.depth, node.path])).toEqual([
      ["a", 0, "Campaign Analysis"],
      ["a1", 1, "Campaign Analysis / Happy Path"],
      ["a2", 1, "Campaign Analysis / Negative Cases"],
      ["a2x", 2, "Campaign Analysis / Negative Cases / URL"],
      ["b", 0, "Review Generation"],
    ]);
  });

  it("collects subtrees", () => {
    expect(Array.from(sectionSubtree(tree, "a")).sort()).toEqual(["a", "a1", "a2", "a2x"]);
    expect(sectionPaths(tree).get("a2x")).toBe("Campaign Analysis / Negative Cases / URL");
  });

  it("survives cycles and orphans", () => {
    const corrupt = [section("x", "X", "y"), section("y", "Y", "x"), section("z", "Z", "missing")];
    expect(flattenSections(corrupt).map((n) => n.section.id)).toEqual(["z"]);
  });
});
