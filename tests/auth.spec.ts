/**
 * Test 1 — Authentication flow
 *
 * Covers:
 *  • Authenticated login redirects to /dashboard
 *  • Dashboard renders expected content (sidebar + generate card)
 *  • Unauthenticated access to /dashboard is redirected to /login
 */
import { test, expect } from "@playwright/test";
import { login } from "./helpers/auth";

const TEST_EMAIL = process.env.PLAYWRIGHT_TEST_EMAIL ?? "";
const TEST_PASSWORD = process.env.PLAYWRIGHT_TEST_PASSWORD ?? "";

// Skip the entire suite if credentials are not configured
test.beforeAll(() => {
  if (!TEST_EMAIL || !TEST_PASSWORD) {
    console.warn(
      "⚠  PLAYWRIGHT_TEST_EMAIL / PLAYWRIGHT_TEST_PASSWORD not set — skipping auth tests."
    );
  }
});

test.describe("Authentication flow", () => {
  test("login page renders and has correct heading", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
  });

  test("unauthenticated visit to /dashboard redirects to /login", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL("/login");
  });

  test(
    "valid credentials → redirect to /dashboard + content visible",
    async ({ page }) => {
      test.skip(!TEST_EMAIL || !TEST_PASSWORD, "Test credentials not set");

      await login(page, TEST_EMAIL, TEST_PASSWORD);

      // Sidebar brand
      await expect(page.getByText("B-Roll AI")).toBeVisible();
      // Generate card heading
      await expect(page.getByText("Generate B-Roll")).toBeVisible();
      // User email visible in sidebar
      await expect(page.getByText(TEST_EMAIL)).toBeVisible();
    }
  );

  test("sign-out button returns user to /login", async ({ page }) => {
    test.skip(!TEST_EMAIL || !TEST_PASSWORD, "Test credentials not set");

    await login(page, TEST_EMAIL, TEST_PASSWORD);

    await page.click("button:has-text('Sign out')");
    await expect(page).toHaveURL("/login");
  });
});
