import type { FieldInfo, PageInfo, ProjectAnalysis } from "@/lib/analyzer/types";
import {
  constraint,
  exampleValue,
  isTextField,
  isUrlField,
  linkedPages,
  pageFields,
  pageLabel,
  resultHeading,
  uncrawledLinks,
} from "./heuristic-cases-shared";
import type { GeneratedCase } from "./schemas";

/**
 * English heuristic cases (raw, before dedupe/balance). See heuristic-cases.ts.
 * Twin of heuristic-cases-ko.ts: keep both files parallel (same cases, same order).
 *
 * Steps are one action each, in phrasings the Playwright draft generator parses:
 * `Enter "value" in "Field".`, `Leave "Field" empty.`, `Click "Button".`, `Click the "X" link.`
 */

const SUB = {
  smoke: "Smoke",
  happy: "Happy Path",
  negative: "Negative Cases",
  boundary: "Boundary",
  security: "Security",
  error: "Error Handling",
  navigation: "Navigation",
  usability: "Usability",
} as const;

function areaForPage(page: PageInfo): string {
  if (page.path === "/" || page.path === "") {
    return page.headings[0]?.slice(0, 60) ?? page.title?.split(/[|·–-]/)[0].trim().slice(0, 60) ?? "Home";
  }
  const segment = page.path.split("/").filter(Boolean)[0] ?? "Home";
  return segment.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).slice(0, 60);
}

function fieldName(field: FieldInfo): string {
  return field.label ?? field.placeholder ?? field.name ?? `${field.type} field`;
}

function primaryAction(page: PageInfo, fallback = "submit"): string {
  const submit =
    page.forms.flatMap((form) => form.submitLabels)[0] ??
    page.buttons.find((label) => /submit|save|send|create|analy[sz]e|generate|search|continue|sign/i.test(label)) ??
    page.buttons[0];
  return submit ?? fallback;
}

const click = (action: string) => `Click "${action}".`;
const clickLink = (label: string) => `Click the "${label}" link.`;
const enter = (name: string, value: string) => `Enter "${value}" in "${name}".`;
const TEXT_EXAMPLE = "QA test input";

function fillSteps(fields: FieldInfo[]): string[] {
  return fields.flatMap((field) => {
    const value = exampleValue(field, TEXT_EXAMPLE);
    if (value === null) return [];
    return field.tag === "select" ? [`Select "${value}" in "${fieldName(field)}".`] : [enter(fieldName(field), value)];
  });
}

function successResult(page: PageInfo): string {
  const heading = resultHeading(page);
  return heading
    ? `The "${heading}" result section is shown and no error message appears.`
    : "The request succeeds, a result (or confirmation message) is shown and no error message appears.";
}

