import { describe, expect, it } from "vitest";
import { caseKeyNumber, formatCaseKey, highestCaseNumber, nextCaseKey, slugify } from "./case-key";

describe("case keys", () => {
  it("formats zero-padded keys", () => {
    expect(formatCaseKey("RF", 1)).toBe("RF-TC-001");
    expect(formatCaseKey("RF", 1234)).toBe("RF-TC-1234");
  });

  it("continues after the highest key and never reuses gaps", () => {
    expect(nextCaseKey("RF", highestCaseNumber([]))).toBe("RF-TC-001");
    expect(nextCaseKey("RF", highestCaseNumber(["RF-TC-001", "RF-TC-007", "RF-TC-003"]))).toBe("RF-TC-008");
    expect(nextCaseKey("RF", highestCaseNumber(["garbage"]))).toBe("RF-TC-001");
    expect(nextCaseKey("RF", 1000)).toBe("RF-TC-1001");
  });

  it("parses the numeric part for sorting", () => {
    expect(caseKeyNumber("RF-TC-010")).toBe(10);
    expect(caseKeyNumber("nope")).toBe(Number.MAX_SAFE_INTEGER);
  });

  it("slugifies project names for spec paths", () => {
    expect(slugify("ReviewForge")).toBe("reviewforge");
    expect(slugify("Sandbox Checker!!")).toBe("sandbox-checker");
    expect(slugify("***")).toBe("project");
  });
});
