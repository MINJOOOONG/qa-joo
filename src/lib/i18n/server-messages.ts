import type { Locale } from "./config";

/**
 * Translates user-visible server messages (AppError messages, Zod validation messages, field
 * errors) from their English source text into the UI language. The English strings stay the
 * single source of truth in services and schemas (tests assert them); this module only maps them
 * at the edge (formError / API error responses). Unknown messages fall back to the original text.
 */

/** Exact English → Korean messages. */
const EXACT: Record<string, string> = {
  // Generic / forms
  "Please fix the highlighted fields.": "표시된 항목을 수정해 주세요.",
  "Request validation failed.": "요청 값이 올바르지 않습니다.",
  "Unexpected server error.": "예기치 않은 서버 오류가 발생했습니다.",
  "Unexpected error. Check the server logs for details.": "예기치 않은 오류가 발생했습니다. 자세한 내용은 서버 로그를 확인하세요.",
  "Validation failed.": "검증에 실패했습니다.",
  "Invalid input.": "입력값이 올바르지 않습니다.",
  "Invalid input": "입력값이 올바르지 않습니다.",
  "Invalid email address": "올바른 이메일 주소가 아닙니다.",
  "Request body is too large.": "요청 본문이 너무 큽니다.",
  "Request body must be a JSON object.": "요청 본문은 JSON 객체여야 합니다.",
  "Request body must be JSON.": "요청 본문은 JSON이어야 합니다.",

  // Auth
  "Supabase Auth is not configured.": "Supabase 인증이 설정되어 있지 않습니다.",
  "Sign in to continue.": "계속하려면 로그인하세요.",
  "Enter a valid email.": "올바른 이메일을 입력하세요.",
  "Enter your password.": "비밀번호를 입력하세요.",
  "Invalid email or password.": "이메일 또는 비밀번호가 올바르지 않습니다.",

  // Schemas (src/lib/domain/schemas.ts)
  "URL is too long.": "URL이 너무 깁니다.",
  "Enter a valid http(s) URL.": "올바른 http(s) URL을 입력하세요.",
  "Use a GitHub repository URL like https://github.com/owner/repo.":
    "https://github.com/owner/repo 형식의 GitHub 저장소 URL을 입력하세요.",
  "Evidence must be an http(s) URL.": "증거 링크는 http(s) URL이어야 합니다.",
  "Key must be 2-10 characters: letters and digits, starting with a letter.":
    "키는 영문자로 시작하는 2~10자의 영문자와 숫자여야 합니다.",
  "Project name is required.": "프로젝트 이름을 입력하세요.",
  "Add an Application URL or a Repository URL so QA JOO has something to analyze.":
    "QA JOO가 분석할 수 있도록 애플리케이션 URL 또는 저장소 URL을 추가하세요.",
  "Section name is required.": "섹션 이름을 입력하세요.",
  "Add at least one step.": "단계를 하나 이상 추가하세요.",
  "A test case can have at most 50 steps.": "테스트 케이스의 단계는 최대 50개입니다.",
  "Tags may contain letters, digits, '-' and '_'.": "태그에는 영문자, 숫자, '-', '_'만 사용할 수 있습니다.",
  "Title is required.": "제목을 입력하세요.",
  "Expected result is required.": "기대 결과를 입력하세요.",
  "Select at least one test case.": "테스트 케이스를 하나 이상 선택하세요.",
  "Select a project.": "프로젝트를 선택하세요.",
  "Run name is required.": "실행 이름을 입력하세요.",
  "Failure category is required.": "실패 유형을 선택하세요.",
  "Severity is required.": "심각도를 선택하세요.",
  "Describe the actual result.": "실제 결과를 입력하세요.",
  "Explain what is blocking this test.": "이 테스트를 막고 있는 원인을 설명하세요.",
  "commitSha must be a git SHA.": "commitSha는 git SHA여야 합니다.",

  // Projects
  "A project needs an Application URL or a Repository URL.": "프로젝트에는 애플리케이션 URL 또는 저장소 URL이 필요합니다.",
  "Add an Application URL or a Repository URL.": "애플리케이션 URL 또는 저장소 URL을 추가하세요.",
  "Key is already in use.": "이미 사용 중인 키입니다.",
  "Key does not match.": "키가 일치하지 않습니다.",

  // Sections
  "Parent section must belong to the same project.": "상위 섹션은 같은 프로젝트에 속해야 합니다.",
  "Section name must be 1-120 characters.": "섹션 이름은 1~120자여야 합니다.",

  // Cases
  "Section does not belong to this project.": "섹션이 이 프로젝트에 속하지 않습니다.",
  "Invalid section.": "올바르지 않은 섹션입니다.",
  "Only AI-generated cases start as drafts.": "AI가 생성한 케이스만 초안으로 시작합니다.",
  "Could not allocate a case key. Try again.": "케이스 키를 할당하지 못했습니다. 다시 시도하세요.",
  "A case becomes Automated only after its Playwright draft is approved.":
    "Playwright 초안이 승인된 후에만 케이스가 자동화됨 상태가 됩니다.",
  "Approve an automation draft first.": "먼저 자동화 초안을 승인하세요.",

  // Runs / results
  "The selection matched no approved test cases.": "선택 조건에 맞는 승인된 테스트 케이스가 없습니다.",
  "No approved test cases match this selection.": "이 선택 조건에 맞는 승인된 테스트 케이스가 없습니다.",
  "Reopen the run before adding cases.": "케이스를 추가하려면 먼저 실행을 다시 여세요.",
  "Every case must belong to the run's project.": "모든 케이스는 실행과 같은 프로젝트에 속해야 합니다.",
  "This test case is not part of the run.": "이 테스트 케이스는 이 실행에 포함되어 있지 않습니다.",
  "This run is completed. Reopen it to change results.": "완료된 실행입니다. 결과를 변경하려면 다시 여세요.",
  "This case has no result to reset.": "초기화할 결과가 없습니다.",
  "A tester recorded a manual result after this automation run started; keeping the manual verdict.":
    "자동화 실행이 시작된 후 테스터가 수동 결과를 기록했으므로 수동 판정을 유지합니다.",
  "Result was modified concurrently. Try again.": "결과가 동시에 수정되었습니다. 다시 시도하세요.",

  // Analysis
  "Connect an Application URL or a Repository URL before analyzing.":
    "분석하기 전에 애플리케이션 URL 또는 저장소 URL을 연결하세요.",
  "Repository not found.": "저장소를 찾을 수 없습니다.",
  "GitHub API rate limit reached. Set GITHUB_TOKEN to raise the limit.":
    "GitHub API 요청 한도에 도달했습니다. 한도를 늘리려면 GITHUB_TOKEN을 설정하세요.",
  "Repository not found or not public. QA JOO only reads public repositories and never accesses private ones.":
    "저장소를 찾을 수 없거나 공개 저장소가 아닙니다. QA JOO는 공개 저장소만 읽으며 비공개 저장소에는 접근하지 않습니다.",
  "This repository is private. QA JOO only analyzes public repositories.":
    "비공개 저장소입니다. QA JOO는 공개 저장소만 분석합니다.",
  "Failed": "실패",

  // URL guard
  "Only http and https URLs are supported.": "http와 https URL만 지원합니다.",
  "URLs with embedded credentials are not allowed.": "자격 증명이 포함된 URL은 사용할 수 없습니다.",
  "Local and internal hostnames cannot be analyzed.": "로컬 및 내부 호스트 이름은 분석할 수 없습니다.",
  "Private, loopback and reserved IP addresses cannot be analyzed.": "사설, 루프백, 예약 IP 주소는 분석할 수 없습니다.",
  "Only standard web ports (80, 443, 8080, 8443) are allowed.": "표준 웹 포트(80, 443, 8080, 8443)만 허용됩니다.",

  // AI providers
  "The AI request timed out.": "AI 요청 시간이 초과되었습니다.",
  "Could not reach the OpenAI API.": "OpenAI API에 연결할 수 없습니다.",
  "OPENAI_API_KEY was rejected by the OpenAI API.": "OpenAI API가 OPENAI_API_KEY를 거부했습니다.",
  "OpenAI rate limit reached. Try again in a minute.": "OpenAI 요청 한도에 도달했습니다. 1분 후 다시 시도하세요.",
  "The AI provider declined this request.": "AI 제공자가 이 요청을 거절했습니다.",
  "The AI response was cut off.": "AI 응답이 중간에 끊겼습니다.",
  "The AI response was cut off. Try generating fewer items.": "AI 응답이 중간에 끊겼습니다. 생성할 항목 수를 줄여 보세요.",
  "The AI response did not match the expected format.": "AI 응답이 예상한 형식과 맞지 않습니다.",
  "ANTHROPIC_API_KEY was rejected by the Anthropic API.": "Anthropic API가 ANTHROPIC_API_KEY를 거부했습니다.",
  "Anthropic rate limit reached. Try again in a minute.": "Anthropic 요청 한도에 도달했습니다. 1분 후 다시 시도하세요.",
  "The AI request timed out. Try again or reduce the number of cases.":
    "AI 요청 시간이 초과되었습니다. 다시 시도하거나 케이스 수를 줄여 보세요.",
  "Anthropic API error.": "Anthropic API 오류가 발생했습니다.",

  // Automation
  "Approve the test case before generating automation.": "자동화를 생성하기 전에 테스트 케이스를 승인하세요.",
  "This case already has approved automation. Edit it instead of regenerating.":
    "이 케이스에는 이미 승인된 자동화가 있습니다. 다시 생성하지 말고 수정하세요.",
  "The spec is larger than 50 KB.": "스펙이 50KB보다 큽니다.",
  "Invalid spec file path.": "올바르지 않은 스펙 파일 경로입니다.",
  "Reopen the test run before running automation.": "자동화를 실행하기 전에 테스트 실행을 다시 여세요.",
  "No approved Playwright specs in scope. Generate and approve automation first.":
    "범위 안에 승인된 Playwright 스펙이 없습니다. 먼저 자동화를 생성하고 승인하세요.",
  "Set the project's Application URL (or pass targetUrl) to run automation.":
    "자동화를 실행하려면 프로젝트의 애플리케이션 URL을 설정하세요(또는 targetUrl을 전달하세요).",
  "Only queued or running automation runs can be cancelled.": "대기 중이거나 실행 중인 자동화 실행만 취소할 수 있습니다.",
  "Only failed results can be analyzed.": "실패한 결과만 분석할 수 있습니다.",
  "Analyze the failure first.": "먼저 실패를 분석하세요.",
  "This test case already has an automation test.": "이 테스트 케이스에는 이미 자동화 테스트가 있습니다.",
  "RUNNER_CALLBACK_SECRET is not configured on this server.": "이 서버에 RUNNER_CALLBACK_SECRET이 설정되어 있지 않습니다.",
  "Set RUNNER_CALLBACK_SECRET so runners can report results.": "러너가 결과를 보고할 수 있도록 RUNNER_CALLBACK_SECRET을 설정하세요.",
  "Set GITHUB_DISPATCH_TOKEN and GITHUB_DISPATCH_REPOSITORY to use the GitHub runner.":
    "GitHub 러너를 사용하려면 GITHUB_DISPATCH_TOKEN과 GITHUB_DISPATCH_REPOSITORY를 설정하세요.",
  "Invalid automation run id.": "올바르지 않은 자동화 실행 ID입니다.",
  "Artifact is larger than 25 MB.": "아티팩트가 25MB보다 큽니다.",
  "Supabase storage unavailable.": "Supabase 스토리지를 사용할 수 없습니다.",
  "Artifact not found.": "아티팩트를 찾을 수 없습니다.",
  "Automation run not found.": "자동화 실행을 찾을 수 없습니다.",
  "Missing runner signature headers.": "러너 서명 헤더가 없습니다.",
  "Signature timestamp is outside the allowed window.": "서명 타임스탬프가 허용 범위를 벗어났습니다.",
  "Malformed signature.": "서명 형식이 올바르지 않습니다.",
  "Invalid signature.": "서명이 올바르지 않습니다.",

  // Spec lint (src/lib/automation/code-lint.ts)
  "The spec is empty.": "스펙이 비어 있습니다.",
  'The spec must import { test, expect } from "@playwright/test".':
    '스펙은 "@playwright/test"에서 { test, expect }를 import해야 합니다.',
  "require() is not allowed; use the existing @playwright/test import.":
    "require()는 사용할 수 없습니다. 기존 @playwright/test import를 사용하세요.",
  "Dynamic import() is not allowed.": "동적 import()는 사용할 수 없습니다.",
  "Spawning processes is not allowed.": "프로세스를 생성할 수 없습니다.",
  "Accessing process.env / process controls is not allowed in specs.":
    "스펙에서는 process.env / 프로세스 제어에 접근할 수 없습니다.",
  "eval / new Function is not allowed.": "eval / new Function은 사용할 수 없습니다.",
  "File system access is not allowed.": "파일 시스템에 접근할 수 없습니다.",
  "Global / filesystem helpers are not allowed.": "전역 / 파일 시스템 헬퍼는 사용할 수 없습니다.",
  "No test() block found.": "test() 블록이 없습니다.",
  "test.only() would skip other tests; remove it.": "test.only()는 다른 테스트를 건너뛰게 합니다. 제거하세요.",
  "No expect() assertion found; the test can only fail on errors.":
    "expect() 단언이 없습니다. 테스트는 오류가 날 때만 실패합니다.",
  "waitForTimeout() makes tests slow and flaky; prefer web-first assertions.":
    "waitForTimeout()은 테스트를 느리고 불안정하게 만듭니다. 웹 우선 단언을 사용하세요.",
  "page.goto() uses an absolute URL; prefer relative paths so the run's target URL applies.":
    "page.goto()가 절대 URL을 사용합니다. 실행의 대상 URL이 적용되도록 상대 경로를 사용하세요.",
  "The spec still contains TODOs to resolve before it is reliable.": "스펙에 아직 해결해야 할 TODO가 남아 있습니다.",
};

