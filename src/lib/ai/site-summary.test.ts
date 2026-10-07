import { describe, expect, it } from "vitest";
import type { ProjectAnalysis } from "@/lib/analyzer/types";
import { heuristicSiteSummary } from "./site-summary";

const analysis = {
  app: {
    baseUrl: "https://example.com",
    mode: "http",
    warnings: [],
    pages: [
      {
        url: "https://example.com/",
        path: "/",
        title: "ReviewForge",
        description: "Creator assistant that reads a campaign brief and writes the application.",
        headings: ["Campaign Analysis", "Review Generation"],
        internalLinks: [],
        navLabels: ["Home", "Pricing"],
        buttons: ["Analyze"],
        forms: [{ action: null, method: "get", fields: [{ tag: "input", type: "url", name: "url", label: "Campaign URL", placeholder: null, required: true, constraints: [] }], submitLabels: ["Analyze"] }],
        looseFields: [],
        textSample: "",
        clientRendered: false,
      },
    ],
  },
  repo: null,
  errors: [],
} as unknown as ProjectAnalysis;

describe("heuristicSiteSummary", () => {
  it("describes the site in Korean by default", () => {
    const summary = heuristicSiteSummary("RF", analysis, "ko");
    expect(summary).toContain("ReviewForge: Creator assistant");
    expect(summary).toContain("주요 화면은 Campaign Analysis, Review Generation이에요.");
    expect(summary).toContain("Campaign URL 같은 입력칸");
  });
  it("describes the site in English", () => {
    expect(heuristicSiteSummary("RF", analysis, "en")).toContain("Main screens: Campaign Analysis, Review Generation.");
  });
});
