import { expect, type Page } from "@playwright/test";

export const SANDBOX_PATH = "/sandbox/index.html";

export function uniqueKey(prefix: string): string {
  return `${prefix}${Date.now().toString(36).slice(-4).toUpperCase().replace(/[^A-Z0-9]/g, "X")}`;
}

export async function createProject(page: Page, options: { name: string; key: string; analyzeNow: boolean }) {
  await page.goto("/projects/new");
  await page.getByLabel("Project Name").fill(options.name);
  await page.getByLabel("Project Key").fill(options.key);
  await page.getByLabel("Application URL").fill(new URL(SANDBOX_PATH, page.url()).toString());
  const analyze = page.getByLabel(/Analyze the project/);
  if (options.analyzeNow) await analyze.check();
  else await analyze.uncheck();
  await page.getByRole("button", { name: "Create Project" }).click();
  await expect(page).toHaveURL(new RegExp(`/projects/${options.key}`));
}
