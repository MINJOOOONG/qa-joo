import type { FieldInfo, PageInfo, ProjectAnalysis } from "@/lib/analyzer/types";
import type { GeneratedCase } from "./schemas";

/**
 * Korean heuristic cases (raw, before dedupe/balance). See heuristic-cases.ts.
 *
 * Cases are written in Korean. Steps follow fixed phrasings ("\"필드\"에 \"값\"을 입력한다.",
 * "\"버튼\" 버튼을 클릭한다.", "/경로 페이지를 연다.") that the Playwright draft generator understands.
 */

/** Sub-section names, in display order. */
export const SUBAREAS = {
  smoke: "스모크",
  happy: "정상 흐름",
  negative: "부정 케이스",
  boundary: "경계값",
  security: "보안",
  error: "오류 처리",
} as const;

function areaForPage(page: PageInfo): string {
  if (page.path === "/" || page.path === "") {
    return page.headings[0]?.slice(0, 60) ?? page.title?.split(/[|·–-]/)[0].trim().slice(0, 60) ?? "홈";
  }
  const segment = page.path.split("/").filter(Boolean)[0] ?? "홈";
  return segment.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).slice(0, 60);
}

function fieldName(field: FieldInfo): string {
  return field.label ?? field.placeholder ?? field.name ?? `${field.type} 입력`;
}

function constraint(field: FieldInfo, key: string): string | null {
  const entry = field.constraints.find((value) => value.startsWith(`${key}=`));
  return entry ? entry.slice(key.length + 1) : null;
}

function isUrlField(field: FieldInfo): boolean {
  return field.type === "url" || /url|link|website|address/i.test(`${field.name} ${field.label} ${field.placeholder}`);
}

function primaryAction(page: PageInfo, fallback = "제출"): string {
  const submit =
    page.forms.flatMap((form) => form.submitLabels)[0] ??
    page.buttons.find((label) => /submit|save|send|create|analy[sz]e|generate|search|continue|sign|저장|생성|분석|검색|제출|확인/i.test(label)) ??
    page.buttons[0];
  return submit ?? fallback;
}

const pageName = (page: PageInfo) => page.title ?? page.path;
const click = (action: string) => `"${action}" 버튼을 클릭한다.`;

