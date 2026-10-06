import { expect, test } from "@playwright/test";
import { createProject, uniqueKey } from "./helpers";

test("Flow 1: new project → analyze → review AI drafts → approve all → create test run", async ({ page }) => {
  const key = uniqueKey("FA");
  await createProject(page, { name: "Flow One Checker", key, analyzeNow: true });

  // Analysis starts automatically and lands AI drafts for review.
  await expect(page).toHaveURL(new RegExp(`/projects/${key}/review`));
  const drafts = page.getByTestId("draft-row");
  await expect(drafts.first()).toBeVisible({ timeout: 30_000 });
  expect(await drafts.count()).toBeGreaterThanOrEqual(6);
  await expect(page.getByText("AI DRAFT").first()).toBeVisible();
  await expect(page.getByRole("cell", { name: /Campaign URL에 잘못된 형식의 URL 입력 시 거부/ })).toBeVisible();

  // Drafts are not usable in runs until approved.
  await page.getByTestId("approve-all").click();
  await page.getByTestId("create-run-cta").click();

  await expect(page.getByTestId("selection-count")).toContainText(/^\d+ of \d+ approved/);
  await page.getByLabel("Build / Version").fill("v1.0.0");
  await page.getByTestId("create-run-submit").click();
  await expect(page).toHaveURL(/\/runs\/[0-9a-f-]{36}/);
  await expect(page.getByTestId("run-name")).toHaveText("Flow One Checker Regression");
  await expect(page.getByTestId("run-progress")).toContainText("0/");
  await expect(page.getByTestId("run-row").first()).toBeVisible();
});

test("AI drafts include negative, boundary, security and error cases", async ({ page }) => {
  const key = uniqueKey("FB");
  await createProject(page, { name: "Coverage Checker", key, analyzeNow: true });
  await expect(page.getByTestId("draft-row").first()).toBeVisible({ timeout: 30_000 });
  for (const type of ["Negative", "Boundary", "Security", "Error Handling"]) {
    await expect(page.getByTestId("draft-row").filter({ hasText: type }).first()).toBeVisible();
  }
});