function casesForField(page: PageInfo, field: FieldInfo, action: string, area: string): GeneratedCase[] {
  const name = fieldName(field);
  const cases: GeneratedCase[] = [];
  const pre = `User is on ${pageLabel(page)}.`;
  const base = { area, preconditions: pre, tags: [] as string[] };

  if (field.required || isUrlField(field)) {
    cases.push({
      ...base,
      subarea: SUB.negative,
      title: `Reject empty ${name}`,
      type: "negative",
      priority: "high",
      steps: [`Leave "${name}" empty.`, click(action)],
      expectedResult: `Submission is blocked and a validation message explains that "${name}" is required.`,
      tags: ["validation"],
      rationale: `"${name}" is ${field.required ? "marked required" : "a primary input"} on ${pageLabel(page)}.`,
    });
  }

  if (isUrlField(field)) {
    cases.push(
      {
        ...base,
        subarea: SUB.negative,
        title: `Reject malformed URL in ${name}`,
        type: "negative",
        priority: "high",
        steps: [enter(name, "not-a-valid-url"), click(action)],
        expectedResult: "An inline validation error is shown and no request is sent.",
        tags: ["validation", "url"],
        rationale: `"${name}" accepts URLs (${field.constraints.join(", ") || field.type}).`,
      },
      {
        ...base,
        subarea: SUB.security,
        title: `Reject localhost and private network URLs in ${name}`,
        type: "security",
        priority: "high",
        steps: [
          enter(name, "http://localhost/admin"),
          click(action),
          enter(name, "http://169.254.169.254/latest/meta-data/"),
          click(action),
        ],
        expectedResult: "Both requests are rejected; the server never fetches internal addresses (SSRF protection).",
        tags: ["ssrf", "security"],
        rationale: `The app accepts user-supplied URLs in "${name}", which is a classic SSRF entry point.`,
      },
      {
        ...base,
        subarea: SUB.boundary,
        title: `Stay stable with a very long URL in ${name}`,
        type: "boundary",
        priority: "medium",
        steps: [`Enter a 2,000-character URL (https://example.com/ followed by filler) in "${name}".`, click(action)],
        expectedResult: "The page does not freeze or break, and no server error (500) is shown.",
        tags: ["boundary", "url"],
        rationale: `"${name}" shows no maximum length, so probe it with a very long value.`,
      },
    );
  } else if (field.type === "email") {
    cases.push({
      ...base,
      subarea: SUB.negative,
      title: `Reject invalid email in ${name}`,
      type: "negative",
      priority: "high",
      steps: [enter(name, "user@"), click(action)],
      expectedResult: "A validation error is shown and the form is not submitted.",
      tags: ["validation", "email"],
      rationale: `"${name}" is an email input.`,
    });
  } else if (field.type === "number" || constraint(field, "min") || constraint(field, "max")) {
    const min = constraint(field, "min");
    const max = constraint(field, "max");
    const accepted = [min, max].filter((v): v is string => v !== null);
    const rejected = [min !== null ? String(Number(min) - 1) : "-1", max !== null ? String(Number(max) + 1) : "1000000000000"];
    cases.push({
      ...base,
      subarea: SUB.boundary,
      title: `Enforce numeric limits for ${name}`,
      type: "boundary",
      priority: "medium",
      steps: [...accepted, ...rejected].flatMap((value) => [enter(name, value), click(action)]),
      expectedResult: accepted.length
        ? `${accepted.join(" and ")} are accepted without errors; ${rejected.join(" and ")} are rejected with a range error message.`
        : `Entering ${rejected.join(" or ")} shows a range error message, or the allowed range is explained on the page.`,
      tags: ["boundary", "number"],
      rationale: `"${name}" is numeric${min || max ? ` (min=${min ?? "–"}, max=${max ?? "–"})` : ""}.`,
    });
  } else if (field.type === "file") {
    cases.push(
      {
        ...base,
        subarea: SUB.boundary,
        title: `Enforce upload limits for ${name}`,
        type: "boundary",
        priority: "medium",
        steps: ["Upload a file at the maximum allowed size/count.", "Upload one file over the limit."],
        expectedResult: "The limit is accepted; exceeding it shows a clear error and nothing is uploaded.",
        tags: ["upload", "boundary"],
        rationale: `"${name}" is a file input${field.constraints.length ? ` (${field.constraints.join(", ")})` : ""}.`,
      },
      {
        ...base,
        subarea: SUB.negative,
        title: `Reject unsupported file types in ${name}`,
        type: "negative",
        priority: "medium",
        steps: ["Upload a .txt file renamed to .jpg.", click(action)],
        expectedResult: "The file is rejected with a message listing supported types.",
        tags: ["upload", "validation"],
        rationale: `"${name}" accepts uploads${constraint(field, "accept") ? ` (accept=${constraint(field, "accept")})` : ""}.`,
      },
    );
  } else if (isTextField(field)) {
    const maxLength = constraint(field, "maxlength");
    cases.push({
      ...base,
      subarea: SUB.boundary,
      title: maxLength ? `Enforce ${maxLength}-character limit in ${name}` : `Handle very long input in ${name}`,
      type: "boundary",
      priority: "low",
      steps: maxLength
        ? [`Paste ${Number(maxLength) + 1} characters into "${name}".`, `Check how many characters "${name}" contains.`]
        : [`Paste 10,000 characters into "${name}".`, click(action)],
      expectedResult: maxLength
        ? `"${name}" accepts at most ${maxLength} characters.`
        : "The page does not freeze or break its layout, and no server error (500) is shown.",
      tags: ["boundary"],
      rationale: `"${name}" is free text${maxLength ? ` (maxlength=${maxLength})` : " (no visible limit)"}.`,
    });
    if (field.tag === "textarea") {
      cases.push({
        ...base,
        subarea: SUB.security,
        title: `Render HTML in ${name} as plain text`,
        type: "security",
        priority: "medium",
        steps: [enter(name, "<img src=x onerror=alert(1)>"), click(action), "Check the output."],
        expectedResult: "The markup is displayed as text; no script runs (no XSS).",
        tags: ["xss", "security"],
        rationale: `Text entered in "${name}" is likely echoed back to the page.`,
      });
    }
  } else if (field.type === "password") {
    cases.push({
      ...base,
      subarea: SUB.security,
      title: `Keep ${name} masked and out of URLs`,
      type: "security",
      priority: "high",
      steps: [enter(name, "Qa-Test-1234!"), click(action), "Check the resulting URL and network request."],
      expectedResult: "The value is masked on screen and never appears in the URL or query string.",
      tags: ["security", "auth"],
      rationale: `"${name}" is a password field.`,
    });
  }
  return cases;
}

