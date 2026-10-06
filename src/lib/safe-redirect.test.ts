import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "./safe-redirect";

describe("safeRedirectPath", () => {
  it.each([
    ["/dashboard", "/dashboard"],
    ["/cases?project=RF&case=1#x", "/cases?project=RF&case=1#x"],
    ["/projects/RF/review", "/projects/RF/review"],
  ])("keeps same-origin path %s", (input, expected) => {
    expect(safeRedirectPath(input, "/fallback")).toBe(expected);
  });

  it.each(["//evil.com", "/\\evil.com", "/\\/evil.com", "/\t/evil.com", "https://evil.com", "javascript:alert(1)", "", null, 42])(
    "rejects %s",
    (input) => {
      expect(safeRedirectPath(input, "/fallback")).toBe("/fallback");
    },
  );
});
