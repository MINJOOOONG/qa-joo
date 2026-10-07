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
  it("keeps English and unknown sentences unchanged", () => {
    expect(localizeActivity("Completed run Smoke", "en")).toBe("Completed run Smoke");
    expect(localizeActivity("Something else happened", "ko")).toBe("Something else happened");
  });
});
