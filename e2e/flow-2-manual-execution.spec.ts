import { expect, test } from "@playwright/test";

test("Flow 2: open a case, PASS jumps to the next untested case, FAIL requires triage", async ({ page }) => {
  await page.goto("/runs");
  await page.getByRole("link", { name: "ReviewForge Release Regression" }).click();
  await expect(page.getByTestId("run-name")).toHaveText("ReviewForge Release Regression");

  const passedBefore = Number(await page.getByTestId("summary-passed").locator("span").last().textContent());
  const firstUntested = page.locator('[data-testid=run-row][data-result="untested"]').first();
  const firstKey = await firstUntested.getAttribute("data-case-key");
  await firstUntested.click();

  const panel = page.getByTestId("execution-panel");
  await expect(panel).toContainText(firstKey!);
  await expect(panel.getByText("Expected Result")).toBeVisible();
  await page.getByTestId("result-pass").click();

  // Auto-advance to the next untested case.
  await expect(panel).not.toContainText(firstKey!);
  await expect(page.getByTestId("summary-passed")).toContainText(String(passedBefore + 1));

  // Failures need category, severity and actual result.
  await page.keyboard.press("f");
  await page.getByTestId("confirm-result").click();
  await expect(page.getByText("Failure category is required.")).toBeVisible();
  await page.getByLabel("Failure Category").selectOption("api");
  await page.getByLabel("Severity").selectOption("major");
  await page.getByLabel("Actual Result").fill("The API returned 500 and the spinner never stopped.");
  await page.getByTestId("confirm-result").click();
  await expect(page.getByText(/marked Failed/)).toBeVisible();
  await page.keyboard.press("Escape");

  await expect(page.locator('[data-testid=run-row][data-result="failed"]')).not.toHaveCount(0);
  await expect(page.getByTestId("run-pass-rate")).toHaveText(/\d+%/);
});

test("completed runs are read-only until reopened", async ({ page }) => {
  await page.goto("/runs");
  await page.getByRole("link", { name: "ReviewForge Smoke v0.8.1" }).click();
  await page.getByTestId("run-row").first().click();
  await expect(page.getByText("This run is completed. Reopen it to change results.")).toBeVisible();
  await expect(page.getByTestId("result-pass")).toHaveCount(0);
});