export function englishHeuristicCases(projectName: string, analysis: ProjectAnalysis): GeneratedCase[] {
  const cases: GeneratedCase[] = [];
  const pages = analysis.app?.pages ?? [];
  const repo = analysis.repo;

  for (const [index, page] of pages.entries()) {
    const area = areaForPage(page);
    const action = primaryAction(page);
    const fields = pageFields(page);
    const label = pageLabel(page);

    cases.push({
      title: index === 0 ? `Load ${page.title ?? projectName} home page` : `Load ${label} page`,
      area,
      subarea: SUB.smoke,
      type: "smoke",
      priority: index === 0 ? "critical" : "medium",
      preconditions: "The application is deployed and reachable.",
      steps: [`Open ${page.path}.`, "Wait for the page to finish loading."],
      expectedResult: page.headings[0]
        ? `The "${page.headings[0]}" heading is shown and no error message appears.`
        : "The page body is shown and no error message appears.",
      tags: ["smoke"],
      rationale: `${page.path} was reachable during analysis.`,
    });

    if (fields.length) {
      cases.push({
        title: `Complete the main flow on ${index === 0 && page.path === "/" ? "the home page" : label} with valid input`,
        area,
        subarea: SUB.happy,
        type: "functional",
        priority: "high",
        preconditions: `User is on ${label}.`,
        steps: [...fillSteps(fields.slice(0, 4)), click(action), "Wait for the response."],
        expectedResult: successResult(page),
        tags: ["happy-path"],
        rationale: `Found ${fields.length} input(s) and a "${action}" action on ${label}.`,
      });
      cases.push({
        title: `Prevent duplicate submission of "${action}"`,
        area,
        subarea: SUB.negative,
        type: "negative",
        priority: "medium",
        preconditions: `User is on ${label} with valid input entered.`,
        steps: [`Double-click "${action}" quickly.`],
        expectedResult: "Only one request is sent; the control is disabled while the request is in flight.",
        tags: ["idempotency"],
        rationale: `"${action}" sends a request to the server.`,
      });
      cases.push({
        title: `Show a recoverable error when "${action}" fails`,
        area,
        subarea: SUB.error,
        type: "error",
        priority: "high",
        preconditions: `User is on ${label} with valid input entered and browser DevTools open.`,
        steps: ["Switch the DevTools Network tab to Offline.", click(action), "Turn Offline off in DevTools.", click(action)],
        expectedResult: "While offline a readable error message is shown and input is kept; after reconnecting, clicking again succeeds.",
        tags: ["resilience"],
        rationale: "Every user-initiated request needs a failure state.",
      });
    }
    for (const field of fields.slice(0, 4)) cases.push(...casesForField(page, field, action, area));

    if (page.navLabels.length > 1 && index === 0) {
      cases.push({
        title: "Navigate between primary sections",
        area: "Navigation",
        subarea: "",
        type: "e2e",
        priority: "medium",
        preconditions: "User is on the home page.",
        steps: page.navLabels.slice(0, 5).map(clickLink),
        expectedResult: "Each navigation item opens the right page and the browser back button returns to the previous page.",
        tags: ["navigation"],
        rationale: `Navigation found: ${page.navLabels.slice(0, 5).join(", ")}.`,
      });
    }
  }

  if (repo) {
    for (const endpoint of repo.apiEndpoints.slice(0, 4)) {
      cases.push(
        {
          title: `API ${endpoint} rejects an invalid payload`,
          area: "API",
          subarea: endpoint.slice(0, 60),
          type: "api",
          priority: "high",
          preconditions: "API is reachable.",
          steps: [`POST to ${endpoint} with an empty JSON body.`, `POST again with wrong field types.`],
          expectedResult: "The API responds with HTTP 400/422 and a JSON error message; nothing is persisted.",
          tags: ["api", "validation"],
          rationale: `Repository contains a route handler for ${endpoint}.`,
        },
        {
          title: `API ${endpoint} handles upstream failure gracefully`,
          area: "API",
          subarea: endpoint.slice(0, 60),
          type: "error",
          priority: "medium",
          preconditions: "A dependency of the endpoint is unavailable.",
          steps: [`Call ${endpoint} while the upstream dependency times out or returns 500.`],
          expectedResult: "The API returns a controlled error (no stack trace) within the configured timeout.",
          tags: ["api", "resilience"],
          rationale: `Derived from API ${endpoint} in the repository.`,
        },
      );
    }
    if (repo.hints.includes("Rate limiting is implemented")) {
      cases.push({
        title: "Rate limit repeated requests",
        area: "API",
        subarea: SUB.security,
        type: "security",
        priority: "medium",
        preconditions: "Rate limiting is enabled.",
        steps: ["Send requests above the documented limit within one minute.", "Inspect the last responses."],
        expectedResult: "Requests over the limit get HTTP 429 with a retry hint; normal traffic is unaffected.",
        tags: ["rate-limit"],
        rationale: "Repository implements rate limiting.",
      });
    }
    if (repo.hints.includes("Requests use timeouts")) {
      cases.push({
        title: "Handle upstream timeout",
        area: "Reliability",
        subarea: SUB.error,
        type: "error",
        priority: "medium",
        preconditions: "An upstream dependency responds slower than the timeout.",
        steps: ["Trigger the request against a slow upstream.", "Wait for the timeout."],
        expectedResult: "A clear timeout message is shown and the user can retry.",
        tags: ["timeout"],
        rationale: "Repository uses explicit request timeouts.",
      });
    }
    for (const route of repo.routes.filter((route) => route !== "/" && !route.includes("[")).slice(0, 3)) {
      cases.push({
        title: `Load route ${route}`,
        area: "Routes",
        subarea: SUB.smoke,
        type: "smoke",
        priority: "low",
        preconditions: "The application is deployed.",
        steps: [`Open ${route}.`],
        expectedResult: "The page body is shown and no error message appears.",
        tags: ["smoke", "routing"],
        rationale: `Repository defines the ${route} route.`,
      });
    }
  }

  cases.push(
    {
      title: "Return a friendly 404 for unknown pages",
      area: "General",
      subarea: SUB.error,
      type: "error",
      priority: "low",
      preconditions: "The application is deployed.",
      steps: ["Open /this-page-does-not-exist-qa-joo."],
      expectedResult: "A 404 page with a way back to the app is shown; no stack trace is exposed.",
      tags: ["routing"],
      rationale: "Baseline error handling for every web application.",
    },
    {
      title: "Serve baseline security headers",
      area: "General",
      subarea: SUB.security,
      type: "security",
      priority: "low",
      preconditions: "The application is deployed over HTTPS.",
      steps: ["Open the home page.", "Inspect response headers in DevTools."],
      expectedResult: "HTTPS is enforced and headers such as X-Content-Type-Options and a Content-Security-Policy are present.",
      tags: ["headers"],
      rationale: "Baseline security check for every web application.",
    },
  );
  return cases;
}

