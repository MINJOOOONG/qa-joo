import { expect, test, type Page } from "@playwright/test";
import { createProject, uniqueKey } from "./helpers";

async function addCase(page: Page, key: string, title: string, steps: string[], expected: string) {
  await page.goto(`/projects/${key}/cases`);
  await page.getByRole("link", { name: "New Case" }).click();
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Step 1").fill(steps[0]);
  for (const [index, step] of steps.slice(1).entries()) {
    await page.getByRole("button", { name: "Add step" }).click();
    await page.getByLabel(`Step ${index + 2}`).fill(step);
  }
  await page.getByLabel("Expected Result").fill(expected);
  await page.getByRole("button", { name: "Create Test Case" }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
}

async function automate(page: Page) {
  await page.getByTestId("generate-automation").click();
  await expect(page).toHaveURL(/\/automation\/tests\//);
  await expect(page.getByTestId("automation-code")).toHaveValue(/@playwright\/test/);
  await expect(page.getByTestId("lint-report")).not.toContainText("must import");
  await page.getByTestId("approve-automation").click();
  await expect(page.getByText("Approved. The case is now Automated.")).toBeVisible();
}

test("Flow 3: AI Playwright draft → approve → run → results with screenshot, trace and failure analysis", async ({ page }) => {
  test.setTimeout(180_000);
  const key = uniqueKey("FC");
  await createProject(page, { name: "Automation Checker", key, analyzeNow: false });

  await addCase(page, key, "잘못된 형식의 캠페인 URL 입력 시 거부", ['"Campaign URL"에 "not-a-valid-url"을 입력한다.', '"Analyze" 버튼을 클릭한다.'], "입력란에 검증 오류가 표시된다.");
  await automate(page);
  await addCase(
    page,
    key,
    "localhost URL 입력 시 요구사항 표시",
    ['"Campaign URL"에 "http://localhost/brief"을 입력한다.', '"Analyze" 버튼을 클릭한다.'],
    "'Campaign requirements' 목록이 표시된다.",
  );
  await automate(page);

  await page.goto(`/runs/new?project=${key}`);
  await page.getByTestId("create-run-submit").click();
  await expect(page).toHaveURL(/\/runs\/[0-9a-f-]{36}/);
  const runUrl = page.url();
  await expect(page.locator('[data-testid=run-row]').filter({ hasText: "Automated" })).toHaveCount(2);

  await page.getByTestId("run-automation").click();
  await expect(page).toHaveURL(/\/automation\/runs\//);
  await expect(page.locator("[data-run-status=failed], [data-run-status=passed]").first()).toBeVisible({ timeout: 120_000 });

  const passed = page.locator('[data-testid=automation-result][data-status="passed"]');
  const failed = page.locator('[data-testid=automation-result][data-status="failed"]');
  await expect(passed).toHaveCount(1);
  await expect(failed).toHaveCount(1);
  await expect(failed.getByTestId("failure-screenshot")).toBeVisible();
  await expect(failed.getByTestId("trace-link")).toBeVisible();

  await failed.getByTestId("analyze-failure").click();
  await expect(failed.getByTestId("failure-analysis")).toContainText("AI SUGGESTION");
  await expect(failed.getByTestId("failure-analysis")).toContainText("Probable cause");

  // Automated verdicts land in the test run next to manual results.
  await page.goto(runUrl);
  await expect(page.locator('[data-testid=run-row][data-result="passed"]')).toHaveCount(1);
  await expect(page.locator('[data-testid=run-row][data-result="failed"]')).toHaveCount(1);
  await expect(page.getByTestId("run-progress")).toContainText("2/2");
});