/** Entity names used by `notFound(entity, id)`. */
const ENTITIES: Record<string, string> = {
  Project: "프로젝트",
  Section: "섹션",
  "Test case": "테스트 케이스",
  "Test run": "테스트 실행",
  "Automation test": "자동화 테스트",
  "Automation run": "자동화 실행",
  "Automation result": "자동화 결과",
};

const STATUSES: Record<string, string> = {
  queued: "대기 중",
  running: "실행 중",
  passed: "통과",
  failed: "실패",
  cancelled: "취소됨",
  error: "오류",
  completed: "완료",
};

const ZOD_TYPES: Record<string, string> = {
  string: "문자열",
  number: "숫자",
  int: "정수",
  array: "목록",
  boolean: "불리언",
  object: "객체",
  date: "날짜",
};

type Replacer = (match: string[], locale: Locale) => string;
type Pattern = [RegExp, Replacer];

const entity = (name: string) => ENTITIES[name] ?? name;
const status = (value: string) => STATUSES[value] ?? value;
const zodType = (value: string) => ZOD_TYPES[value] ?? value;
/** Translates a run of sentences ("A. B.") one sentence at a time. */
const sentences = (text: string, locale: Locale) =>
  text
    .split(/(?<=\.)\s+(?=\S)/)
    .map((part) => localizeMessage(part, locale))
    .join(" ");