/** "Fill gaps" cases — English twin of koreanGapCases. */
export function englishGapCases(projectName: string, analysis: ProjectAnalysis): GeneratedCase[] {
  const cases: GeneratedCase[] = [];
  const pages = analysis.app?.pages ?? [];

  for (const [index, page] of pages.entries()) {
    const area = areaForPage(page);
    const label = pageLabel(page);
    const action = primaryAction(page);
    const fields = pageFields(page);

    for (const link of linkedPages(analysis, page).slice(0, 4)) {
      const target = pageLabel(link.page);
      cases.push({
        title: `Open ${target} from the "${link.label}" link`,
        area: SUB.navigation,
        subarea: SUB.smoke,
        type: "e2e",
        priority: "medium",
        preconditions: `User is on ${label}.`,
        steps: [`Open ${page.path}.`, clickLink(link.label)],
        expectedResult: link.page.headings[0]
          ? `${link.page.path} opens and the "${link.page.headings[0]}" heading is shown.`
          : `${link.page.path} opens and its content is shown without errors.`,
        tags: ["navigation"],
        rationale: `${label} links to ${link.page.path} ("${link.label}").`,
      });
    }

    if (!fields.length) continue;
    const fills = fillSteps(fields.slice(0, 4));
    const heading = resultHeading(page);

    cases.push({
      title: `Keep state on ${label} after browser back`,
      area,
      subarea: SUB.happy,
      type: "functional",
      priority: "medium",
      preconditions: `User is on ${label}.`,
      steps: [...fills, click(action), "Wait for the response.", "Press the browser Back button.", "Press the browser Forward button."],
      expectedResult: "After back and forward the page shows without errors, input or results are not lost or mixed up, and no request is re-sent.",
      tags: ["navigation", "state"],
      rationale: `"${action}" on ${label} produces a result state.`,
    });
    cases.push({
      title: `Refresh ${label} after submitting`,
      area,
      subarea: SUB.happy,
      type: "functional",
      priority: "medium",
      preconditions: `User is on ${label}.`,
      steps: [...fills, click(action), "Wait for the response.", "Reload the page (F5)."],
      expectedResult: "After reloading, the page shows again without errors and the previous request is not re-sent automatically.",
      tags: ["state"],
      rationale: `${label} sends a request with "${action}".`,
    });
    cases.push({
      title: `Fill and submit ${label} with the keyboard only`,
      area,
      subarea: SUB.happy,
      type: "functional",
      priority: "medium",
      preconditions: `User is on ${label} and does not use a mouse.`,
      steps: ["Press Tab to reach the first field.", ...fills, `Press Tab to reach the "${action}" button.`, "Press Enter."],
      expectedResult: `Focus moves in visual order and is always visible, and the form submits without a mouse${heading ? ` (the "${heading}" result is shown)` : ""}.`,
      tags: ["accessibility", "keyboard"],
      rationale: `${label} has ${fields.length} input(s) and a "${action}" button.`,
    });
    cases.push({
      title: `Lay out ${label} on a mobile screen (375px)`,
      area,
      subarea: SUB.usability,
      type: "functional",
      priority: "low",
      preconditions: "The DevTools device mode viewport width is set to 375px.",
      steps: [`Open ${page.path}.`, ...fills, click(action)],
      expectedResult: "All fields and buttons are visible and tappable without horizontal scrolling; no text is cut off or overlaps.",
      tags: ["responsive"],
      rationale: `${label} has a form, so small-screen usability matters.`,
    });

    const whitespaceField = fields.find((field) => field.required && (isTextField(field) || isUrlField(field) || field.type === "email"));
    if (whitespaceField) {
      const name = fieldName(whitespaceField);
      cases.push({
        title: `Block submission with only spaces in ${name}`,
        area,
        subarea: SUB.negative,
        type: "negative",
        priority: "medium",
        preconditions: `User is on ${label}.`,
        steps: [enter(name, "   "), click(action)],
        expectedResult: `Submission is blocked exactly like an empty value and the "${name}" validation message is shown.`,
        tags: ["validation"],
        rationale: `"${name}" is required.`,
      });
    }

    const textField = fields.find((field) => isTextField(field) && !isUrlField(field));
    if (textField) {
      const name = fieldName(textField);
      cases.push({
        title: `Handle accented text and emoji in ${name}`,
        area,
        subarea: SUB.boundary,
        type: "boundary",
        priority: "low",
        preconditions: `User is on ${label}.`,
        steps: [...fillSteps(fields.filter((field) => field !== textField).slice(0, 3)), enter(name, "café brunch 😀"), click(action)],
        expectedResult: "The non-Latin text and emoji are processed and shown intact, and no server error (500) is shown.",
        tags: ["boundary", "unicode"],
        rationale: `"${name}" is free text.`,
      });
    }

    for (const field of fields.slice(4, 8)) cases.push(...casesForField(page, field, action, area));

    for (const form of page.forms.slice(1, 3)) {
      const submit = form.submitLabels[0];
      if (!submit || submit === action) continue;
      cases.push({
        title: `Prevent duplicate submission of "${submit}"`,
        area,
        subarea: SUB.negative,
        type: "negative",
        priority: "medium",
        preconditions: `User has entered valid input in the ${form.name ?? `"${submit}"`} form on ${label}.`,
        steps: [`Double-click "${submit}" quickly.`],
        expectedResult: "Only one request is sent; the control is disabled while the request is in flight.",
        tags: ["idempotency"],
        rationale: `${label} has an additional "${submit}" form.`,
      });
    }

    const password = fields.find((field) => field.type === "password");
    if (password && index < 3) {
      cases.push({
        title: `Keep the session on ${label} after refresh`,
        area,
        subarea: SUB.security,
        type: "security",
        priority: "high",
        preconditions: "A valid test account exists.",
        steps: [...fillSteps(fields.slice(0, 4)), click(action), "Reload the page (F5).", "Close the tab and open the same address again."],
        expectedResult: "The user stays signed in after reloading, and after signing out the Back button does not reveal protected pages.",
        tags: ["auth", "session"],
        rationale: `${label} has a "${fieldName(password)}" password field.`,
      });
    }
  }

  for (const link of uncrawledLinks(analysis).slice(0, 4)) {
    const name = link.label ?? link.path.split("/").filter(Boolean).pop() ?? link.path;
    cases.push({
      title: `Load linked page: ${name}`,
      area: SUB.navigation,
      subarea: SUB.smoke,
      type: "smoke",
      priority: "low",
      preconditions: `User is on ${pageLabel(link.from)}.`,
      steps: link.label ? [`Open ${link.from.path}.`, clickLink(link.label)] : [`Open ${link.path}.`],
      expectedResult: `${link.path} opens and its content is shown without errors (not a 404 or blank page).`,
      tags: ["navigation", "smoke"],
      rationale: `${pageLabel(link.from)} links to ${link.path}, which no case covers yet.`,
    });
  }

  if (!cases.length && pages.length) {
    cases.push({
      title: `Show ${pages[0].title ?? projectName} at 200% browser zoom`,
      area: areaForPage(pages[0]),
      subarea: SUB.usability,
      type: "functional",
      priority: "low",
      preconditions: "The application is deployed and reachable.",
      steps: [`Open ${pages[0].path}.`, "Set the browser zoom to 200%."],
      expectedResult: "Text and menus do not overlap or get cut off; all content stays readable.",
      tags: ["accessibility"],
      rationale: `${pageLabel(pages[0])} was analyzed.`,
    });
  }
  return cases;
}
