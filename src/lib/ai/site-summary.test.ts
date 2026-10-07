import { describe, expect, it } from "vitest";
import type { ProjectAnalysis } from "@/lib/analyzer/types";
import { heuristicSiteSummary, josa } from "./site-summary";

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
    expect(summary).toContain('ReviewForge · 사이트 소개 문구: "Creator assistant');
    expect(summary).toContain("주요 화면: Campaign Analysis, Review Generation.");
    expect(summary).toContain("메뉴: Home, Pricing.");
    expect(summary).toContain("Campaign URL 같은 입력칸과 Analyze 같은 버튼으로 기능을 사용해요.");
    expect(summary).not.toMatch(/\(은\)|\(는\)|\(가\)|이에요\.$/);
  });
  it("describes the site in English", () => {
    expect(heuristicSiteSummary("RF", analysis, "en")).toContain("Main screens: Campaign Analysis, Review Generation.");
  });
});

describe("josa", () => {
  it("picks the particle from the final consonant", () => {
    expect(josa("샌드박스", "이에요")).toBe("예요");
    expect(josa("화면", "이에요")).toBe("이에요");
    expect(josa("사과", "은")).toBe("는");
    expect(josa("수박", "은")).toBe("은");
    expect(josa("입력칸", "과")).toBe("과");
    expect(josa("버튼", "으로")).toBe("으로");
    expect(josa("메일", "으로")).toBe("로");
    expect(josa("파이", "으로")).toBe("로");
  });
  it("returns null for non-Hangul endings", () => {
    expect(josa("sandbox", "이에요")).toBeNull();
    expect(josa("Home 2", "으로")).toBeNull();
  });
  it("uses Korean particles for Hangul screen names", () => {
    const korean = {
      ...analysis,
      app: { ...analysis.app!, pages: [{ ...analysis.app!.pages[0], description: null, title: "샌드박스", headings: ["로그인", "대시보드"], navLabels: ["홈", "설정"] }] },
    } as ProjectAnalysis;
    const summary = heuristicSiteSummary("SB", korean, "ko");
    expect(summary).toContain("샌드박스는 이 프로젝트에 연결된 서비스예요.");
    expect(summary).toContain("주요 화면은 로그인, 대시보드예요.");
    expect(summary).toContain("메뉴는 홈, 설정으로 구성돼 있어요.");
  });
});
