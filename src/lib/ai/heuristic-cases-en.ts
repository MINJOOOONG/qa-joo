import type { FieldInfo, PageInfo, ProjectAnalysis } from "@/lib/analyzer/types";
import type { GeneratedCase } from "./schemas";

/** English heuristic cases (raw, before dedupe/balance). See heuristic-cases.ts. */
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

function constraint(field: FieldInfo, key: string): string | null {
  const entry = field.constraints.find((value) => value.startsWith(`${key}=`));
  return entry ? entry.slice(key.length + 1) : null;
}

function isUrlField(field: FieldInfo): boolean {
  return field.type === "url" || /url|link|website|address/i.test(`${field.name} ${field.label} ${field.placeholder}`);
}

function primaryAction(page: PageInfo, fallback = "submit"): string {
  const submit =
    page.forms.flatMap((form) => form.submitLabels)[0] ??
    page.buttons.find((label) => /submit|save|send|create|analy[sz]e|generate|search|continue|sign/i.test(label)) ??
    page.buttons[0];
  return submit ?? fallback;
}

function casesForField(page: PageInfo, field: FieldInfo, action: string, area: string): GeneratedCase[] {
  const name = fieldName(field);
  const cases: GeneratedCase[] = [];
  const pre = `User is on ${page.title ?? page.path}.`;
  const base = { area, preconditions: pre, tags: [] as string[] };

  if (field.required || isUrlField(field)) {
    cases.push({
      ...base,
      subarea: "Negative Cases",
      title: `Reject empty ${name}`,
      type: "negative",
      priority: "high",
      steps: [`Leave "${name}" empty.`, `Click "${action}".`],
      expectedResult: `Submission is blocked and a validation message explains that "${name}" is required.`,
      tags: ["validation"],
      rationale: `"${name}" is ${field.required ? "marked required" : "a primary input"} on ${page.path}.`,
    });
  }

  if (isUrlField(field)) {
    cases.push(
      {
        ...base,
        subarea: "Negative Cases",
        title: `Reject malformed URL in ${name}`,
        type: "negative",
        priority: "high",
        steps: [`Enter "not-a-valid-url" in "${name}".`, `Click "${action}".`],
        expectedResult: "An inline validation error is shown and no request is sent.",
        tags: ["validation", "url"],
        rationale: `"${name}" accepts URLs (${field.constraints.join(", ") || field.type}).`,
      },
      {
        ...base,
        subarea: "Security",
        title: `Reject localhost and private network URLs in ${name}`,
        type: "security",
        priority: "high",
        steps: [
          `Enter "http://localhost/admin" in "${name}" and click "${action}".`,
          `Repeat with "http://192.168.0.1/" and "http://169.254.169.254/latest/meta-data/".`,
        ],
        expectedResult: "Each request is rejected; the server never fetches internal addresses (SSRF protection).",
        tags: ["ssrf", "security"],
        rationale: `The app accepts user-supplied URLs in "${name}", which is a classic SSRF entry point.`,
      },
      {
        ...base,
        subarea: "Boundary",
        title: `Handle a very long URL in ${name}`,
        type: "boundary",
        priority: "medium",
        steps: [`Enter a valid URL that is 2,048 characters long in "${name}".`, `Click "${action}".`, "Repeat with 2,049 characters."],
        expectedResult: "The supported maximum is accepted; anything longer is rejected with a clear message.",
        tags: ["boundary", "url"],
        rationale: "URL inputs need an explicit maximum length.",
      },
    );
  } else if (field.type === "email") {
    cases.push({
      ...base,
      subarea: "Negative Cases",
      title: `Reject invalid email in ${name}`,
      type: "negative",
      priority: "high",
      steps: [`Enter "user@" in "${name}".`, `Click "${action}".`],
      expectedResult: "A validation error is shown and the form is not submitted.",
      tags: ["validation", "email"],
      rationale: `"${name}" is an email input.`,
    });
  } else if (field.type === "number" || constraint(field, "min") || constraint(field, "max")) {
    const min = constraint(field, "min");
    const max = constraint(field, "max");
    cases.push({
      ...base,
      subarea: "Boundary",
      title: `Enforce numeric limits for ${name}`,
      type: "boundary",
      priority: "medium",
      steps: [
        min ? `Enter ${min} (minimum) and submit; then enter ${Number(min) - 1}.` : `Enter 0 and a negative number.`,
        max ? `Enter ${max} (maximum) and submit; then enter ${Number(max) + 1}.` : "Enter a very large number (e.g. 1e12).",
        "Enter a non-numeric value such as 'abc'.",
      ],
      expectedResult: "In-range values are accepted; out-of-range and non-numeric values are rejected with a message.",
      tags: ["boundary", "number"],
      rationale: `"${name}" is numeric${min || max ? ` (min=${min ?? "–"}, max=${max ?? "–"})` : ""}.`,
    });
  } else if (field.type === "file") {
    cases.push(
      {
        ...base,
        subarea: "Boundary",
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
        subarea: "Negative Cases",
        title: `Reject unsupported file types in ${name}`,
        type: "negative",
        priority: "medium",
        steps: ["Upload a .exe or .txt file renamed to .jpg.", `Click "${action}".`],
        expectedResult: "The file is rejected with a message listing supported types.",
        tags: ["upload", "validation"],
        rationale: `"${name}" accepts uploads${constraint(field, "accept") ? ` (accept=${constraint(field, "accept")})` : ""}.`,
      },
    );
  } else if (field.tag === "textarea" || field.type === "text" || field.type === "search") {
    const maxLength = constraint(field, "maxlength");
    cases.push({
      ...base,
      subarea: "Boundary",
      title: maxLength ? `Enforce ${maxLength}-character limit in ${name}` : `Handle very long input in ${name}`,
      type: "boundary",
      priority: "low",
      steps: maxLength
        ? [`Enter exactly ${maxLength} characters in "${name}".`, `Try to enter ${Number(maxLength) + 1} characters.`]
        : [`Paste 10,000 characters into "${name}".`, `Click "${action}".`],
      expectedResult: "Input at the limit is accepted; longer input is truncated or rejected without breaking the layout.",
      tags: ["boundary"],
      rationale: `"${name}" is free text${maxLength ? ` with maxlength=${maxLength}` : " without a visible length limit"}.`,
    });
    if (field.tag === "textarea") {
      cases.push({
        ...base,
        subarea: "Security",
        title: `Render HTML in ${name} as plain text`,
        type: "security",
        priority: "medium",
        steps: [`Enter <img src=x onerror=alert(1)> in "${name}".`, `Click "${action}" and view the output.`],
        expectedResult: "The markup is displayed as text; no script runs (no XSS).",
        tags: ["xss", "security"],
        rationale: `"${name}" accepts free text that is likely echoed back to the user.`,
      });
    }
  } else if (field.type === "password") {
    cases.push({
      ...base,
      subarea: "Security",
      title: `Keep ${name} masked and out of URLs`,
      type: "security",
      priority: "high",
      steps: [`Type a password into "${name}".`, `Submit and inspect the resulting URL and network request.`],
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
    const fields = [...page.forms.flatMap((form) => form.fields), ...page.looseFields].filter(
      (field) => !field.constraints.includes("disabled"),
    );

    cases.push({
      title: index === 0 ? `Load ${page.title ?? projectName} home page` : `Load ${page.path} page`,
      area,
      subarea: "Smoke",
      type: "smoke",
      priority: index === 0 ? "critical" : "medium",
      preconditions: "The application is deployed and reachable.",
      steps: [`Open ${page.path}.`, "Wait for the page to finish loading."],
      expectedResult: `The page renders without errors${page.headings[0] ? ` and shows "${page.headings[0]}"` : ""}.`,
      tags: ["smoke"],
      rationale: `Page ${page.path} was reachable during analysis.`,
    });

    if (fields.length) {
      const named = fields.slice(0, 3).map(fieldName);
      cases.push({
        title: `Complete the main flow on ${page.path === "/" ? "the home page" : page.path} with valid input`,
        area,
        subarea: "Happy Path",
        type: "functional",
        priority: "high",
        preconditions: `User is on ${page.title ?? page.path}.`,
        steps: [...named.map((name) => `Fill "${name}" with valid data.`), `Click "${action}".`, "Wait for the response."],
        expectedResult: "The request succeeds and the result is shown without errors.",
        tags: ["happy-path"],
        rationale: `Found ${fields.length} input(s) and the "${action}" action on ${page.path}.`,
      });
      cases.push({
        title: `Prevent duplicate submission of "${action}"`,
        area,
        subarea: "Negative Cases",
        type: "negative",
        priority: "medium",
        preconditions: `User is on ${page.title ?? page.path} with valid input entered.`,
        steps: [`Double-click "${action}" quickly.`],
        expectedResult: "Only one request is sent; the control is disabled while the request is in flight.",
        tags: ["idempotency"],
        rationale: `"${action}" triggers a server request.`,
      });
      cases.push({
        title: `Show a recoverable error when "${action}" fails`,
        area,
        subarea: "Error Handling",
        type: "error",
        priority: "high",
        preconditions: "The backend returns HTTP 500 or the network is offline.",
        steps: ["Simulate a server error (or go offline in DevTools).", `Click "${action}".`, "Restore the network and retry."],
        expectedResult: "A readable error is shown, entered data is kept, and retrying succeeds.",
        tags: ["resilience"],
        rationale: "Every user-triggered request needs a failure state.",
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
        steps: page.navLabels.slice(0, 5).map((label) => `Click "${label}" and verify the destination loads.`),
        expectedResult: "Each navigation item opens the right page and the browser back button returns to the previous page.",
        tags: ["navigation"],
        rationale: `Navigation items found: ${page.navLabels.slice(0, 5).join(", ")}.`,
      });
    }
  }

  if (repo) {
    for (const endpoint of repo.apiEndpoints.slice(0, 4)) {
      const area = `API ${endpoint}`.slice(0, 60);
      cases.push(
        {
          title: `${endpoint} rejects an invalid payload`,
          area: "API",
          subarea: endpoint.slice(0, 60),
          type: "api",
          priority: "high",
          preconditions: "API is reachable.",
          steps: [`POST to ${endpoint} with an empty JSON body.`, `POST again with wrong field types.`],
          expectedResult: "The API responds with HTTP 400/422 and a JSON error message; nothing is persisted.",
          tags: ["api", "validation"],
          rationale: `Route handler ${endpoint} exists in the repository.`,
        },
        {
          title: `${endpoint} handles upstream failure gracefully`,
          area: "API",
          subarea: endpoint.slice(0, 60),
          type: "error",
          priority: "medium",
          preconditions: "A dependency of the endpoint is unavailable.",
          steps: [`Call ${endpoint} while the upstream dependency times out or returns 500.`],
          expectedResult: "The API returns a controlled error (no stack trace) within the configured timeout.",
          tags: ["api", "resilience"],
          rationale: `Derived from ${area}.`,
        },
      );
    }
    if (repo.hints.includes("Rate limiting is implemented")) {
      cases.push({
        title: "Rate limit repeated requests",
        area: "API",
        subarea: "Security",
        type: "security",
        priority: "medium",
        preconditions: "Rate limiting is enabled.",
        steps: ["Send requests above the documented limit within one minute.", "Inspect the last responses."],
        expectedResult: "Requests over the limit get HTTP 429 with a retry hint; normal traffic is unaffected.",
        tags: ["rate-limit"],
        rationale: "The repository contains rate limiting logic.",
      });
    }
    if (repo.hints.includes("Requests use timeouts")) {
      cases.push({
        title: "Handle upstream timeout",
        area: "Reliability",
        subarea: "Error Handling",
        type: "error",
        priority: "medium",
        preconditions: "An upstream dependency responds slower than the timeout.",
        steps: ["Trigger the request against a slow upstream.", "Wait for the timeout."],
        expectedResult: "A clear timeout message is shown and the user can retry.",
        tags: ["timeout"],
        rationale: "The repository uses explicit request timeouts.",
      });
    }
    for (const route of repo.routes.filter((route) => route !== "/" && !route.includes("[")).slice(0, 3)) {
      cases.push({
        title: `Load ${route}`,
        area: "Routes",
        subarea: "Smoke",
        type: "smoke",
        priority: "low",
        preconditions: "The application is deployed.",
        steps: [`Open ${route} directly.`],
        expectedResult: "The page renders without errors; unknown sub-paths return a 404 page.",
        tags: ["smoke", "routing"],
        rationale: `Route ${route} exists in the repository.`,
      });
    }
  }

  cases.push(
    {
      title: "Return a friendly 404 for unknown pages",
      area: "General",
      subarea: "Error Handling",
      type: "error",
      priority: "low",
      preconditions: "The application is deployed.",
      steps: ["Open /this-page-does-not-exist-qa-joo."],
      expectedResult: "A 404 page with a way back to the app is shown; no stack trace is exposed.",
      tags: ["routing"],
      rationale: "Baseline error handling check for every web application.",
    },
    {
      title: "Serve baseline security headers",
      area: "General",
      subarea: "Security",
      type: "security",
      priority: "low",
      preconditions: "The application is deployed over HTTPS.",
      steps: ["Load the home page.", "Inspect response headers in DevTools."],
      expectedResult: "HTTPS is enforced and headers such as X-Content-Type-Options and a Content-Security-Policy are present.",
      tags: ["headers"],
      rationale: "Baseline security check for every web application.",
    },
  );
  return cases;
}
