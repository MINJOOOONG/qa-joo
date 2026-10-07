import { expect, test } from "@playwright/test";

test("Flow 2: open a case, PASS jumps to the next untested case, FAIL requires triage", async ({ page }) => {
  // A fresh run keeps the test independent of other tests and of repeated executions.
  await page.goto("/runs/new?project=RF");
  const runName = `E2E manual ${Date.now()}`;
  await page.getByLabel("Run Name").fill(runName);
  await page.getByTestId("create-run-submit").click();
  await expect(page.getByTestId("run-name")).toHaveText(runName);
  await expect(page.getByTestId("summary-untested")).toContainText("14");

  const firstRow = page.getByTestId("run-row").first();
  const firstKey = (await firstRow.getAttribute("data-case-key"))!;
  await firstRow.click();
  const panel = page.getByTestId("execution-panel");
  await expect(panel).toContainText(firstKey);
  await expect(panel.getByText("Expected Result")).toBeVisible();
  await page.getByTestId("result-pass").click();

  // Auto-advance to the next untested case.
  await expect(panel).toBeVisible();
  await expect(panel.locator(".font-mono").first()).not.toHaveText(firstKey);
  await expect(page.getByTestId("summary-passed")).toContainText("1");

  // Failures need category, severity and actual result.
  await page.getByTestId("result-fail").click();
  await page.getByTestId("confirm-result").click();
  await expect(page.getByText("Failure category is required.")).toBeVisible();
  await page.getByLabel("Failure Category").selectOption("api");
  await page.getByLabel("Severity").selectOption("major");
  await page.getByLabel("Actual Result").fill("The API returned 500 and the spinner never stopped.");
  await page.getByTestId("confirm-result").click();
  await expect(page.getByTestId("summary-failed")).toContainText("1");
  await page.keyboard.press("Escape");

  await expect(page.locator('[data-testid=run-row][data-result="passed"]')).toHaveCount(1);
  await expect(page.locator('[data-testid=run-row][data-result="failed"]')).toHaveCount(1);
  await expect(page.getByTestId("run-progress")).toContainText("2/14");
  await expect(page.getByTestId("run-pass-rate")).toHaveText("50%");
});

test("keyboard shortcuts record results", async ({ page }) => {
  await page.goto("/runs/new?project=RF");
  await page.getByLabel("Run Name").fill(`E2E keyboard ${Date.now()}`);
  await page.getByTestId("create-run-submit").click();
  await page.getByTestId("run-row").first().click();
  await expect(page.getByTestId("execution-panel")).toBeVisible();
  await page.getByTestId("execution-panel").press("s");
  await expect(page.getByTestId("summary-skipped")).toContainText("1");
});

test("completed runs are read-only until reopened", async ({ page }) => {
  await page.goto("/runs");
  await page.getByRole("link", { name: "ReviewForge Smoke v0.8.1" }).click();
  await page.getByTestId("run-row").first().click();
  await expect(page.getByText("This run is completed. Reopen it to change results.")).toBeVisible();
  await expect(page.getByTestId("result-pass")).toHaveCount(0);
});
