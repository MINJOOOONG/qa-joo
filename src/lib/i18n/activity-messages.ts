import type { Locale } from "./config";
import { getDictionary } from "./dictionary";

/**
 * Activity entries are stored as English sentences (see lib/services). They are translated when
 * displayed so existing history also reads in the viewer's language. Unknown sentences are shown as-is.
 */
const KEY = "([A-Z][A-Z0-9]{1,9}-TC-\\d+)";

type Rule = [RegExp, (m: string[], locale: Locale) => string];

const RESULT_LABEL: Record<string, string> = {
  Untested: "untested",
  Passed: "passed",
  Failed: "failed",
  Blocked: "blocked",
  Skipped: "skipped",
};

const RULES: Rule[] = [
  [new RegExp(`^Marked ${KEY} (Untested|Passed|Failed|Blocked|Skipped) in (.+)$`), (m, l) =>
    `${m[1]} 결과 ${getDictionary(l).enums.resultStatus[RESULT_LABEL[m[2]] as "passed"]} 기록 · ${m[3]}`],
  [new RegExp(`^Reset ${KEY} in (.+)$`), (m) => `${m[1]} 결과 초기화 · ${m[2]}`],
  [/^Created run (.+) with (\d+) case\(s\)$/, (m) => `테스트 런 ${m[1]} 생성 (케이스 ${m[2]}개)`],
  [/^Completed run (.+)$/, (m) => `테스트 런 ${m[1]} 완료`],
  [/^Reopened run (.+)$/, (m) => `테스트 런 ${m[1]} 다시 열기`],
  [/^Deleted run (.+)$/, (m) => `테스트 런 ${m[1]} 삭제`],
  [/^Added (\d+) case\(s\) to (.+)$/, (m) => `케이스 ${m[1]}개 추가 · ${m[2]}`],
  [/^Created project (.+) \(([A-Z0-9]+)\)$/, (m) => `프로젝트 ${m[1]} (${m[2]}) 생성`],
  [/^Deleted project (.+) \(([A-Z0-9]+)\)$/, (m) => `프로젝트 ${m[1]} (${m[2]}) 삭제`],
  [/^Updated project settings for (.+)$/, (m) => `${m[1]} 프로젝트 설정 변경`],
  [/^Added section (.+)$/, (m) => `섹션 ${m[1]} 추가`],
  [/^Deleted section (.+); (\d+) case\(s\) moved up$/, (m) => `섹션 ${m[1]} 삭제 (케이스 ${m[2]}개를 상위로 이동)`],
  [new RegExp(`^Created ${KEY} (.+)$`), (m) => `${m[1]} ${m[2]} 생성`],
  [new RegExp(`^Edited the Playwright spec for ${KEY}$`), (m) => `${m[1]} Playwright 스펙 수정`],
  [new RegExp(`^Edited ${KEY} (.+)$`), (m) => `${m[1]} ${m[2]} 수정`],
  [new RegExp(`^Deleted ${KEY} (.+)$`), (m) => `${m[1]} ${m[2]} 삭제`],
  [new RegExp(`^Approved AI draft ${KEY} (.+)$`), (m) => `AI 초안 ${m[1]} ${m[2]} 승인`],
  [new RegExp(`^Rejected AI draft ${KEY} (.+)$`), (m) => `AI 초안 ${m[1]} ${m[2]} 반려`],
  [/^Approved (\d+) AI draft test case\(s\)$/, (m) => `AI 초안 테스트 케이스 ${m[1]}개 승인`],
  [new RegExp(`^Approved Playwright automation for ${KEY}; the case is now Automated$`), (m) => `${m[1]} Playwright 자동화 승인 (자동화됨으로 변경)`],
  [new RegExp(`^Rejected the Playwright draft for ${KEY}$`), (m) => `${m[1]} Playwright 초안 반려`],
  [new RegExp(`^Generated a Playwright draft for ${KEY} \\((.+)\\)$`), (m) => `${m[1]} Playwright 초안 생성 (${m[2]})`],
  [/^Queued (\d+) Playwright spec\(s\) on the (\w+) runner(?: for (.+))?$/, (m) =>
    `${m[2]} 러너에 Playwright 스펙 ${m[1]}개 실행 대기${m[3] ? ` (${m[3]})` : ""}`],
  [/^Automation run (\w+): (\d+) passed, (\d+) failed$/, (m, l) =>
    `자동화 실행 ${getDictionary(l).enums.automationRunStatus[m[1] as "passed"] ?? m[1]}: 통과 ${m[2]}개, 실패 ${m[3]}개`],
  [new RegExp(`^Analyzed the ${KEY} failure \\((\\w+), (\\w+) confidence\\)$`), (m, l) => {
    const d = getDictionary(l).enums;
    return `${m[1]} 실패 분석 (${d.failureCategory[m[2] as "ui"] ?? m[2]}, 신뢰도 ${d.confidence[m[3] as "low"] ?? m[3]})`;
  }],
  [new RegExp(`^Added (\\d+) suggested regression case\\(s\\) from the ${KEY} failure as AI drafts$`), (m) =>
    `${m[2]} 실패에서 제안된 회귀 케이스 ${m[1]}개를 AI 초안으로 추가`],
];

export function localizeActivity(message: string, locale: Locale): string {
  if (locale === "en") return message;
  for (const [pattern, render] of RULES) {
    const match = pattern.exec(message);
    if (match) return render(Array.from(match), locale);
  }
  return message;
}