/** Dynamic messages (keys, ids, statuses, counts). First match wins; order matters. */
const PATTERNS: Pattern[] = [
  // notFound(entity, id?)
  [/^(Project|Section|Test case|Test run|Automation test|Automation run|Automation result) (.+) was not found\.$/, (m) => `${entity(m[1])} ${m[2]}을(를) 찾을 수 없습니다.`],
  [/^(Project|Section|Test case|Test run|Automation test|Automation run|Automation result) was not found\.$/, (m) => `${entity(m[1])}을(를) 찾을 수 없습니다.`],

  // Projects / sections / cases / runs
  [/^Project key (.+) is already in use\.$/, (m) => `프로젝트 키 ${m[1]}은(는) 이미 사용 중입니다.`],
  [/^Type (.+) to confirm deletion\.$/, (m) => `삭제하려면 ${m[1]}을(를) 입력하세요.`],
  [/^A section named "(.*)" already exists here\.$/, (m) => `이 위치에 "${m[1]}" 섹션이 이미 있습니다.`],
  [/^Case key (.+) already exists in this project\.$/, (m) => `케이스 키 ${m[1]}이(가) 이 프로젝트에 이미 있습니다.`],
  [/^(.+) is not an AI draft\.$/, (m) => `${m[1]}은(는) AI 초안이 아닙니다.`],
  [/^(.+) must be approved before it can be executed\.$/, (m) => `${m[1]}은(는) 실행하기 전에 승인되어야 합니다.`],

  // Automation
  [/^Automation run is already (\w+)\.$/, (m) => `자동화 실행이 이미 ${status(m[1])} 상태입니다.`],
  [/^Test case (.+) is not part of this automation run\.$/, (m) => `테스트 케이스 ${m[1]}은(는) 이 자동화 실행에 포함되어 있지 않습니다.`],
  [/^Fix the blocking issues before approving: ([\s\S]*)$/, (m, l) => `승인하기 전에 차단 문제를 수정하세요: ${sentences(m[1], l)}`],
  [/^Unsupported artifact type (.*)\.$/, (m) => `지원하지 않는 아티팩트 형식입니다: ${m[1]}`],
  [/^Could not store artifact: ([\s\S]*)$/, (m) => `아티팩트를 저장하지 못했습니다: ${m[1]}`],
  [/^GitHub rejected the workflow dispatch \(HTTP (\d+)\)\.$/, (m) => `GitHub가 워크플로 실행 요청을 거부했습니다 (HTTP ${m[1]}).`],
  [/^Import of "(.+)" is not allowed; only @playwright\/test may be imported\.$/, (m) => `"${m[1]}" import는 사용할 수 없습니다. @playwright/test만 import할 수 있습니다.`],
  [/^"(.+)" is not allowed as a property name in specs\.$/, (m) => `스펙에서는 "${m[1]}"을(를) 속성 이름으로 사용할 수 없습니다.`],
  [/^"(.+)" is not allowed in specs\.$/, (m) => `스펙에서는 "${m[1]}"을(를) 사용할 수 없습니다.`],

  // Analysis
  [
    /^Analysis failed: ([\s\S]*)$/,
    (m, l) =>
      `분석 실패: ${m[1].replace(/(application|repository): ([\s\S]+?)(?= (?:application|repository): |$)/g, (_all, kind: string, message: string) =>
        `${kind === "application" ? "애플리케이션" : "저장소"}: ${localizeMessage(message, l)}`,
      )}`,
  ],
  [/^GitHub API returned HTTP (\d+)\.$/, (m) => `GitHub API가 HTTP ${m[1]}을(를) 반환했습니다.`],
  [/^(\d+) page\(s\) analyzed \((.+)\)$/, (m) => `페이지 ${m[1]}개 분석됨 (${m[2]})`],
  [/^(.+) returned HTTP (\d+)\.$/, (m) => `${m[1]}이(가) HTTP ${m[2]}을(를) 반환했습니다.`],
  [/^Could not render (.+) in the browser\.$/, (m) => `브라우저에서 ${m[1]}을(를) 렌더링하지 못했습니다.`],

  // Safe fetch / URL guard
  [/^(.+) resolves to a private or reserved address\.$/, (m) => `${m[1]}은(는) 사설 또는 예약 주소로 연결됩니다.`],
  [/^Timed out after (\d+(?:\.\d+)?)s fetching (.+)\.$/, (m) => `${m[2]}을(를) 가져오는 중 ${m[1]}초 후 시간이 초과되었습니다.`],
  [/^Could not reach (.+)\.$/, (m) => `${m[1]}에 연결할 수 없습니다.`],
  [/^Too many redirects from (.+)\.$/, (m) => `${m[1]}에서 리디렉션이 너무 많습니다.`],
  [/^Unexpected content type "(.*)" from (.+)\.$/, (m) => `${m[2]}에서 예상하지 못한 콘텐츠 형식 "${m[1]}"을(를) 받았습니다.`],
  [/^Could not resolve (.+)\.$/, (m) => `${m[1]}의 주소를 확인할 수 없습니다.`],

  // AI providers
  [/^OpenAI API error \((\d+)\)\.$/, (m) => `OpenAI API 오류가 발생했습니다 (${m[1]}).`],
  [/^Anthropic API error \((\d+)\)\.$/, (m) => `Anthropic API 오류가 발생했습니다 (${m[1]}).`],
  [/^Anthropic rejected the request: ([\s\S]*)$/, (m) => `Anthropic이 요청을 거부했습니다: ${m[1]}`],

  // Database
  [/^(.+): invalid identifier or value\.$/, (m) => `${m[1]}: 식별자 또는 값이 올바르지 않습니다.`],
  [/^(.+): a record with the same key already exists\.$/, (m) => `${m[1]}: 같은 키를 가진 레코드가 이미 있습니다.`],
  [/^(.+): a referenced record does not exist\.$/, (m) => `${m[1]}: 참조한 레코드가 없습니다.`],
  [/^(.+): value violates a database constraint\.$/, (m) => `${m[1]}: 값이 데이터베이스 제약 조건을 위반합니다.`],
  [/^(.+) failed\. Check the database connection\.$/, (m) => `${m[1]}에 실패했습니다. 데이터베이스 연결을 확인하세요.`],

  // Zod defaults
  [/^Too big: expected string to have <=?(\d+) characters$/, (m) => `${m[1]}자 이하로 입력하세요.`],
  [/^Too small: expected string to have >=?(\d+) characters$/, (m) => (m[1] === "1" ? "값을 입력하세요." : `${m[1]}자 이상 입력하세요.`)],
  [/^Too big: expected array to have <=?(\d+) items$/, (m) => `최대 ${m[1]}개까지 가능합니다.`],
  [/^Too small: expected array to have >=?(\d+) items$/, (m) => `최소 ${m[1]}개가 필요합니다.`],
  [/^Too big: expected (?:number|int|bigint) to be <=?(.+)$/, (m) => `${m[1]} 이하의 값을 입력하세요.`],
  [/^Too small: expected (?:number|int|bigint) to be >=?(.+)$/, (m) => `${m[1]} 이상의 값을 입력하세요.`],
  [/^Invalid input: expected (\w+), received (\w+)$/, (m) => `입력값이 올바르지 않습니다: ${zodType(m[1])} 형식이어야 합니다.`],
  [/^Invalid option: expected one of ([\s\S]+)$/, (m) => `올바르지 않은 선택입니다. 다음 중 하나여야 합니다: ${m[1]}`],
  [/^Invalid string: must match pattern ([\s\S]+)$/, () => "형식이 올바르지 않습니다."],
  [/^Unrecognized keys?: ([\s\S]+)$/, (m) => `알 수 없는 키: ${m[1]}`],
];

/**
 * Translates a known English server message into `locale`. English (or an unknown message)
 * returns the text unchanged.
 */
export function localizeMessage(message: string, locale: Locale): string {
  if (locale === "en" || !message) return message;
  const exact = EXACT[message];
  if (exact !== undefined) return exact;
  for (const [pattern, replace] of PATTERNS) {
    const match = pattern.exec(message);
    if (match) return replace(Array.from(match), locale);
  }
  return message;
}

/** Translates every value of a field-error map (e.g. `{ name: "Project name is required." }`). */
export function localizeFieldErrors(fields: Record<string, string>, locale: Locale): Record<string, string> {
  if (locale === "en") return fields;
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, localizeMessage(value, locale)]));
}
