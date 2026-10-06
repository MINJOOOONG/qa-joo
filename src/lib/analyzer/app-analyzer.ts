import "server-only";
import { AppError } from "@/lib/errors";
import { safeFetch } from "@/lib/security/safe-fetch";
import { assertSafeTarget, assertSafeUrl } from "@/lib/security/url-guard";
import { parsePage } from "./html";
import type { AppAnalysis, PageInfo } from "./types";

export interface AppAnalyzerOptions {
  allowPrivate: boolean;
  browser: boolean;
  maxPages?: number;
}

async function fetchPageHttp(url: string, allowPrivate: boolean): Promise<{ page: PageInfo; truncated: boolean }> {
  const response = await safeFetch(url, {
    allowPrivate,
    accept: ["text/html", "application/xhtml+xml"],
    maxBytes: 1_500_000,
    timeoutMs: 10_000,
  });
  if (response.status >= 400) throw new AppError("upstream", `${new URL(url).pathname} returned HTTP ${response.status}.`);
  return { page: parsePage(response.body, response.url), truncated: response.truncated };
}

/**
 * Optional rendering with Playwright for client-side apps. Every browser request is checked with
 * the same SSRF guard, so a page cannot pull the headless browser into a private network.
 */
async function fetchPagesBrowser(startUrl: string, maxPages: number, allowPrivate: boolean): Promise<PageInfo[]> {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined });
  try {
    const context = await browser.newContext({ userAgent: "QA-JOO-Analyzer/0.1" });
    await context.route("**/*", async (route) => {
      try {
        await assertSafeTarget(route.request().url(), { allowPrivate });
        await route.continue();
      } catch {
        await route.abort("blockedbyclient");
      }
    });
    const page = await context.newPage();
    const origin = new URL(startUrl).origin;
    const queue = [startUrl];
    const visited = new Set<string>();
    const pages: PageInfo[] = [];
    while (queue.length && pages.length < maxPages) {
      const url = queue.shift()!;
      if (visited.has(url)) continue;
      visited.add(url);
      try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15_000 });
        await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => undefined);
        const info = parsePage(await page.content(), page.url());
        pages.push(info);
        for (const path of info.internalLinks) queue.push(new URL(path, origin).toString());
      } catch {
        if (pages.length === 0) throw new AppError("upstream", `Could not render ${url} in the browser.`);
      }
    }
    return pages;
  } finally {
    await browser.close();
  }
}

/** Crawls up to `maxPages` same-origin pages starting at the application URL. */
export async function analyzeApplication(appUrl: string, options: AppAnalyzerOptions): Promise<AppAnalysis> {
  const start = assertSafeUrl(appUrl, { allowPrivate: options.allowPrivate });
  const maxPages = options.maxPages ?? 5;
  const warnings: string[] = [];

  if (options.browser) {
    const pages = await fetchPagesBrowser(start.toString(), maxPages, options.allowPrivate);
    return { baseUrl: start.origin, mode: "browser", pages, warnings };
  }

  const pages: PageInfo[] = [];
  const queue = [start.toString()];
  const visited = new Set<string>();
  while (queue.length && pages.length < maxPages) {
    const url = queue.shift()!;
    const key = new URL(url).pathname.replace(/\/+$/, "") || "/";
    if (visited.has(key)) continue;
    visited.add(key);
    try {
      const { page, truncated } = await fetchPageHttp(url, options.allowPrivate);
      if (truncated) warnings.push(`${page.path} was larger than 1.5 MB and was truncated.`);
      pages.push(page);
      for (const path of page.internalLinks) {
        if (!visited.has(path)) queue.push(new URL(path, start.origin).toString());
      }
    } catch (error) {
      if (pages.length === 0) throw error;
      warnings.push(`Skipped ${key}: ${error instanceof Error ? error.message : "request failed"}`);
    }
  }

  if (pages.some((page) => page.clientRendered)) {
    warnings.push(
      "Some pages look client-rendered; set ANALYZER_BROWSER=true (local/self-hosted) to analyze the rendered DOM.",
    );
  }
  return { baseUrl: start.origin, mode: "http", pages, warnings };
}
