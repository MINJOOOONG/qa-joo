import { parse, type HTMLElement } from "node-html-parser";
import type { FieldInfo, FormInfo, PageInfo } from "./types";

const clean = (value: string | null | undefined, max = 140): string | null => {
  const text = (value ?? "").replace(/\s+/g, " ").trim();
  return text ? text.slice(0, max) : null;
};

const unique = <T>(items: T[]): T[] => Array.from(new Set(items));

const ASSET_EXTENSION = /\.(png|jpe?g|gif|svg|webp|ico|pdf|zip|css|js|mjs|json|xml|txt|mp4|webm|woff2?)$/i;

function labelFor(element: HTMLElement, root: HTMLElement): string | null {
  const id = element.getAttribute("id");
  if (id) {
    const label = root.querySelectorAll("label").find((candidate) => candidate.getAttribute("for") === id);
    if (label) return clean(label.text);
  }
  let parent = element.parentNode as HTMLElement | null;
  while (parent && parent.tagName) {
    if (parent.tagName === "LABEL") return clean(parent.text);
    parent = parent.parentNode as HTMLElement | null;
  }
  return clean(element.getAttribute("aria-label")) ?? clean(element.getAttribute("title"));
}

function fieldInfo(element: HTMLElement, root: HTMLElement): FieldInfo | null {
  const tag = element.tagName.toLowerCase() as FieldInfo["tag"];
  const type = (element.getAttribute("type") ?? (tag === "input" ? "text" : tag)).toLowerCase();
  if (["hidden", "submit", "button", "reset", "image"].includes(type)) return null;
  const constraints: string[] = [];
  if (tag === "input" && type !== "text") constraints.push(`type=${type}`);
  for (const attribute of ["min", "max", "minlength", "maxlength", "pattern", "accept", "step"]) {
    const value = element.getAttribute(attribute);
    if (value) constraints.push(`${attribute}=${value.slice(0, 60)}`);
  }
  if (element.hasAttribute("multiple")) constraints.push("multiple");
  if (element.hasAttribute("disabled")) constraints.push("disabled");
  if (tag === "select") {
    const options = element.querySelectorAll("option").map((option) => clean(option.text, 40)).filter(Boolean);
    if (options.length) constraints.push(`options=${options.slice(0, 8).join("|")}`);
  }
  return {
    tag,
    name: clean(element.getAttribute("name") ?? element.getAttribute("id"), 60),
    label: labelFor(element, root),
    type,
    required: element.hasAttribute("required") || element.getAttribute("aria-required") === "true",
    placeholder: clean(element.getAttribute("placeholder")),
    constraints,
  };
}

function buttonLabel(element: HTMLElement): string | null {
  return (
    clean(element.getAttribute("aria-label"), 80) ??
    clean(element.text, 80) ??
    clean(element.getAttribute("value"), 80) ??
    clean(element.getAttribute("title"), 80)
  );
}

/** Extracts the testable surface of a page: forms, inputs, buttons, navigation and copy. */
export function parsePage(html: string, pageUrl: string): PageInfo {
  const root = parse(html, { comment: false, blockTextElements: { script: false, style: false, noscript: false } });
  const base = new URL(pageUrl);

  const internalLinks: string[] = [];
  for (const anchor of root.querySelectorAll("a[href]")) {
    const href = anchor.getAttribute("href") ?? "";
    if (!href || href.startsWith("#") || /^(mailto|tel|javascript|data):/i.test(href)) continue;
    try {
      const target = new URL(href, base);
      if (target.origin !== base.origin || ASSET_EXTENSION.test(target.pathname)) continue;
      internalLinks.push(target.pathname.replace(/\/+$/, "") || "/");
    } catch {
      // ignore malformed hrefs
    }
  }

  const navLabels = root
    .querySelectorAll("nav a, header a, [role=navigation] a")
    .map((anchor) => clean(anchor.text, 60))
    .filter((label): label is string => Boolean(label));

  const forms: FormInfo[] = root.querySelectorAll("form").map((form) => ({
    name: clean(form.getAttribute("aria-label") ?? form.getAttribute("name") ?? form.getAttribute("id"), 80),
    action: form.getAttribute("action") ?? null,
    method: (form.getAttribute("method") ?? "get").toLowerCase(),
    fields: form
      .querySelectorAll("input, textarea, select")
      .map((element) => fieldInfo(element, root))
      .filter((field): field is FieldInfo => field !== null),
    submitLabels: form
      .querySelectorAll("button, input[type=submit]")
      .map(buttonLabel)
      .filter((label): label is string => Boolean(label)),
  }));

  const insideForm = (element: HTMLElement) => {
    let parent = element.parentNode as HTMLElement | null;
    while (parent && parent.tagName) {
      if (parent.tagName === "FORM") return true;
      parent = parent.parentNode as HTMLElement | null;
    }
    return false;
  };

  const looseFields = root
    .querySelectorAll("input, textarea, select")
    .filter((element) => !insideForm(element))
    .map((element) => fieldInfo(element, root))
    .filter((field): field is FieldInfo => field !== null);

  const buttons = root
    .querySelectorAll("button, [role=button], input[type=submit], input[type=button]")
    .map(buttonLabel)
    .filter((label): label is string => Boolean(label));

  const body = root.querySelector("body") ?? root;
  const text = body.text.replace(/\s+/g, " ").trim();
  const scriptCount = root.querySelectorAll("script").length;
  const mountPoint = root.querySelector("#root, #__next, #app, #__nuxt");

  return {
    url: pageUrl,
    path: base.pathname || "/",
    title: clean(root.querySelector("title")?.text),
    description: clean(root.querySelector('meta[name="description"]')?.getAttribute("content"), 300),
    headings: unique(
      root
        .querySelectorAll("h1, h2, h3")
        .map((heading) => clean(heading.text, 120))
        .filter((value): value is string => Boolean(value)),
    ).slice(0, 25),
    internalLinks: unique(internalLinks).slice(0, 60),
    navLabels: unique(navLabels).slice(0, 25),
    buttons: unique(buttons).slice(0, 30),
    forms: forms.slice(0, 10),
    looseFields: looseFields.slice(0, 30),
    textSample: text.slice(0, 1500),
    clientRendered: text.length < 200 && (Boolean(mountPoint) || scriptCount > 5),
  };
}
