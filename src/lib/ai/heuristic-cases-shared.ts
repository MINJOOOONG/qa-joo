import type { FieldInfo, PageInfo, ProjectAnalysis } from "@/lib/analyzer/types";

/**
 * Language-independent helpers shared by the Korean and English heuristic generators
 * (heuristic-cases-ko.ts / heuristic-cases-en.ts), so both stay parallel.
 */

export function constraint(field: FieldInfo, key: string): string | null {
  const entry = field.constraints.find((value) => value.startsWith(`${key}=`));
  return entry ? entry.slice(key.length + 1) : null;
}

export function isUrlField(field: FieldInfo): boolean {
  return field.type === "url" || /url|link|website|address/i.test(`${field.name} ${field.label} ${field.placeholder}`);
}

export function isTextField(field: FieldInfo): boolean {
  return field.tag === "textarea" || field.type === "text" || field.type === "search";
}

/** Fields a tester can fill (enabled, not checkboxes/radios/files). */
export function pageFields(page: PageInfo): FieldInfo[] {
  return [...page.forms.flatMap((form) => form.fields), ...page.looseFields].filter(
    (field) => !field.constraints.includes("disabled"),
  );
}

/** Pages are named by their title (or first heading), never by a raw path, in case titles. */
export function pageLabel(page: PageInfo): string {
  return (page.title ?? page.headings[0] ?? page.path).slice(0, 80);
}

/** The visible outcome of the page's main action, when the analysis found one. */
export function resultHeading(page: PageInfo): string | null {
  return page.resultHeadings?.[0] ?? null;
}

/** "e.g. brunch, seongsu" / "예: 브런치" placeholders → the example value itself. */
function placeholderExample(field: FieldInfo): string | null {
  const placeholder = field.placeholder?.trim();
  if (!placeholder) return null;
  const example = /^(?:e\.g\.|eg\.|ex\.|예:|예\))\s*(.+)$/i.exec(placeholder)?.[1]?.trim();
  return example ? example.slice(0, 80) : null;
}

/**
 * A concrete, valid example value for a field, so "happy path" steps are executable and the
 * Playwright generator can fill them. Returns null for fields that are not typed into.
 */
export function exampleValue(field: FieldInfo, textFallback: string): string | null {
  if (["checkbox", "radio", "file", "range", "color"].includes(field.type)) return null;
  if (field.tag === "select") {
    const options = constraint(field, "options")?.split("|").filter(Boolean) ?? [];
    return options.find((option) => !/^(select|choose|선택|--)/i.test(option)) ?? options[0] ?? null;
  }
  if (isUrlField(field)) return "https://example.com/campaign";
  if (field.type === "email") return "qa@example.com";
  if (field.type === "tel") return "010-1234-5678";
  if (field.type === "password") return "Qa-Test-1234!";
  if (field.type === "date") return "2026-01-15";
  if (field.type === "number") {
    const min = Number(constraint(field, "min"));
    return Number.isFinite(min) && constraint(field, "min") !== null ? String(min) : "1";
  }
  const example = placeholderExample(field);
  const maxLength = Number(constraint(field, "maxlength") ?? Infinity);
  const value = example ?? textFallback;
  return value.slice(0, Number.isFinite(maxLength) && maxLength > 0 ? maxLength : value.length);
}

/** Same-origin links (label → path) found on a page; falls back to nav labels without paths. */
export function pageLinks(page: PageInfo): Array<{ label: string; path: string }> {
  return page.links ?? [];
}

const pathKey = (path: string) => path.replace(/\/index\.html?$/i, "").replace(/\/+$/, "") || "/";

/** Internal link targets that were not crawled (so step 1 has no case for them yet). */
export function uncrawledLinks(analysis: ProjectAnalysis): Array<{ label: string | null; path: string; from: PageInfo }> {
  const pages = analysis.app?.pages ?? [];
  const crawled = new Set(pages.map((page) => pathKey(page.path)));
  const result: Array<{ label: string | null; path: string; from: PageInfo }> = [];
  const seen = new Set<string>();
  for (const page of pages) {
    for (const path of page.internalLinks) {
      const key = pathKey(path);
      if (crawled.has(key) || seen.has(key)) continue;
      seen.add(key);
      result.push({ label: pageLinks(page).find((link) => link.path === path)?.label ?? null, path, from: page });
    }
  }
  return result;
}

/** Crawled pages other than `from` that `from` links to, with the link label. */
export function linkedPages(analysis: ProjectAnalysis, from: PageInfo): Array<{ label: string; page: PageInfo }> {
  const pages = analysis.app?.pages ?? [];
  const result: Array<{ label: string; page: PageInfo }> = [];
  for (const link of pageLinks(from)) {
    const target = pages.find((page) => pathKey(page.path) === pathKey(link.path));
    if (!target || pathKey(target.path) === pathKey(from.path)) continue;
    if (result.some((entry) => entry.page === target)) continue;
    result.push({ label: link.label, page: target });
  }
  return result;
}

/**
 * Korean object particle for a quoted value: 을 after a final consonant, 를 otherwise.
 * Latin text and digits are read aloud (e.g. "campaign" → 을, "1" → 을, "2" → 를).
 */
export function objectParticle(value: string): "을" | "를" {
  const last = value.trim().slice(-1);
  const code = last.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 === 0 ? "를" : "을";
  if (/[0-9]/.test(last)) return "013678".includes(last) ? "을" : "를";
  if (/[lmnbkpt]/i.test(last)) return "을";
  return "를";
}
