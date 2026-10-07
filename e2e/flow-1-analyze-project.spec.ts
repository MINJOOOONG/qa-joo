import { expect, test } from "@playwright/test";
import { createProject, uniqueKey } from "./helpers";

test("Flow 1: new project → AI creates test cases from the site → summary → create test run", async ({ page }) => {
  const key = uniqueKey("FA");
  await createProject(page, { name: "Flow One Checker", key, analyzeNow: true });

  // Generation starts automatically; the cases are usable right away (no review step).
  await expect(page).toHaveURL(new RegExp(`/projects/${key}/cases`), { timeout: 30_000 });
  const rows = page.getByTestId("case-row-link");
  expect(await rows.count()).toBeGreaterThanOrEqual(6);
  await expect(rows.filter({ hasText: /Reject malformed URL in Campaign URL/ })).toHaveCount(1);

  // The overview explains what the site is.
  await page.goto(`/projects/${key}`);
  await expect(page.getByTestId("site-summary")).not.toContainText("Create TCs from the site");

  await page.goto(`/runs/new?project=${key}`);
  await expect(page.getByTestId("selection-count")).toContainText(/^\d+ of \d+ approved/);
  await page.getByLabel("Build / Version").fill("v1.0.0");
  await page.getByTestId("create-run-submit").click();
  await expect(page).toHaveURL(/\/runs\/[0-9a-f-]{36}/);
  await expect(page.getByTestId("run-name")).toHaveText("Flow One Checker Regression");
  await expect(page.getByTestId("run-progress")).toContainText("0/");
  await expect(page.getByTestId("run-row").first()).toBeVisible();
});

test("generated cases include negative, boundary, security and error cases", async ({ page }) => {
  const key = uniqueKey("FB");
  await createProject(page, { name: "Coverage Checker", key, analyzeNow: true });
  await expect(page).toHaveURL(new RegExp(`/projects/${key}/cases`), { timeout: 30_000 });
  const rows = page.locator("tbody tr");
  for (const type of ["Negative", "Boundary", "Security", "Error Handling"]) {
    await expect(rows.filter({ hasText: type }).first()).toBeVisible();
  }
});

test("test case list can show results per test run", async ({ page }) => {
  await page.goto("/projects/RF/cases");
  const filter = page.getByTestId("run-filter");
  await filter.selectOption({ label: "Results from: ReviewForge Smoke v0.8.1" });
  await expect(page.getByTestId("run-summary")).toContainText("ReviewForge Smoke v0.8.1: 3 case(s)");
  await expect(page.getByTestId("case-row-link")).toHaveCount(3);
  await filter.selectOption({ label: "Results from: ReviewForge Release Regression" });
  await expect(page.getByTestId("run-summary")).toContainText("Passed 3");
  await expect(page.getByTestId("run-summary")).toContainText("Failed 1");
});
