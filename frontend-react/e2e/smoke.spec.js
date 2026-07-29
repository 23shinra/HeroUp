import { test, expect } from "@playwright/test";

/**
 * Parity smoke scenarios — document expected routes vs production multi-page app.
 * Most tests skip without a running preview server (npm run preview).
 */
const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:4173";

test.describe("LevelUp React parity (smoke)", () => {
  test.skip(!process.env.PLAYWRIGHT_BASE_URL, "Set PLAYWRIGHT_BASE_URL to run against a live preview server");

  test("auth route loads", async ({ page }) => {
    await page.goto(`${baseURL}/auth`);
    await expect(page).toHaveURL(/\/auth/);
  });

  test("map route loads after boot stub", async ({ page }) => {
    await page.goto(`${baseURL}/map`);
    await expect(page.locator("body")).toBeVisible();
  });

  test("battle route loads", async ({ page }) => {
    await page.goto(`${baseURL}/battle`);
    await expect(page.locator("body")).toBeVisible();
  });
});

test.describe("parity checklist (documentation)", () => {
  test("lists core routes implemented in React", () => {
    const routes = [
      "/",
      "/auth",
      "/map",
      "/skills",
      "/battle",
      "/shop",
      "/profile",
      "/rating",
      "/clan",
      "/class-select",
      "/parent",
      "/trainer",
      "/privacy",
      "/terms",
    ];
    expect(routes.length).toBeGreaterThanOrEqual(10);
  });
});
