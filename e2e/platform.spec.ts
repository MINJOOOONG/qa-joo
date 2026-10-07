import { expect, test } from "@playwright/test";

test("navigation: top bar leads to projects, project tabs lead to every page", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/projects$/);
  await expect(page.getByRole("navigation", { name: "Primary" }).getByRole("link")).toHaveCount(1);
  await page.getByTestId("project-card").filter({ hasText: "ReviewForge" }).getByRole("link", { name: "ReviewForge", exact: true }).click();
  for (const label of ["Test Cases", "Test Runs", "Automation", "Activity", "Settings", "Overview"]) {
    await page.getByRole("navigation", { name: "Project" }).getByRole("link", { name: label, exact: true }).click();
    await expect(page.getByRole("navigation", { name: "Project" }).getByRole("link", { name: label, exact: true })).toHaveAttribute("aria-current", "page");
  }
  await page.goto("/dashboard");
  await expect(page.getByText("Pass Rate", { exact: true })).toBeVisible();
});

test("global search finds projects and cases", async ({ page }) => {
  await page.goto("/dashboard");
  await page.getByLabel("Global search").fill("localhost");
  await page.getByRole("option", { name: /localhost URL 입력 시 거부/ }).first().click();
  await expect(page).toHaveURL(/\/cases\//);
});

test("project validation: a target URL is required and keys are unique", async ({ page }) => {
  await page.goto("/projects/new");
  await page.getByLabel("Project Name").fill("Missing target");
  await page.getByLabel("Project Key").fill("MT");
  await page.getByRole("button", { name: "Create Project" }).click();
  await expect(page.getByText("Add an Application URL or a Repository URL")).toBeVisible();

  await page.getByLabel("Project Key").fill("RF");
  await page.getByLabel("Application URL").fill("https://example.com");
  await page.getByRole("button", { name: "Create Project" }).click();
  await expect(page.getByText("Key is already in use.")).toBeVisible();
});

test("runner endpoints reject unsigned requests; artifacts block path traversal", async ({ request }) => {
  const callback = await request.post("/api/automation/results", { data: { automationRunId: "x", status: "passed" } });
  expect(callback.status()).toBe(401);
  const manifest = await request.get("/api/automation/runs/some-run/manifest");
  expect(manifest.status()).toBe(401);
  const traversal = await request.get("/api/artifacts/..%2F..%2Fpackage.json");
  expect([400, 404]).toContain(traversal.status());
});