function casesForField(page: PageInfo, field: FieldInfo, action: string, area: string): GeneratedCase[] {
  const name = fieldName(field);
  const cases: GeneratedCase[] = [];
  const pre = `사용자가 ${pageName(page)} 페이지에 있다.`;
  const base = { area, preconditions: pre, tags: [] as string[] };

  if (field.required || isUrlField(field)) {
    cases.push({
      ...base,
      subarea: SUBAREAS.negative,
      title: `${name} 미입력 시 제출 차단`,
      type: "negative",
      priority: "high",
      steps: [`"${name}" 필드를 비워 둔다.`, click(action)],
      expectedResult: `제출이 차단되고 "${name}"이(가) 필수라는 검증 메시지가 표시된다.`,
      tags: ["validation"],
      rationale: `${page.path}의 "${name}"은(는) ${field.required ? "필수 입력" : "주요 입력"} 항목이다.`,
    });
  }

  if (isUrlField(field)) {
    cases.push(
      {
        ...base,
        subarea: SUBAREAS.negative,
        title: `${name}에 잘못된 형식의 URL 입력 시 거부`,
        type: "negative",
        priority: "high",
        steps: [`"${name}"에 "not-a-valid-url"을 입력한다.`, click(action)],
        expectedResult: "입력란에 검증 오류가 표시되고 요청이 전송되지 않는다.",
        tags: ["validation", "url"],
        rationale: `"${name}"은(는) URL을 입력받는다 (${field.constraints.join(", ") || field.type}).`,
      },
      {
        ...base,
        subarea: SUBAREAS.security,
        title: `${name}에 localhost·사설망 URL 입력 시 거부`,
        type: "security",
        priority: "high",
        steps: [
          `"${name}"에 "http://localhost/admin"을 입력하고 "${action}" 버튼을 클릭한다.`,
          `"http://192.168.0.1/"과 "http://169.254.169.254/latest/meta-data/"로 반복한다.`,
        ],
        expectedResult: "모든 요청이 거부되고 서버가 내부 주소로 요청을 보내지 않는다 (SSRF 방어).",
        tags: ["ssrf", "security"],
        rationale: `"${name}"에 사용자가 입력한 URL을 서버가 요청하므로 대표적인 SSRF 진입점이다.`,
      },
      {
        ...base,
        subarea: SUBAREAS.boundary,
        title: `${name}에 매우 긴 URL 입력 처리`,
        type: "boundary",
        priority: "medium",
        steps: [`"${name}"에 길이 2,048자인 유효한 URL을 입력한다.`, click(action), "2,049자로 반복한다."],
        expectedResult: "지원하는 최대 길이까지는 허용되고, 그보다 길면 명확한 메시지와 함께 거부된다.",
        tags: ["boundary", "url"],
        rationale: "URL 입력에는 명시적인 최대 길이가 필요하다.",
      },
    );
  } else if (field.type === "email") {
    cases.push({
      ...base,
      subarea: SUBAREAS.negative,
      title: `${name}에 잘못된 이메일 입력 시 거부`,
      type: "negative",
      priority: "high",
      steps: [`"${name}"에 "user@"를 입력한다.`, click(action)],
      expectedResult: "검증 오류가 표시되고 폼이 제출되지 않는다.",
      tags: ["validation", "email"],
      rationale: `"${name}"은(는) 이메일 입력란이다.`,
    });
  } else if (field.type === "number" || constraint(field, "min") || constraint(field, "max")) {
    const min = constraint(field, "min");
    const max = constraint(field, "max");
    cases.push({
      ...base,
      subarea: SUBAREAS.boundary,
      title: `${name} 숫자 범위 검증`,
      type: "boundary",
      priority: "medium",
      steps: [
        min ? `${min}(최솟값)을 입력해 제출한 뒤 ${Number(min) - 1}을 입력한다.` : "0과 음수를 입력한다.",
        max ? `${max}(최댓값)을 입력해 제출한 뒤 ${Number(max) + 1}을 입력한다.` : "매우 큰 수(예: 1e12)를 입력한다.",
        "'abc'처럼 숫자가 아닌 값을 입력한다.",
      ],
      expectedResult: "범위 안의 값은 허용되고, 범위를 벗어나거나 숫자가 아닌 값은 메시지와 함께 거부된다.",
      tags: ["boundary", "number"],
      rationale: `"${name}"은(는) 숫자 입력이다${min || max ? ` (min=${min ?? "–"}, max=${max ?? "–"})` : ""}.`,
    });
  } else if (field.type === "file") {
    cases.push(
      {
        ...base,
        subarea: SUBAREAS.boundary,
        title: `${name} 업로드 제한 검증`,
        type: "boundary",
        priority: "medium",
        steps: ["허용된 최대 크기/개수의 파일을 업로드한다.", "제한을 하나 초과하는 파일을 업로드한다."],
        expectedResult: "제한까지는 허용되고, 초과하면 명확한 오류가 표시되며 업로드되지 않는다.",
        tags: ["upload", "boundary"],
        rationale: `"${name}"은(는) 파일 입력이다${field.constraints.length ? ` (${field.constraints.join(", ")})` : ""}.`,
      },
      {
        ...base,
        subarea: SUBAREAS.negative,
        title: `${name}에 지원하지 않는 파일 형식 업로드 시 거부`,
        type: "negative",
        priority: "medium",
        steps: [".exe 파일이나 확장자만 .jpg로 바꾼 .txt 파일을 업로드한다.", click(action)],
        expectedResult: "지원 형식 목록과 함께 파일이 거부된다.",
        tags: ["upload", "validation"],
        rationale: `"${name}"은(는) 업로드를 받는다${constraint(field, "accept") ? ` (accept=${constraint(field, "accept")})` : ""}.`,
      },
    );
  } else if (field.tag === "textarea" || field.type === "text" || field.type === "search") {
    const maxLength = constraint(field, "maxlength");
    cases.push({
      ...base,
      subarea: SUBAREAS.boundary,
      title: maxLength ? `${name} ${maxLength}자 제한 검증` : `${name}에 매우 긴 입력 처리`,
      type: "boundary",
      priority: "low",
      steps: maxLength
        ? [`"${name}"에 정확히 ${maxLength}자를 입력한다.`, `${Number(maxLength) + 1}자 입력을 시도한다.`]
        : [`"${name}"에 10,000자를 붙여넣는다.`, click(action)],
      expectedResult: "제한 길이까지는 허용되고, 더 긴 입력은 레이아웃을 깨뜨리지 않고 잘리거나 거부된다.",
      tags: ["boundary"],
      rationale: `"${name}"은(는) 자유 텍스트 입력이다${maxLength ? ` (maxlength=${maxLength})` : " (길이 제한 표시 없음)"}.`,
    });
    if (field.tag === "textarea") {
      cases.push({
        ...base,
        subarea: SUBAREAS.security,
        title: `${name}에 입력한 HTML을 일반 텍스트로 표시`,
        type: "security",
        priority: "medium",
        steps: [`"${name}"에 "<img src=x onerror=alert(1)>"을 입력한다.`, click(action), "출력 결과를 확인한다."],
        expectedResult: "마크업이 텍스트로 표시되고 스크립트가 실행되지 않는다 (XSS 없음).",
        tags: ["xss", "security"],
        rationale: `"${name}"에 입력한 텍스트가 화면에 다시 표시될 가능성이 높다.`,
      });
    }
  } else if (field.type === "password") {
    cases.push({
      ...base,
      subarea: SUBAREAS.security,
      title: `${name} 마스킹 및 URL 노출 방지`,
      type: "security",
      priority: "high",
      steps: [`"${name}"에 비밀번호를 입력한다.`, "제출한 뒤 결과 URL과 네트워크 요청을 확인한다."],
      expectedResult: "값이 화면에서 가려지고 URL이나 쿼리 문자열에 절대 나타나지 않는다.",
      tags: ["security", "auth"],
      rationale: `"${name}"은(는) 비밀번호 입력란이다.`,
    });
  }
  return cases;
}

