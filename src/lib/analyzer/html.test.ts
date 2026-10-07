import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { parsePage } from "./html";

const html = fs.readFileSync(new URL("../../../public/sandbox/index.html", import.meta.url), "utf8");

describe("parsePage", () => {
  const page = parsePage(html, "http://localhost:3000/sandbox/index.html");

  it("reads title, headings and navigation", () => {
    expect(page.title).toBe("Sandbox Campaign Checker");
    expect(page.headings).toContain("Check a campaign brief");
    expect(page.navLabels).toEqual(["Checker", "About"]);
    expect(page.internalLinks).toEqual(["/sandbox/index.html", "/sandbox/about.html"]);
    expect(page.links).toEqual([
      { label: "Checker", path: "/sandbox/index.html" },
      { label: "About", path: "/sandbox/about.html" },
    ]);
    expect(page.resultHeadings).toEqual(["Campaign requirements"]);
  });

  it("extracts form fields with labels and constraints", () => {
    const [form] = page.forms;
    expect(form.name).toBe("Campaign analysis");
    expect(form.submitLabels).toEqual(["Analyze"]);
    expect(form.fields.map((f) => [f.label, f.type, f.required])).toEqual([
      ["Campaign URL", "url", true],
      ["Required keywords", "textarea", false],
      ["Photo count", "number", false],
    ]);
    expect(form.fields[1].constraints).toContain("maxlength=300");
    expect(form.fields[2].constraints).toEqual(expect.arrayContaining(["min=1", "max=20"]));
  });

  it("detects inputs outside forms and client-rendered shells", () => {
    const spa = parsePage('<html><body><div id="root"></div><input aria-label="Search" type="search"></body></html>', "https://x.dev/");
    expect(spa.looseFields).toEqual([expect.objectContaining({ label: "Search", type: "search" })]);
    expect(spa.clientRendered).toBe(true);
  });
});
