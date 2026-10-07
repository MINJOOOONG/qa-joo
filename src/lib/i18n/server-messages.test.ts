import { describe, expect, it } from "vitest";
import { localizeFieldErrors, localizeMessage } from "./server-messages";

describe("localizeMessage", () => {
  it("translates exact messages", () => {
    expect(localizeMessage("Project name is required.", "ko")).toBe("프로젝트 이름을 입력하세요.");
    expect(localizeMessage("Please fix the highlighted fields.", "ko")).toBe("표시된 항목을 수정해 주세요.");
    expect(localizeMessage("Sign in to continue.", "ko")).toBe("계속하려면 로그인하세요.");
  });

  it("translates dynamic messages with captured values", () => {
    expect(localizeMessage("Project proj_123 was not found.", "ko")).toBe("프로젝트 proj_123을(를) 찾을 수 없습니다.");
    expect(localizeMessage("Test case was not found.", "ko")).toBe("테스트 케이스을(를) 찾을 수 없습니다.");
    expect(localizeMessage("Project key SHOP is already in use.", "ko")).toBe("프로젝트 키 SHOP은(는) 이미 사용 중입니다.");
    expect(localizeMessage("Automation run is already failed.", "ko")).toBe("자동화 실행이 이미 실패 상태입니다.");
    expect(localizeMessage("SH-TC-001 must be approved before it can be executed.", "ko")).toBe(
      "SH-TC-001은(는) 실행하기 전에 승인되어야 합니다.",
    );
    expect(localizeMessage("Too big: expected string to have <=80 characters", "ko")).toBe("80자 이하로 입력하세요.");
    expect(localizeMessage("GitHub API returned HTTP 503.", "ko")).toBe("GitHub API가 HTTP 503을(를) 반환했습니다.");
  });

  it("translates composite messages part by part", () => {
    expect(localizeMessage("Fix the blocking issues before approving: No test() block found. Dynamic import() is not allowed.", "ko")).toBe(
      "승인하기 전에 차단 문제를 수정하세요: test() 블록이 없습니다. 동적 import()는 사용할 수 없습니다.",
    );
    expect(localizeMessage("Analysis failed: application: Could not reach app.example.com. repository: Repository not found.", "ko")).toBe(
      "분석 실패: 애플리케이션: app.example.com에 연결할 수 없습니다. 저장소: 저장소를 찾을 수 없습니다.",
    );
  });

  it("falls back to the original text for unknown messages", () => {
    expect(localizeMessage("Something nobody translated.", "ko")).toBe("Something nobody translated.");
    expect(localizeMessage("", "ko")).toBe("");
  });

  it("returns English messages unchanged", () => {
    expect(localizeMessage("Project name is required.", "en")).toBe("Project name is required.");
    expect(localizeMessage("Project proj_123 was not found.", "en")).toBe("Project proj_123 was not found.");
  });

  it("translates field error maps", () => {
    expect(localizeFieldErrors({ key: "Key is already in use." }, "ko")).toEqual({ key: "이미 사용 중인 키입니다." });
    expect(localizeFieldErrors({ key: "Key is already in use." }, "en")).toEqual({ key: "Key is already in use." });
  });
});