export function koreanHeuristicCases(projectName: string, analysis: ProjectAnalysis): GeneratedCase[] {
  const cases: GeneratedCase[] = [];
  const pages = analysis.app?.pages ?? [];
  const repo = analysis.repo;

  for (const [index, page] of pages.entries()) {
    const area = areaForPage(page);
    const action = primaryAction(page);
    const fields = [...page.forms.flatMap((form) => form.fields), ...page.looseFields].filter(
      (field) => !field.constraints.includes("disabled"),
    );

    cases.push({
      title: index === 0 ? `${page.title ?? projectName} 홈 화면 로딩` : `${page.path} 페이지 로딩`,
      area,
      subarea: SUBAREAS.smoke,
      type: "smoke",
      priority: index === 0 ? "critical" : "medium",
      preconditions: "애플리케이션이 배포되어 접속 가능하다.",
      steps: [`${page.path} 페이지를 연다.`, "페이지 로딩이 끝날 때까지 기다린다."],
      expectedResult: `오류 없이 페이지가 표시된다${page.headings[0] ? ` ("${page.headings[0]}" 제목 표시)` : ""}.`,
      tags: ["smoke"],
      rationale: `분석 중 ${page.path} 페이지에 접속할 수 있었다.`,
    });

    if (fields.length) {
      const named = fields.slice(0, 3).map(fieldName);
      cases.push({
        title: `${page.path === "/" ? "홈 화면" : page.path}에서 유효한 입력으로 주요 흐름 완료`,
        area,
        subarea: SUBAREAS.happy,
        type: "functional",
        priority: "high",
        preconditions: `사용자가 ${pageName(page)} 페이지에 있다.`,
        steps: [...named.map((name) => `"${name}"에 유효한 값을 입력한다.`), click(action), "응답을 기다린다."],
        expectedResult: "요청이 성공하고 결과가 오류 없이 표시된다.",
        tags: ["happy-path"],
        rationale: `${page.path}에서 입력 ${fields.length}개와 "${action}" 동작을 발견했다.`,
      });
      cases.push({
        title: `"${action}" 중복 제출 방지`,
        area,
        subarea: SUBAREAS.negative,
        type: "negative",
        priority: "medium",
        preconditions: `사용자가 ${pageName(page)} 페이지에서 유효한 값을 입력한 상태다.`,
        steps: [`"${action}" 버튼을 빠르게 두 번 클릭한다.`],
        expectedResult: "요청은 한 번만 전송되고, 요청 중에는 버튼이 비활성화된다.",
        tags: ["idempotency"],
        rationale: `"${action}"은(는) 서버 요청을 보낸다.`,
      });
      cases.push({
        title: `"${action}" 실패 시 복구 가능한 오류 표시`,
        area,
        subarea: SUBAREAS.error,
        type: "error",
        priority: "high",
        preconditions: "백엔드가 HTTP 500을 반환하거나 네트워크가 끊긴 상태다.",
        steps: ["서버 오류를 발생시킨다 (또는 DevTools에서 오프라인으로 전환한다).", click(action), "네트워크를 복구하고 다시 시도한다."],
        expectedResult: "읽기 쉬운 오류가 표시되고, 입력한 데이터가 유지되며, 재시도하면 성공한다.",
        tags: ["resilience"],
        rationale: "사용자가 보내는 모든 요청에는 실패 상태가 필요하다.",
      });
    }
    for (const field of fields.slice(0, 4)) cases.push(...casesForField(page, field, action, area));

    if (page.navLabels.length > 1 && index === 0) {
      cases.push({
        title: "주요 메뉴 간 이동",
        area: "내비게이션",
        subarea: "",
        type: "e2e",
        priority: "medium",
        preconditions: "사용자가 홈 화면에 있다.",
        steps: page.navLabels.slice(0, 5).map((label) => `"${label}" 버튼을 클릭한다.`),
        expectedResult: "각 메뉴가 올바른 페이지를 열고, 브라우저 뒤로 가기로 이전 페이지에 돌아온다.",
        tags: ["navigation"],
        rationale: `발견한 메뉴: ${page.navLabels.slice(0, 5).join(", ")}.`,
      });
    }
  }

  if (repo) {
    for (const endpoint of repo.apiEndpoints.slice(0, 4)) {
      cases.push(
        {
          title: `${endpoint} 잘못된 요청 본문 거부`,
          area: "API",
          subarea: endpoint.slice(0, 60),
          type: "api",
          priority: "high",
          preconditions: "API에 접속할 수 있다.",
          steps: [`빈 JSON 본문으로 ${endpoint}에 POST 요청을 보낸다.`, "필드 타입이 잘못된 본문으로 다시 POST 요청을 보낸다."],
          expectedResult: "API가 HTTP 400/422와 JSON 오류 메시지로 응답하고 아무것도 저장되지 않는다.",
          tags: ["api", "validation"],
          rationale: `저장소에 ${endpoint} 라우트 핸들러가 있다.`,
        },
        {
          title: `${endpoint} 외부 의존성 장애 처리`,
          area: "API",
          subarea: endpoint.slice(0, 60),
          type: "error",
          priority: "medium",
          preconditions: "엔드포인트가 의존하는 외부 서비스를 사용할 수 없다.",
          steps: [`외부 의존성이 타임아웃되거나 500을 반환하는 동안 ${endpoint}를 호출한다.`],
          expectedResult: "API가 설정된 타임아웃 안에 통제된 오류를 반환한다 (스택 트레이스 노출 없음).",
          tags: ["api", "resilience"],
          rationale: `저장소의 API ${endpoint}에서 도출했다.`,
        },
      );
    }
    if (repo.hints.includes("Rate limiting is implemented")) {
      cases.push({
        title: "반복 요청 속도 제한",
        area: "API",
        subarea: SUBAREAS.security,
        type: "security",
        priority: "medium",
        preconditions: "속도 제한(rate limiting)이 활성화되어 있다.",
        steps: ["1분 안에 허용 한도를 넘는 요청을 보낸다.", "마지막 응답들을 확인한다."],
        expectedResult: "한도를 넘은 요청은 재시도 안내와 함께 HTTP 429를 받고, 일반 트래픽은 영향받지 않는다.",
        tags: ["rate-limit"],
        rationale: "저장소에 속도 제한 로직이 있다.",
      });
    }
    if (repo.hints.includes("Requests use timeouts")) {
      cases.push({
        title: "외부 서비스 타임아웃 처리",
        area: "안정성",
        subarea: SUBAREAS.error,
        type: "error",
        priority: "medium",
        preconditions: "외부 의존성이 타임아웃보다 늦게 응답한다.",
        steps: ["느린 외부 서비스로 요청을 보낸다.", "타임아웃이 날 때까지 기다린다."],
        expectedResult: "명확한 타임아웃 메시지가 표시되고 사용자가 다시 시도할 수 있다.",
        tags: ["timeout"],
        rationale: "저장소에서 요청 타임아웃을 명시적으로 사용한다.",
      });
    }
    for (const route of repo.routes.filter((route) => route !== "/" && !route.includes("[")).slice(0, 3)) {
      cases.push({
        title: `${route} 페이지 로딩`,
        area: "라우트",
        subarea: SUBAREAS.smoke,
        type: "smoke",
        priority: "low",
        preconditions: "애플리케이션이 배포되어 있다.",
        steps: [`${route} 페이지를 연다.`],
        expectedResult: "오류 없이 페이지가 표시되고, 존재하지 않는 하위 경로는 404 페이지를 반환한다.",
        tags: ["smoke", "routing"],
        rationale: `저장소에 ${route} 라우트가 있다.`,
      });
    }
  }

  cases.push(
    {
      title: "존재하지 않는 페이지에 친절한 404 표시",
      area: "공통",
      subarea: SUBAREAS.error,
      type: "error",
      priority: "low",
      preconditions: "애플리케이션이 배포되어 있다.",
      steps: ["/this-page-does-not-exist-qa-joo 페이지를 연다."],
      expectedResult: "앱으로 돌아갈 수 있는 404 페이지가 표시되고 스택 트레이스가 노출되지 않는다.",
      tags: ["routing"],
      rationale: "모든 웹 애플리케이션의 기본 오류 처리 점검이다.",
    },
    {
      title: "기본 보안 헤더 제공",
      area: "공통",
      subarea: SUBAREAS.security,
      type: "security",
      priority: "low",
      preconditions: "애플리케이션이 HTTPS로 배포되어 있다.",
      steps: ["홈 화면을 연다.", "DevTools에서 응답 헤더를 확인한다."],
      expectedResult: "HTTPS가 강제되고 X-Content-Type-Options, Content-Security-Policy 같은 헤더가 있다.",
      tags: ["headers"],
      rationale: "모든 웹 애플리케이션의 기본 보안 점검이다.",
    },
  );
  return cases;
}
