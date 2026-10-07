import { expect, test } from "@playwright/test";

// No locale cookie: the app must default to Korean.
test.use({ storageState: { cookies: [], origins: [] } });

test("defaults to Korean and switches between Korean and English", async ({ page }) => {
  await page.goto("/projects");
  await expect(page.locator("html")).toHaveAttribute("lang", "ko");
  const primary = page.getByRole("navigation", { name: "Primary" });
  await expect(primary.getByRole("link", { name: "프로젝트" })).toBeVisible();
  await expect(page.getByTestId("locale-ko")).toHaveAttribute("aria-pressed", "true");

  await page.getByTestId("locale-en").click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(primary.getByRole("link", { name: "Projects" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Projects" })).toBeVisible();

  // The choice is remembered across navigations.
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");

  await page.getByTestId("locale-ko").click();
  await expect(page.locator("html")).toHaveAttribute("lang", "ko");
  await expect(primary.getByRole("link", { name: "프로젝트" })).toBeVisible();
});
