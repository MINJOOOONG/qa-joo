import type { FieldInfo, PageInfo, ProjectAnalysis } from "@/lib/analyzer/types";
import {
  constraint,
  exampleValue,
  isTextField,
  isUrlField,
  linkedPages,
  objectParticle,
  pageFields,
  pageLabel,
  resultHeading,
  uncrawledLinks,
} from "./heuristic-cases-shared";
import type { GeneratedCase } from "./schemas";

/**
 * Korean heuristic cases (raw, before dedupe/balance). See heuristic-cases.ts.
 * heuristic-cases-en.ts is the English twin: keep both files parallel (same cases, same order).
 *
 * Steps are one action each and use fixed phrasings the Playwright draft generator understands:
 * "\"필드\"에 \"값\"을 입력한다.", "\"필드\" 필드를 비워 둔다.", "\"버튼\" 버튼을 클릭한다.",
 * "\"링크\" 링크를 클릭한다.", "/경로 페이지를 연다."
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

/** Extra sub-sections used by "fill gaps" cases. */
const GAP_SUBAREAS = {
  navigation: "내비게이션",
  usability: "사용성",
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

function primaryAction(page: PageInfo, fallback = "제출"): string {
  const submit =
    page.forms.flatMap((form) => form.submitLabels)[0] ??
    page.buttons.find((label) => /submit|save|send|create|analy[sz]e|generate|search|continue|sign|저장|생성|분석|검색|제출|확인/i.test(label)) ??
    page.buttons[0];
  return submit ?? fallback;
}

const click = (action: string) => `"${action}" 버튼을 클릭한다.`;
const clickLink = (label: string) => `"${label}" 링크를 클릭한다.`;
const enter = (name: string, value: string) => `"${name}"에 "${value}"${objectParticle(value)} 입력한다.`;
const TEXT_EXAMPLE = "QA 테스트 입력";

/** One fill step per field with a concrete example value (fields without one are skipped). */
function fillSteps(fields: FieldInfo[]): string[] {
  return fields.flatMap((field) => {
    const value = exampleValue(field, TEXT_EXAMPLE);
    if (value === null) return [];
    return field.tag === "select"
      ? [`"${fieldName(field)}"에서 "${value}"${objectParticle(value)} 선택한다.`]
      : [enter(fieldName(field), value)];
  });
}

/** What a successful main action shows, based on the analysis. */
function successResult(page: PageInfo): string {
  const heading = resultHeading(page);
  return heading
    ? `"${heading}" 결과 영역이 표시되고 오류 메시지는 나타나지 않는다.`
    : "요청이 성공하고 결과(또는 완료 메시지)가 표시되며 오류 메시지는 나타나지 않는다.";
}

function casesForField(page: PageInfo, field: FieldInfo, action: string, area: string): GeneratedCase[] {
  const name = fieldName(field);
  const cases: GeneratedCase[] = [];
  const pre = `사용자가 ${pageLabel(page)} 페이지에 있다.`;
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
      rationale: `${pageLabel(page)}의 "${name}"은(는) ${field.required ? "필수 입력" : "주요 입력"} 항목이다.`,
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
        steps: [enter(name, "not-a-valid-url"), click(action)],
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
          enter(name, "http://localhost/admin"),
          click(action),
          enter(name, "http://169.254.169.254/latest/meta-data/"),
          click(action),
        ],
        expectedResult: "두 요청 모두 거부되고 서버가 내부 주소로 요청을 보내지 않는다 (SSRF 방어).",
        tags: ["ssrf", "security"],
        rationale: `"${name}"에 사용자가 입력한 URL을 서버가 요청하므로 대표적인 SSRF 진입점이다.`,
      },
      {
        ...base,
        subarea: SUBAREAS.boundary,
        title: `${name}에 매우 긴 URL 입력 시 안정성`,
        type: "boundary",
        priority: "medium",
        steps: [`"${name}"에 길이 2,000자인 URL(https://example.com/ 뒤에 문자를 이어 붙인 값)을 입력한다.`, click(action)],
        expectedResult: "페이지가 멈추거나 깨지지 않고, 서버 오류(500)가 표시되지 않는다.",
        tags: ["boundary", "url"],
        rationale: `"${name}"에는 표시된 최대 길이가 없으므로 매우 긴 값을 넣어 본다.`,
      },
    );
  } else if (field.type === "email") {
    cases.push({
      ...base,
      subarea: SUBAREAS.negative,
      title: `${name}에 잘못된 이메일 입력 시 거부`,
      type: "negative",
      priority: "high",
      steps: [enter(name, "user@"), click(action)],
      expectedResult: "검증 오류가 표시되고 폼이 제출되지 않는다.",
      tags: ["validation", "email"],
      rationale: `"${name}"은(는) 이메일 입력란이다.`,
    });
  } else if (field.type === "number" || constraint(field, "min") || constraint(field, "max")) {
    const min = constraint(field, "min");
    const max = constraint(field, "max");
    const accepted = [min, max].filter((v): v is string => v !== null);
    const rejected = [min !== null ? String(Number(min) - 1) : "-1", max !== null ? String(Number(max) + 1) : "1000000000000"];
    const probe = [...accepted, ...rejected];
    cases.push({
      ...base,
      subarea: SUBAREAS.boundary,
      title: `${name} 숫자 범위 검증`,
      type: "boundary",
      priority: "medium",
      steps: probe.flatMap((value) => [enter(name, value), click(action)]),
      expectedResult: accepted.length
        ? `${accepted.join("과(와) ")}은(는) 오류 없이 허용되고, ${rejected.join("과(와) ")}은(는) 범위 오류 메시지와 함께 거부된다.`
        : `${rejected.join("과(와) ")}을(를) 넣으면 범위 오류 메시지가 표시되거나, 허용 범위가 화면에 안내된다.`,
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
        steps: ["확장자만 .jpg로 바꾼 .txt 파일을 업로드한다.", click(action)],
        expectedResult: "지원 형식 목록과 함께 파일이 거부된다.",
        tags: ["upload", "validation"],
        rationale: `"${name}"은(는) 업로드를 받는다${constraint(field, "accept") ? ` (accept=${constraint(field, "accept")})` : ""}.`,
      },
    );
  } else if (isTextField(field)) {
    const maxLength = constraint(field, "maxlength");
    cases.push({
      ...base,
      subarea: SUBAREAS.boundary,
      title: maxLength ? `${name} ${maxLength}자 제한 검증` : `${name}에 매우 긴 입력 처리`,
      type: "boundary",
      priority: "low",
      steps: maxLength
        ? [`"${name}"에 ${Number(maxLength) + 1}자를 붙여넣는다.`, `"${name}"에 입력된 글자 수를 확인한다.`]
        : [`"${name}"에 10,000자를 붙여넣는다.`, click(action)],
      expectedResult: maxLength
        ? `"${name}"에는 ${maxLength}자까지만 입력된다.`
        : "페이지가 멈추거나 레이아웃이 깨지지 않고, 서버 오류(500)가 표시되지 않는다.",
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
        steps: [enter(name, "<img src=x onerror=alert(1)>"), click(action), "출력 결과를 확인한다."],
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
      steps: [enter(name, "Qa-Test-1234!"), click(action), "결과 URL과 네트워크 요청을 확인한다."],
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
    const fields = pageFields(page);
    const label = pageLabel(page);

    cases.push({
      title: index === 0 ? `${page.title ?? projectName} 홈 화면 로딩` : `${label} 페이지 로딩`,
      area,
      subarea: SUBAREAS.smoke,
      type: "smoke",
      priority: index === 0 ? "critical" : "medium",
      preconditions: "애플리케이션이 배포되어 접속 가능하다.",
      steps: [`${page.path} 페이지를 연다.`, "페이지 로딩이 끝날 때까지 기다린다."],
      expectedResult: page.headings[0]
        ? `"${page.headings[0]}" 제목이 표시되고 오류 메시지가 나타나지 않는다.`
        : "페이지 본문이 표시되고 오류 메시지가 나타나지 않는다.",
      tags: ["smoke"],
      rationale: `분석 중 ${page.path} 페이지에 접속할 수 있었다.`,
    });

    if (fields.length) {
      cases.push({
        title: `${index === 0 && page.path === "/" ? "홈 화면" : label}에서 유효한 입력으로 주요 흐름 완료`,
        area,
        subarea: SUBAREAS.happy,
        type: "functional",
        priority: "high",
        preconditions: `사용자가 ${label} 페이지에 있다.`,
        steps: [...fillSteps(fields.slice(0, 4)), click(action), "응답을 기다린다."],
        expectedResult: successResult(page),
        tags: ["happy-path"],
        rationale: `${label}에서 입력 ${fields.length}개와 "${action}" 동작을 발견했다.`,
      });
      cases.push({
        title: `"${action}" 중복 제출 방지`,
        area,
        subarea: SUBAREAS.negative,
        type: "negative",
        priority: "medium",
        preconditions: `사용자가 ${label} 페이지에서 유효한 값을 입력한 상태다.`,
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
        preconditions: `사용자가 ${label} 페이지에서 유효한 값을 입력했고, 브라우저 DevTools를 열어 두었다.`,
        steps: [
          "DevTools의 Network 탭에서 Offline으로 전환한다.",
          click(action),
          "DevTools에서 Offline을 해제한다.",
          click(action),
        ],
        expectedResult: "오프라인일 때는 읽기 쉬운 오류 메시지가 표시되고 입력값이 유지되며, 네트워크 복구 후 다시 클릭하면 요청이 성공한다.",
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
        steps: page.navLabels.slice(0, 5).map(clickLink),
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
          title: `API ${endpoint} 잘못된 요청 본문 거부`,
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
          title: `API ${endpoint} 외부 의존성 장애 처리`,
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
        title: `라우트 페이지 로딩: ${route}`,
        area: "라우트",
        subarea: SUBAREAS.smoke,
        type: "smoke",
        priority: "low",
        preconditions: "애플리케이션이 배포되어 있다.",
        steps: [`${route} 페이지를 연다.`],
        expectedResult: "페이지 본문이 표시되고 오류 메시지가 나타나지 않는다.",
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

/**
 * "Fill gaps" cases: additional coverage that step 1 never produces, each tied to UI the analysis
 * actually found (links, forms, text fields, login). Returned raw; the caller dedupes them against
 * existing and dismissed titles.
 */
export function koreanGapCases(projectName: string, analysis: ProjectAnalysis): GeneratedCase[] {
  const cases: GeneratedCase[] = [];
  const pages = analysis.app?.pages ?? [];

  for (const [index, page] of pages.entries()) {
    const area = areaForPage(page);
    const label = pageLabel(page);
    const action = primaryAction(page);
    const fields = pageFields(page);

    // Pages reached from this page's links.
    for (const link of linkedPages(analysis, page).slice(0, 4)) {
      const target = pageLabel(link.page);
      cases.push({
        title: `"${link.label}" 링크로 ${target} 페이지 이동`,
        area: GAP_SUBAREAS.navigation,
        subarea: SUBAREAS.smoke,
        type: "e2e",
        priority: "medium",
        preconditions: `사용자가 ${label} 페이지에 있다.`,
        steps: [`${page.path} 페이지를 연다.`, clickLink(link.label)],
        expectedResult: link.page.headings[0]
          ? `${link.page.path} 페이지로 이동하고 "${link.page.headings[0]}" 제목이 표시된다.`
          : `${link.page.path} 페이지로 이동하고 본문이 오류 없이 표시된다.`,
        tags: ["navigation"],
        rationale: `${label}에 "${link.label}" 링크(${link.page.path})가 있다.`,
      });
    }

    if (!fields.length) continue;
    const fills = fillSteps(fields.slice(0, 4));
    const heading = resultHeading(page);

    cases.push({
      title: `${label} 결과 확인 후 뒤로 가기 시 상태 유지`,
      area,
      subarea: SUBAREAS.happy,
      type: "functional",
      priority: "medium",
      preconditions: `사용자가 ${label} 페이지에 있다.`,
      steps: [...fills, click(action), "응답을 기다린다.", "브라우저의 뒤로 가기를 실행한다.", "브라우저의 앞으로 가기를 실행한다."],
      expectedResult: "뒤로 가기·앞으로 가기 후에도 페이지가 오류 없이 표시되고, 입력값 또는 결과가 사라지거나 섞이지 않으며 요청이 다시 전송되지 않는다.",
      tags: ["navigation", "state"],
      rationale: `${label}의 "${action}" 동작은 결과 상태를 만든다.`,
    });
    cases.push({
      title: `${label} 제출 후 새로고침 시 동작`,
      area,
      subarea: SUBAREAS.happy,
      type: "functional",
      priority: "medium",
      preconditions: `사용자가 ${label} 페이지에 있다.`,
      steps: [...fills, click(action), "응답을 기다린다.", "페이지를 새로고침(F5)한다."],
      expectedResult: "새로고침 후 페이지가 오류 없이 다시 표시되고, 이전 요청이 자동으로 다시 전송되지 않는다.",
      tags: ["state"],
      rationale: `${label}에서 "${action}"으로 요청을 보낸다.`,
    });
    cases.push({
      title: `${label} 키보드만으로 입력·제출`,
      area,
      subarea: SUBAREAS.happy,
      type: "functional",
      priority: "medium",
      preconditions: `사용자가 ${label} 페이지에 있고 마우스를 사용하지 않는다.`,
      steps: [
        "Tab 키로 첫 번째 입력란까지 이동한다.",
        ...fills,
        `Tab 키로 "${action}" 버튼까지 이동한다.`,
        "Enter 키를 누른다.",
      ],
      expectedResult: `포커스가 화면 순서대로 이동하며 항상 눈에 보이고, 마우스 없이 제출된다${heading ? ` ("${heading}" 결과 표시)` : ""}.`,
      tags: ["accessibility", "keyboard"],
      rationale: `${label}에 입력 ${fields.length}개와 "${action}" 버튼이 있다.`,
    });
    cases.push({
      title: `${label} 모바일 화면(375px) 레이아웃`,
      area,
      subarea: GAP_SUBAREAS.usability,
      type: "functional",
      priority: "low",
      preconditions: "DevTools의 기기 모드에서 화면 너비를 375px로 설정했다.",
      steps: [`${page.path} 페이지를 연다.`, ...fills, click(action)],
      expectedResult: "가로 스크롤 없이 모든 입력란과 버튼이 보이고 눌리며, 글자가 잘리거나 겹치지 않는다.",
      tags: ["responsive"],
      rationale: `${label}에는 입력 폼이 있어 작은 화면에서의 사용성을 확인해야 한다.`,
    });

    // Whitespace-only input for required / text fields.
    const whitespaceField = fields.find((field) => field.required && (isTextField(field) || isUrlField(field) || field.type === "email"));
    if (whitespaceField) {
      const name = fieldName(whitespaceField);
      cases.push({
        title: `${name}에 공백만 입력 시 제출 차단`,
        area,
        subarea: SUBAREAS.negative,
        type: "negative",
        priority: "medium",
        preconditions: `사용자가 ${label} 페이지에 있다.`,
        steps: [enter(name, "   "), click(action)],
        expectedResult: `빈 값과 똑같이 제출이 차단되고 "${name}" 검증 메시지가 표시된다.`,
        tags: ["validation"],
        rationale: `"${name}"은(는) 필수 입력이다.`,
      });
    }

    // Unicode / emoji in free-text fields.
    const textField = fields.find((field) => isTextField(field) && !isUrlField(field));
    if (textField) {
      const name = fieldName(textField);
      cases.push({
        title: `${name}에 한글·이모지 입력 처리`,
        area,
        subarea: SUBAREAS.boundary,
        type: "boundary",
        priority: "low",
        preconditions: `사용자가 ${label} 페이지에 있다.`,
        steps: [...fillSteps(fields.filter((field) => field !== textField).slice(0, 3)), enter(name, "브런치 😀 성수"), click(action)],
        expectedResult: "입력한 한글과 이모지가 깨지지 않고 그대로 처리·표시되며, 서버 오류(500)가 표시되지 않는다.",
        tags: ["boundary", "unicode"],
        rationale: `"${name}"은(는) 자유 텍스트 입력이다.`,
      });
    }

    // Fields beyond the first four (step 1 covers four per page).
    for (const field of fields.slice(4, 8)) cases.push(...casesForField(page, field, action, area));

    // Double submission on the page's other forms.
    for (const form of page.forms.slice(1, 3)) {
      const submit = form.submitLabels[0];
      if (!submit || submit === action) continue;
      cases.push({
        title: `"${submit}" 중복 제출 방지`,
        area,
        subarea: SUBAREAS.negative,
        type: "negative",
        priority: "medium",
        preconditions: `사용자가 ${label} 페이지의 ${form.name ?? `"${submit}"`} 폼에 유효한 값을 입력한 상태다.`,
        steps: [`"${submit}" 버튼을 빠르게 두 번 클릭한다.`],
        expectedResult: "요청은 한 번만 전송되고, 요청 중에는 버튼이 비활성화된다.",
        tags: ["idempotency"],
        rationale: `${label}에 "${submit}" 폼이 추가로 있다.`,
      });
    }

    // Session persistence where there is a login form.
    const password = fields.find((field) => field.type === "password");
    if (password && index < 3) {
      cases.push({
        title: `${label} 로그인 후 새로고침 시 세션 유지`,
        area,
        subarea: SUBAREAS.security,
        type: "security",
        priority: "high",
        preconditions: "유효한 테스트 계정이 있다.",
        steps: [...fillSteps(fields.slice(0, 4)), click(action), "페이지를 새로고침(F5)한다.", "브라우저 탭을 닫았다가 같은 주소를 다시 연다."],
        expectedResult: "새로고침 후에도 로그인 상태가 유지되고, 로그아웃 후에는 뒤로 가기로 보호된 화면이 다시 보이지 않는다.",
        tags: ["auth", "session"],
        rationale: `${label}에 "${fieldName(password)}" 비밀번호 입력란이 있다.`,
      });
    }
  }

  // Linked pages the crawler did not reach (step 1 has no case for them).
  for (const link of uncrawledLinks(analysis).slice(0, 4)) {
    const name = link.label ?? link.path.split("/").filter(Boolean).pop() ?? link.path;
    cases.push({
      title: `연결된 페이지 로딩: ${name}`,
      area: GAP_SUBAREAS.navigation,
      subarea: SUBAREAS.smoke,
      type: "smoke",
      priority: "low",
      preconditions: `사용자가 ${pageLabel(link.from)} 페이지에 있다.`,
      steps: link.label ? [`${link.from.path} 페이지를 연다.`, clickLink(link.label)] : [`${link.path} 페이지를 연다.`],
      expectedResult: `${link.path} 페이지가 열리고 본문이 오류 없이 표시된다 (404나 빈 화면이 아니다).`,
      tags: ["navigation", "smoke"],
      rationale: `${pageLabel(link.from)}에서 ${link.path}로 가는 링크를 발견했지만 아직 이 페이지를 다루는 케이스가 없다.`,
    });
  }

  if (!cases.length && pages.length) {
    cases.push({
      title: `${pages[0].title ?? projectName} 브라우저 확대(200%) 시 표시`,
      area: areaForPage(pages[0]),
      subarea: GAP_SUBAREAS.usability,
      type: "functional",
      priority: "low",
      preconditions: "애플리케이션이 배포되어 접속 가능하다.",
      steps: [`${pages[0].path} 페이지를 연다.`, "브라우저 확대 비율을 200%로 바꾼다."],
      expectedResult: "글자와 메뉴가 겹치거나 잘리지 않고 모든 내용을 읽을 수 있다.",
      tags: ["accessibility"],
      rationale: `${pageLabel(pages[0])} 페이지를 분석했다.`,
    });
  }
  return cases;
}
