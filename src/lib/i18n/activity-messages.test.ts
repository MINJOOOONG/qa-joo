import { describe, expect, it } from "vitest";
import { localizeActivity } from "./activity-messages";

describe("localizeActivity", () => {
  it("translates stored activity sentences into Korean", () => {
    expect(localizeActivity("Marked RF-TC-011 Blocked in ReviewForge Release Regression", "ko")).toBe(
      "RF-TC-011 결과 차단 기록 · ReviewForge Release Regression",
    );
    expect(localizeActivity("Created run Smoke with 12 case(s)", "ko")).toBe("테스트 런 Smoke 생성 (케이스 12개)");
    expect(localizeActivity("Approved AI draft RF-TC-002 Reject URL", "ko")).toBe("AI 초안 RF-TC-002 Reject URL 승인");
  });
  it("translates analysis and section sentences", () => {
    expect(localizeActivity("Analyzed Sandbox; 12 AI draft test case(s) await review", "ko")).toBe(
      "Sandbox 분석 완료 · AI 초안 테스트 케이스 12개 검토 대기",
    );
    expect(localizeActivity("Analyzed Sandbox; added 3 test case(s)", "ko")).toBe("Sandbox 분석 완료 · 테스트 케이스 3개 추가");
    expect(localizeActivity("AI suggested 4 missing regression case(s) for review", "ko")).toBe("AI가 빠진 회귀 케이스 4개를 제안");
    expect(localizeActivity("Deleted section 보안; 2 case(s) moved up", "ko")).toBe("섹션 보안 삭제 (케이스 2개를 상위로 이동)");
    expect(localizeActivity("Analyzed the RF-TC-001 failure (ui, low confidence)", "ko")).toContain("RF-TC-001 실패 분석");
  });
  it("keeps English and unknown sentences unchanged", () => {
    expect(localizeActivity("Completed run Smoke", "en")).toBe("Completed run Smoke");
    expect(localizeActivity("Something else happened", "ko")).toBe("Something else happened");
  });
});
